#!/usr/bin/env bash
# infra/deploy-manual.sh — Manual deploy for emergencies (no CI/CD)
# Usage: ./infra/deploy-manual.sh [dev|prod] [IMAGE_TAG]
# IMAGE_TAG defaults to current git SHA (short)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ACR_LOGIN_SERVER="shieldacrh44d4fynx4l2c.azurecr.io"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { echo "[$(date '+%H:%M:%S')] $*"; }
ok()   { echo "[OK] $*"; }
die()  { echo "[ERROR] $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
ENV="${1:-}"
TAG="${2:-}"

if [[ -z "${ENV}" ]]; then
  echo "Usage: $0 [dev|prod] [IMAGE_TAG]"
  echo "  ENV       : dev or prod"
  echo "  IMAGE_TAG : docker image tag (default: git short SHA)"
  exit 1
fi

[[ "${ENV}" == "dev" || "${ENV}" == "prod" ]] || die "ENV must be 'dev' or 'prod'"

if [[ -z "${TAG}" ]]; then
  TAG=$(git -C "${PROJECT_ROOT}" rev-parse --short HEAD 2>/dev/null || echo "manual-$(date +%Y%m%d%H%M)")
fi

OVERLAY_DIR="${PROJECT_ROOT}/k8s/overlays/${ENV}"
[[ -d "${OVERLAY_DIR}" ]] || die "Overlay directory not found: ${OVERLAY_DIR}"

log "=== Shield Manual Deploy ==="
log "  ENV : ${ENV}"
log "  TAG : ${TAG}"
log "  ACR : ${ACR_LOGIN_SERVER}"
echo ""

# ---------------------------------------------------------------------------
# Services list (Java services + Python AI + website)
# ---------------------------------------------------------------------------
JAVA_SERVICES=(
  shield-eureka
  shield-config
  shield-gateway
  shield-auth
  shield-tenant
  shield-profile
  shield-dns
  shield-dns-resolver
  shield-location
  shield-notification
  shield-rewards
  shield-analytics
  shield-admin
)

# Services with custom Dockerfiles outside the standard Java module layout
PYTHON_SERVICES=(shield-ai)
STATIC_SERVICES=(shield-website)

ALL_SERVICES=("${JAVA_SERVICES[@]}" "${PYTHON_SERVICES[@]}" "${STATIC_SERVICES[@]}")

# ---------------------------------------------------------------------------
# Step 1: Maven build (Java services only)
# ---------------------------------------------------------------------------
log "Building Java services with Maven..."
cd "${PROJECT_ROOT}"
mvn package -DskipTests -T4 -q
ok "Maven build complete"

# ---------------------------------------------------------------------------
# Step 2: ACR login
# ---------------------------------------------------------------------------
log "Logging in to ACR..."
az acr login --name "${ACR_LOGIN_SERVER%%.*}" --output none
ok "ACR login successful"

# ---------------------------------------------------------------------------
# Step 3: Docker build + push (parallel)
# ---------------------------------------------------------------------------
log "Building and pushing Docker images (parallel)..."

build_and_push() {
  local svc="$1"
  local image="${ACR_LOGIN_SERVER}/${svc}:${TAG}"
  local context="${PROJECT_ROOT}/${svc}"

  if [[ ! -d "${context}" ]]; then
    echo "[SKIP] ${svc}: directory not found at ${context}"
    return 0
  fi

  if [[ ! -f "${context}/Dockerfile" ]]; then
    echo "[SKIP] ${svc}: no Dockerfile in ${context}"
    return 0
  fi

  echo "[BUILD] ${svc} → ${image}"
  docker build \
    --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --build-arg GIT_SHA="${TAG}" \
    -t "${image}" \
    "${context}" \
    > "/tmp/docker-build-${svc}.log" 2>&1

  echo "[PUSH ] ${svc}"
  docker push "${image}" \
    >> "/tmp/docker-build-${svc}.log" 2>&1

  echo "[DONE ] ${svc}"
}

export -f build_and_push
export ACR_LOGIN_SERVER TAG PROJECT_ROOT

PIDS=()
for svc in "${ALL_SERVICES[@]}"; do
  build_and_push "${svc}" &
  PIDS+=($!)
done

FAILED=0
for pid in "${PIDS[@]}"; do
  wait "${pid}" || { echo "[ERROR] A build/push job failed (pid ${pid})"; FAILED=1; }
done

if [[ "${FAILED}" -eq 1 ]]; then
  echo ""
  echo "One or more build/push jobs failed. Check logs in /tmp/docker-build-*.log"
  exit 1
fi
ok "All images built and pushed"

# ---------------------------------------------------------------------------
# Step 4: Update image tags in the overlay
# ---------------------------------------------------------------------------
log "Updating kustomize image tags in overlay ${ENV}..."
cd "${OVERLAY_DIR}"

for svc in "${ALL_SERVICES[@]}"; do
  kustomize edit set image \
    "REGISTRY/${svc}=${ACR_LOGIN_SERVER}/${svc}:${TAG}" \
    2>/dev/null || echo "[WARN] Could not set image for ${svc} — may not be in images list"
done

ok "Kustomize images updated"

# ---------------------------------------------------------------------------
# Step 5: Apply manifests
# ---------------------------------------------------------------------------
NS="shield-${ENV}"
log "Applying manifests to namespace ${NS}..."
kustomize build "${OVERLAY_DIR}" | kubectl apply -f -
ok "Manifests applied"

# ---------------------------------------------------------------------------
# Step 6: Rollout status for critical services
# ---------------------------------------------------------------------------
log "Checking rollout status for gateway and auth..."
kubectl rollout status deployment/shield-gateway -n "${NS}" --timeout=180s || \
  echo "[WARN] gateway rollout did not complete within timeout"
kubectl rollout status deployment/shield-auth -n "${NS}" --timeout=180s || \
  echo "[WARN] auth rollout did not complete within timeout"

# ---------------------------------------------------------------------------
# Step 7: Pod status
# ---------------------------------------------------------------------------
echo ""
echo "=== Pod Status (${NS}) ==="
kubectl get pods -n "${NS}" --sort-by='.metadata.name'
echo ""
ok "Deploy complete — ENV=${ENV} TAG=${TAG}"
