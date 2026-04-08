#!/usr/bin/env bash
# Shield Pre-Deploy QA Gate
# Runs fast critical-path tests before any deployment.
# Returns exit code 0 = safe to deploy, 1 = failures, 2 = critical failures.
#
# Usage:
#   ./pre_deploy_check.sh                   # fast gate (health+auth+dns+security)
#   ./pre_deploy_check.sh --standard        # standard gate (all core suites)
#   ./pre_deploy_check.sh --full            # full suite (takes ~5 min)

set -euo pipefail

QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$QA_DIR/logs/pre_deploy_$(date +%Y%m%d_%H%M%S).log"
PYTHON="${PYTHON:-python3}"

# Load .env if present
if [[ -f "$QA_DIR/../.env" ]]; then
    set -a
    source "$QA_DIR/../.env" 2>/dev/null || true
    set +a
fi

# Determine suite to run
MODE="${1:-}"
case "$MODE" in
    --standard) SUITES="health,auth,rbac,dns,analytics,billing,db,workflows,security" ;;
    --full)     SUITES="" ;;   # empty = all suites from config
    *)          SUITES="health,auth,dns,security" ;;  # default: fast gate
esac

echo "════════════════════════════════════════════════"
echo "  Shield Pre-Deploy QA Gate"
echo "  Mode: ${MODE:-fast}"
echo "  Started: $(date)"
echo "════════════════════════════════════════════════"

mkdir -p "$QA_DIR/logs"

# Build the command
CMD=("$PYTHON" "$QA_DIR/shield_qa_agent.py")
if [[ -n "$SUITES" ]]; then
    CMD+=("--suites" "$SUITES")
fi

# Run QA
set +e
"${CMD[@]}" 2>&1 | tee "$LOG_FILE"
EXIT_CODE=$?
set -e

echo "════════════════════════════════════════════════"
echo "  QA Gate Exit Code: $EXIT_CODE"
echo "  Log: $LOG_FILE"
echo "  Report: $QA_DIR/reports/qa_report_latest.html"
echo "════════════════════════════════════════════════"

if [[ $EXIT_CODE -eq 2 ]]; then
    echo "  ❌ CRITICAL FAILURES — DEPLOY BLOCKED"
    exit 2
elif [[ $EXIT_CODE -eq 1 ]]; then
    echo "  ⚠  PARTIAL FAILURES — Review report before deploying"
    exit 1
else
    echo "  ✅ ALL TESTS PASS — Safe to deploy"
    exit 0
fi
