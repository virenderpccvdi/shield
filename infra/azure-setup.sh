#!/usr/bin/env bash
# infra/azure-setup.sh — Idempotent Azure resource provisioning for Shield
# Usage: ./infra/azure-setup.sh
# Requires: az CLI logged in (az login), helm
set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
RESOURCE_GROUP="shield-rg"
LOCATION="eastus"
ACR_NAME="shieldacrh44d4fynx4l2c"
AKS_CLUSTER="shield-aks"
PG_SERVER="shield-pg"
REDIS_NAME="shield-redis"
KEYVAULT_NAME="shield-kv"
ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { echo "[$(date '+%H:%M:%S')] $*"; }
ok()   { echo "[OK] $*"; }
skip() { echo "[SKIP] $* already exists"; }

resource_exists() {
  # Usage: resource_exists <az command that returns id or empty>
  local result
  result=$("$@" 2>/dev/null) || true
  [[ -n "$result" ]]
}

# ---------------------------------------------------------------------------
# 1. Login check
# ---------------------------------------------------------------------------
check_login() {
  log "Checking Azure login..."
  if ! az account show --output json > /dev/null 2>&1; then
    echo "ERROR: Not logged in to Azure."
    echo "  Run: az login"
    echo "  Then retry this script."
    exit 1
  fi
  SUBSCRIPTION=$(az account show --query "name" -o tsv)
  ok "Logged in — subscription: ${SUBSCRIPTION}"
}

# ---------------------------------------------------------------------------
# 2. Resource group
# ---------------------------------------------------------------------------
provision_resource_group() {
  log "Resource group: ${RESOURCE_GROUP}..."
  if az group show --name "${RESOURCE_GROUP}" --output json > /dev/null 2>&1; then
    skip "Resource group ${RESOURCE_GROUP}"
  else
    az group create \
      --name "${RESOURCE_GROUP}" \
      --location "${LOCATION}" \
      --output json > /dev/null
    ok "Created resource group ${RESOURCE_GROUP} in ${LOCATION}"
  fi
}

# ---------------------------------------------------------------------------
# 3. ACR
# ---------------------------------------------------------------------------
provision_acr() {
  log "ACR: ${ACR_NAME}..."
  if az acr show --name "${ACR_NAME}" --resource-group "${RESOURCE_GROUP}" --output json > /dev/null 2>&1; then
    skip "ACR ${ACR_NAME}"
  else
    az acr create \
      --name "${ACR_NAME}" \
      --resource-group "${RESOURCE_GROUP}" \
      --sku Basic \
      --output json > /dev/null
    ok "Created ACR ${ACR_NAME}"
  fi

  # Enable admin user (idempotent)
  az acr update \
    --name "${ACR_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --admin-enabled true \
    --output json > /dev/null
  ok "ACR admin user enabled — login server: ${ACR_LOGIN_SERVER}"
}

# ---------------------------------------------------------------------------
# 4. AKS
# ---------------------------------------------------------------------------
provision_aks() {
  log "AKS cluster: ${AKS_CLUSTER}..."
  if az aks show --name "${AKS_CLUSTER}" --resource-group "${RESOURCE_GROUP}" --output json > /dev/null 2>&1; then
    skip "AKS cluster ${AKS_CLUSTER}"
  else
    az aks create \
      --name "${AKS_CLUSTER}" \
      --resource-group "${RESOURCE_GROUP}" \
      --location "${LOCATION}" \
      --node-count 3 \
      --node-vm-size Standard_B2s \
      --enable-cluster-autoscaler \
      --min-count 2 \
      --max-count 5 \
      --attach-acr "${ACR_NAME}" \
      --generate-ssh-keys \
      --output json > /dev/null
    ok "Created AKS cluster ${AKS_CLUSTER}"
  fi
}

