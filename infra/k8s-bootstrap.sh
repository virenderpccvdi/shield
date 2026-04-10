#!/usr/bin/env bash
# infra/k8s-bootstrap.sh — Create K8s namespaces and secrets from .env
# Usage: ./infra/k8s-bootstrap.sh [shield-prod|shield-dev|both]
# Default: both
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
NAMESPACE_YAML="${PROJECT_ROOT}/k8s/base/namespace.yaml"

# Keys to extract from .env and inject into the K8s secret
SECRET_KEYS=(
  DB_URL
  DB_USERNAME
  DB_PASSWORD
  REDIS_HOST
  REDIS_PORT
  REDIS_PASSWORD
  JWT_SECRET
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  SMTP_HOST
  SMTP_PORT
  SMTP_USERNAME
  SMTP_PASSWORD
  SMTP_FROM
  ANTHROPIC_API_KEY
  DEEPSEEK_API_KEY
  GOOGLE_MAPS_API_KEY
  APP_DOMAIN
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { echo "[$(date '+%H:%M:%S')] $*"; }
warn() { echo "[WARN] $*" >&2; }
ok()   { echo "[OK] $*"; }

# Read a value from the .env file; return empty string if not found
read_env_key() {
  local key="$1"
  local value
  # Match KEY=value (strip inline comments, handle quoted values)
  value=$(grep -E "^${key}=" "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/[[:space:]]*#.*//' | sed "s/^['\"]//; s/['\"]$//")
  echo "${value}"
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
TARGET="${1:-both}"

case "${TARGET}" in
  shield-prod) NAMESPACES=("shield-prod") ;;
  shield-dev)  NAMESPACES=("shield-dev") ;;
  both)        NAMESPACES=("shield-prod" "shield-dev") ;;
  *)
    echo "Usage: $0 [shield-prod|shield-dev|both]"
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Validate prerequisites
# ---------------------------------------------------------------------------
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: .env file not found at ${ENV_FILE}"
  exit 1
fi

if ! kubectl version --client > /dev/null 2>&1; then
  echo "ERROR: kubectl not found or not configured"
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 1: Apply namespaces
# ---------------------------------------------------------------------------
log "Applying namespace manifest..."
kubectl apply -f "${NAMESPACE_YAML}"
ok "Namespaces applied"

# ---------------------------------------------------------------------------
# Step 2: Build --from-literal args from .env
# ---------------------------------------------------------------------------
log "Reading secrets from ${ENV_FILE}..."

LITERAL_ARGS=()
MISSING_KEYS=()

for key in "${SECRET_KEYS[@]}"; do
  value=$(read_env_key "${key}")

  # .env may use DB_USER / SMTP_USER / SMTP_PASS instead of DB_USERNAME etc.
  # Apply well-known aliases used in this project's .env
  if [[ -z "${value}" ]]; then
    case "${key}" in
      DB_USERNAME)   value=$(read_env_key "DB_USER") ;;
      SMTP_USERNAME) value=$(read_env_key "SMTP_USER") ;;
      SMTP_PASSWORD) value=$(read_env_key "SMTP_PASS") ;;
      DB_URL)
        # Build from components if DB_URL is not directly set
        db_host=$(read_env_key "DB_HOST")
        db_port=$(read_env_key "DB_PORT")
        db_name=$(read_env_key "DB_NAME")
        if [[ -n "${db_host}" ]]; then
          value="jdbc:postgresql://${db_host}:${db_port}/${db_name}"
        fi
        ;;
    esac
  fi

  if [[ -z "${value}" ]]; then
    warn "Key ${key} not found in .env — skipping"
    MISSING_KEYS+=("${key}")
  else
    LITERAL_ARGS+=("--from-literal=${key}=${value}")
  fi
done

if [[ ${#MISSING_KEYS[@]} -gt 0 ]]; then
  warn "Missing keys (will NOT be in secret): ${MISSING_KEYS[*]}"
fi

if [[ ${#LITERAL_ARGS[@]} -eq 0 ]]; then
  echo "ERROR: No secret keys found. Check .env file."
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 3: Create secret in each target namespace (idempotent)
# ---------------------------------------------------------------------------
for NS in "${NAMESPACES[@]}"; do
  log "Creating/updating shield-secrets in namespace ${NS}..."

  kubectl create secret generic shield-secrets \
    --namespace "${NS}" \
    "${LITERAL_ARGS[@]}" \
    --dry-run=client -o yaml \
  | kubectl apply -f -

  ok "shield-secrets applied in ${NS}"
done

# ---------------------------------------------------------------------------
# Step 4: Verify
# ---------------------------------------------------------------------------
echo ""
echo "=== Secret Verification ==="
for NS in "${NAMESPACES[@]}"; do
  log "Verifying secret in ${NS}..."
  kubectl get secret shield-secrets -n "${NS}" \
    --output custom-columns="NAME:.metadata.name,NAMESPACE:.metadata.namespace,KEYS:.data" \
    2>/dev/null || warn "Could not verify secret in ${NS}"
done

echo ""
ok "k8s-bootstrap complete for: ${NAMESPACES[*]}"
