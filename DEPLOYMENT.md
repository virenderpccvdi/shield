# Shield Platform — Deployment Guide

## Quick Reference
| Environment | Trigger | Namespace | Approval |
|---|---|---|---|
| dev | push to `develop` | `shield-dev` | Auto |
| prod | push to `main` | `shield-prod` | Manual (Azure DevOps environment gate) |

## Initial Setup (one-time)

### 1. Provision Azure Infrastructure
```bash
./infra/azure-setup.sh
```

### 2. Bootstrap K8s Secrets
```bash
cp .env.example .env  # fill in your values
./infra/k8s-bootstrap.sh both
```

### 3. Configure Azure DevOps
- Create variable group **shield-aks-vars** with: `ACR_LOGIN_SERVER`, `AKS_RESOURCE_GROUP`, `AKS_CLUSTER_NAME`, `AZURE_SUBSCRIPTION_ID`
- Create service connections: `shield-azure-rm` (Azure Resource Manager) and `shield-acr` (Docker Registry)
- Add self-hosted agent named `shield-self-hosted` pointing to this server
- Create environment **shield-prod** with an approval gate

### 4. First Deploy
Push to `develop` branch → auto deploys to `shield-dev`. Review, then push/PR to `main` → approve in Azure DevOps → deploys to `shield-prod`.

## Manual Deploy (emergency)
```bash
./infra/deploy-manual.sh prod <git-sha>
```

## APK Distribution
The release APK is automatically built by CI and:
1. Deployed to `/var/www/ai/FamilyShield/static/shield-app.apk` (served at `/download/shield-app.apk`)
2. Bundled into the `shield-website` Docker image at `/download/shield-app.apk`

Download URL: `https://shield.rstglobal.in/download/shield-app.apk`

## Architecture
14 microservices on AKS:
- **Eureka** (8261) — Service discovery
- **Config** (8288) — Centralized config
- **Gateway** (8280) — Entry point, JWT auth, rate limiting
- **Auth** (8281), **Tenant** (8282), **Profile** (8283)
- **DNS** (8284), **DNS-Resolver** (8285-alt)
- **Location** (8285), **Notification** (8286)
- **Rewards** (8287), **Analytics** (8289)
- **Admin** (8290), **AI** (8291) — FastAPI + LLM

## Rollback
```bash
kubectl rollout undo deployment/shield-gateway -n shield-prod
kubectl rollout undo deployment/shield-auth -n shield-prod
```
