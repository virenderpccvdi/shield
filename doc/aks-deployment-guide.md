# Shield Platform — AKS Deployment Guide ($200/month)

## Cost Breakdown

| Resource | SKU | Monthly Cost |
|---|---|---|
| AKS Node (1x Standard_B4ms) | 4 vCPU, 16GB RAM | ~$120 |
| Azure PostgreSQL Flexible | Burstable B1ms | ~$28 |
| Azure Cache for Redis | Basic C0 (250MB) | ~$16 |
| Azure Container Registry | Basic | ~$5 |
| Load Balancer (Standard) | Included with AKS | ~$5 |
| Bandwidth + DNS | ~5GB egress | ~$5 |
| **Total (baseline)** | | **~$179/month** |

> Autoscaling adds 2nd/3rd node only under load (~$120/node × hours active).  
> At 100k users: upgrade node to D4s_v3 (~$180/month) + 2nd node = ~$360/month.

---

## What You Need To Provide

### 1. Azure Subscription
- Create at [portal.azure.com](https://portal.azure.com)
- Run `az account show` to confirm
- Ensure quota for: 4 vCPU B-series (default is sufficient), Standard LB

### 2. Azure DevOps Organization
- Create at [dev.azure.com](https://dev.azure.com) (free for up to 5 users)
- Create a project: `Shield`
- Connect your GitHub repo OR push code to Azure Repos

### 3. DNS Access
- You need to add **2 DNS records** at your domain registrar (where rstglobal.in is managed):
  ```
  A    shield.rstglobal.in    → <AKS LoadBalancer IP>   (get after cluster creation)
  A    api.shield.rstglobal.in → <AKS LoadBalancer IP>
  ```

### 4. Secrets — fill in `k8s/secrets/secrets-template.yaml`
- PostgreSQL admin password (you choose, use during Bicep deploy)
- Redis access key (from Azure Portal after deploy)
- Your current `.env` file values (Stripe, SMTP, API keys)

---

## Step-by-Step Deployment

### Phase 1: Provision Azure Infrastructure (~30 minutes)

```bash
# 1. Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# 2. Login
az login

# 3. Create resource group (centralindia for lowest latency from India)
az group create --name shield-rg --location centralindia

# 4. Edit infra/bicep/main.parameters.json:
#    - Set dbAdminPassword (strong password)
#    - Set yourPublicIp (run: curl ifconfig.me)

# 5. Deploy Azure resources
az deployment group create \
  --resource-group shield-rg \
  --template-file infra/bicep/main.bicep \
  --parameters @infra/bicep/main.parameters.json

# 6. Save the outputs:
#    aksName, acrLoginServer, pgHostname, redisHostname, redisPort
```

### Phase 2: Get AKS Credentials + Install Tools

```bash
# Get kubectl access
az aks get-credentials --resource-group shield-rg --name shield-aks

# Install ingress-nginx (free load balancer)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0/deploy/static/provider/cloud/deploy.yaml

# Wait for LoadBalancer IP (takes 2-3 minutes)
kubectl get svc -n ingress-nginx ingress-nginx-controller
# Copy the EXTERNAL-IP — add it to DNS records above

# Install cert-manager (free TLS)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.17.0/cert-manager.yaml
sleep 60  # wait for cert-manager to start

# Apply TLS issuers
kubectl apply -f k8s/ingress/cert-issuer.yaml

# Create namespaces
kubectl apply -f k8s/base/namespace.yaml
```

### Phase 3: Configure Secrets

```bash
# 1. Get Redis access key from Azure Portal:
#    Portal → Redis Cache → shield-redis-prod → Access keys → Primary key

# 2. Fill in k8s/secrets/secrets-template.yaml with REAL values
#    (base64-encode each: echo -n 'value' | base64)

# 3. Apply secrets to BOTH namespaces
kubectl apply -f k8s/secrets/secrets-filled.yaml -n shield-prod
kubectl apply -f k8s/secrets/secrets-filled.yaml -n shield-dev
# ⚠️ Do NOT commit secrets-filled.yaml to git!
```

### Phase 4: Setup Azure DevOps Pipeline

1. Go to [dev.azure.com](https://dev.azure.com) → your project

2. **Service Connections** (Project Settings → Service Connections):
   - Add `Azure Resource Manager` → name it `shield-azure-rm` → Subscription scope
   - Add `Docker Registry` → Azure Container Registry → name it `shield-acr`

3. **Variable Group** (Pipelines → Library → Variable Groups):
   - Create group `shield-aks-vars` with:
     ```
     ACR_LOGIN_SERVER    = <output from Bicep, e.g. shieldacr1234.azurecr.io>
     AKS_RESOURCE_GROUP  = shield-rg
     AKS_CLUSTER_NAME    = shield-aks
     AZURE_SUBSCRIPTION_ID = <your subscription ID>
     ```

4. **New Pipeline** → GitHub/Azure Repos → Select repo → `azure-pipelines.yml`

5. **Environments** (Pipelines → Environments):
   - Create `shield-dev` (auto-deploy)
   - Create `shield-prod` → Add Approval gate (Approvals and checks → Approvals → add yourself)

### Phase 5: First Deploy

```bash
# Trigger pipeline by pushing to develop branch:
git checkout -b develop
git push origin develop
# Pipeline auto-deploys to shield-dev namespace

# After verifying dev works → merge to main → approve prod deploy in Azure DevOps UI
```

### Phase 6: Apply Ingress + HPA

```bash
kubectl apply -f k8s/ingress/ingress-prod.yaml
kubectl apply -f k8s/hpa/hpa.yaml
```

---

## Verify Deployment

```bash
# Check all pods running
kubectl get pods -n shield-prod

# Check gateway logs
kubectl logs -n shield-prod deployment/shield-gateway --tail=50

# Test API
curl https://api.shield.rstglobal.in/actuator/health

# Watch autoscaling
kubectl get hpa -n shield-prod -w
```

---

## Upgrading to 1 Lakh (100k) Users

When user count grows, scale up with **zero downtime**:

```bash
# 1. Upgrade node SKU (B4ms → D4s_v3 ~$180/month)
az aks nodepool update \
  --resource-group shield-rg \
  --cluster-name shield-aks \
  --name system \
  --node-vm-size Standard_D4s_v3

# 2. Upgrade PostgreSQL (B1ms → D2s_v3 ~$140/month)
# Done in Azure Portal → PostgreSQL → Compute + Storage

# 3. Upgrade Redis (Basic C0 → Standard C1 ~$55/month)
# Done in Azure Portal → Redis → Scale
```

---

## Daily Operations

```bash
# Check resource usage
kubectl top pods -n shield-prod
kubectl top nodes

# Roll back a broken deploy
kubectl rollout undo deployment/shield-gateway -n shield-prod

# View pipeline runs
az pipelines run list --org https://dev.azure.com/YOUR_ORG --project Shield
```