# ---------------------------------------------------------------------------
# 5. PostgreSQL Flexible Server
# ---------------------------------------------------------------------------
provision_postgres() {
  log "PostgreSQL Flexible Server: ${PG_SERVER}..."
  if az postgres flexible-server show \
       --name "${PG_SERVER}" \
       --resource-group "${RESOURCE_GROUP}" \
       --output json > /dev/null 2>&1; then
    skip "PostgreSQL Flexible Server ${PG_SERVER}"
  else
    # Prompt for admin password if not set in environment
    PG_ADMIN_USER="${PG_ADMIN_USER:-shieldadmin}"
    if [[ -z "${PG_ADMIN_PASSWORD:-}" ]]; then
      read -r -s -p "Enter PostgreSQL admin password: " PG_ADMIN_PASSWORD
      echo
    fi

    az postgres flexible-server create \
      --name "${PG_SERVER}" \
      --resource-group "${RESOURCE_GROUP}" \
      --location "${LOCATION}" \
      --admin-user "${PG_ADMIN_USER}" \
      --admin-password "${PG_ADMIN_PASSWORD}" \
      --sku-name Standard_B1ms \
      --tier Burstable \
      --storage-size 32 \
      --version 16 \
      --high-availability Disabled \
      --output json > /dev/null

    # Require SSL
    az postgres flexible-server parameter set \
      --name "${PG_SERVER}" \
      --resource-group "${RESOURCE_GROUP}" \
      --parameter-name require_secure_transport \
      --value on \
      --output json > /dev/null

    ok "Created PostgreSQL Flexible Server ${PG_SERVER}"
  fi

  PG_HOST=$(az postgres flexible-server show \
    --name "${PG_SERVER}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query "fullyQualifiedDomainName" -o tsv)
  ok "PostgreSQL connection: host=${PG_HOST} port=5432 sslmode=require"
}

# ---------------------------------------------------------------------------
# 6. Azure Cache for Redis
# ---------------------------------------------------------------------------
provision_redis() {
  log "Azure Cache for Redis: ${REDIS_NAME}..."
  if az redis show \
       --name "${REDIS_NAME}" \
       --resource-group "${RESOURCE_GROUP}" \
       --output json > /dev/null 2>&1; then
    skip "Redis cache ${REDIS_NAME}"
  else
    az redis create \
      --name "${REDIS_NAME}" \
      --resource-group "${RESOURCE_GROUP}" \
      --location "${LOCATION}" \
      --sku Basic \
      --vm-size c1 \
      --output json > /dev/null
    ok "Created Redis cache ${REDIS_NAME}"
  fi

  REDIS_HOST=$(az redis show \
    --name "${REDIS_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query "hostName" -o tsv)
  REDIS_KEY=$(az redis list-keys \
    --name "${REDIS_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query "primaryKey" -o tsv)
  ok "Redis hostname: ${REDIS_HOST}  (key retrieved — store in Key Vault)"
}

# ---------------------------------------------------------------------------
# 7. Key Vault
# ---------------------------------------------------------------------------
provision_keyvault() {
  log "Key Vault: ${KEYVAULT_NAME}..."
  if az keyvault show \
       --name "${KEYVAULT_NAME}" \
       --resource-group "${RESOURCE_GROUP}" \
       --output json > /dev/null 2>&1; then
    skip "Key Vault ${KEYVAULT_NAME}"
  else
    az keyvault create \
      --name "${KEYVAULT_NAME}" \
      --resource-group "${RESOURCE_GROUP}" \
      --location "${LOCATION}" \
      --enable-rbac-authorization true \
      --output json > /dev/null
    ok "Created Key Vault ${KEYVAULT_NAME}"
  fi
}

# ---------------------------------------------------------------------------
# 8. Get AKS credentials
# ---------------------------------------------------------------------------
get_aks_credentials() {
  log "Fetching AKS credentials..."
  az aks get-credentials \
    --resource-group "${RESOURCE_GROUP}" \
    --name "${AKS_CLUSTER}" \
    --overwrite-existing \
    --output none
  ok "kubectl context set to ${AKS_CLUSTER}"
}

# ---------------------------------------------------------------------------
# 9. Helm: ingress-nginx + cert-manager
# ---------------------------------------------------------------------------
install_helm_charts() {
  log "Installing ingress-nginx..."
  if helm status ingress-nginx --namespace ingress-nginx > /dev/null 2>&1; then
    skip "ingress-nginx helm release"
  else
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 2>/dev/null || true
    helm repo update ingress-nginx
    kubectl create namespace ingress-nginx --dry-run=client -o yaml | kubectl apply -f -
    helm install ingress-nginx ingress-nginx/ingress-nginx \
      --namespace ingress-nginx \
      --set controller.replicaCount=2 \
      --set controller.service.externalTrafficPolicy=Local \
      --wait --timeout 5m
    ok "ingress-nginx installed"
  fi

  log "Installing cert-manager..."
  if helm status cert-manager --namespace cert-manager > /dev/null 2>&1; then
    skip "cert-manager helm release"
  else
    helm repo add jetstack https://charts.jetstack.io 2>/dev/null || true
    helm repo update jetstack
    kubectl create namespace cert-manager --dry-run=client -o yaml | kubectl apply -f -
    helm install cert-manager jetstack/cert-manager \
      --namespace cert-manager \
      --set crds.enabled=true \
      --wait --timeout 5m
    ok "cert-manager installed"
  fi
}

# ---------------------------------------------------------------------------
# 10. Summary
# ---------------------------------------------------------------------------
print_summary() {
  echo ""
  echo "========================================"
  echo "  Shield Azure Infrastructure Summary"
  echo "========================================"
  echo "  Resource Group : ${RESOURCE_GROUP} (${LOCATION})"
  echo "  ACR            : ${ACR_LOGIN_SERVER}"
  echo "  AKS            : ${AKS_CLUSTER}"
  echo "  PostgreSQL     : ${PG_SERVER}.postgres.database.azure.com"
  echo "  Redis          : ${REDIS_NAME}.redis.cache.windows.net"
  echo "  Key Vault      : ${KEYVAULT_NAME}.vault.azure.net"
  echo "========================================"
  echo ""
  echo "Next steps:"
  echo "  1. Run: ./infra/k8s-bootstrap.sh both"
  echo "  2. Apply manifests: kustomize build k8s/overlays/prod/ | kubectl apply -f -"
  echo "  3. Check pods: kubectl get pods -n shield-prod"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  check_login
  provision_resource_group
  provision_acr
  provision_aks
  provision_postgres
  provision_redis
  provision_keyvault
  get_aks_credentials
  install_helm_charts
  print_summary
}

main "$@"
