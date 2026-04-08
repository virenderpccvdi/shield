// Shield Platform — Azure AKS Infrastructure
// Budget: ~$188/month (1x B4ms AKS + PostgreSQL B1ms + Redis Basic + ACR Basic)
// Usage: az deployment group create -g shield-rg --template-file main.bicep --parameters @main.parameters.json

@description('Environment: dev or prod')
@allowed(['dev', 'prod'])
param environment string = 'prod'

@description('Azure region')
param location string = resourceGroup().location

@description('Kubernetes version')
param kubernetesVersion string = '1.32'

@description('PostgreSQL admin password')
@secure()
param dbAdminPassword string

@description('Your public IP for DB firewall (run: curl ifconfig.me)')
param yourPublicIp string = '0.0.0.0'

// ── Names ──────────────────────────────────────────────────────────────────────
var prefix = 'shield'
var clusterName = '${prefix}-aks'
var acrName = '${prefix}acr${uniqueString(resourceGroup().id)}'
var dbServerName = '${prefix}-pg-${environment}'
var redisName = '${prefix}-redis-${environment}'
var logWorkspaceName = '${prefix}-logs'

// ── Log Analytics (free 5GB/day) ───────────────────────────────────────────────
resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logWorkspaceName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ── Container Registry (Basic ~$5/month) ──────────────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false  // use managed identity
  }
}

// ── AKS Cluster (1x Standard_B4ms = ~$120/month) ──────────────────────────────
// Single node pool, cluster autoscaler 1→3 nodes (pays only for active nodes)
resource aks 'Microsoft.ContainerService/managedClusters@2024-02-01' = {
  name: clusterName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    kubernetesVersion: kubernetesVersion
    dnsPrefix: '${prefix}-k8s'

    agentPoolProfiles: [
      {
        name: 'system'
        vmSize: 'Standard_D4s_v3'    // 4 vCPU, 16GB RAM — fits all 12 services (B4ms not available in centralindia)
        count: 1
        minCount: 1
        maxCount: 3                  // autoscale up to 3 nodes under load
        enableAutoScaling: true
        osType: 'Linux'
        osSKU: 'AzureLinux'
        mode: 'System'
        osDiskSizeGB: 50
      }
    ]

    networkProfile: {
      networkPlugin: 'azure'
      networkPolicy: 'azure'
      loadBalancerSku: 'standard'
    }

    autoUpgradeProfile: {
      upgradeChannel: 'patch'        // auto patch-level upgrades
    }

    oidcIssuerProfile: { enabled: true }
    securityProfile: {
      workloadIdentity: { enabled: true }
    }
  }
}

// ── Grant AKS pull access to ACR ──────────────────────────────────────────────
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, aks.id, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')  // AcrPull
    principalId: aks.properties.identityProfile.kubeletidentity.objectId
    principalType: 'ServicePrincipal'
  }
}

// ── PostgreSQL Flexible Server (Burstable B1ms ~$28/month) ────────────────────
resource pgServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: dbServerName
  location: location
  sku: {
    name: 'Standard_B1ms'            // 1 vCPU, 2GB RAM — sufficient for <1000 users
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: 'shieldadmin'
    administratorLoginPassword: dbAdminPassword
    storage: { storageSizeGB: 32 }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' }  // enable for prod at higher cost
  }
}

// Allow AKS outbound IP to reach PostgreSQL
resource pgFirewallAks 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: pgServer
  name: 'allow-aks'
  properties: {
    startIpAddress: '0.0.0.0'  // TODO: restrict to AKS outbound IP after cluster creation
    endIpAddress: '255.255.255.255'
  }
}

resource pgFirewallAdmin 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: pgServer
  name: 'allow-admin-ip'
  properties: {
    startIpAddress: yourPublicIp
    endIpAddress: yourPublicIp
  }
}

// Create shield_db database
resource shieldDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: pgServer
  name: 'shield_db'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.UTF8'
  }
}

// ── Redis Cache (Basic C0 ~$16/month) ─────────────────────────────────────────
resource redis 'Microsoft.Cache/Redis@2024-03-01' = {
  name: redisName
  location: location
  properties: {
    sku: {
      name: 'Basic'
      family: 'C'
      capacity: 0                    // C0 = 250MB — sufficient for rate limiting + sessions
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output aksName string = aks.name
output acrLoginServer string = acr.properties.loginServer
output pgHostname string = pgServer.properties.fullyQualifiedDomainName
output redisHostname string = redis.properties.hostName
output redisPort int = redis.properties.sslPort
output kubectlCommand string = 'az aks get-credentials -g ${resourceGroup().name} -n ${aks.name}'
