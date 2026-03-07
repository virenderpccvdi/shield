#!/bin/bash
# =============================================================================
# Shield Platform — Build Script
# Usage: ./build.sh [all|java|dashboard|flutter|<service-name>]
# =============================================================================

BASE=/var/www/ai/FamilyShield
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $*"; }
ok()   { echo -e "  ${GREEN}✔${NC} $*"; }
fail() { echo -e "  ${RED}✘${NC} $*"; exit 1; }

TARGET=${1:-all}
cd "$BASE" || exit 1

case "$TARGET" in
  all)
    log "Building all Java microservices..."
    mvn -q package -DskipTests && ok "Java build complete" || fail "Java build FAILED"

    log "Building React dashboard..."
    cd "$BASE/shield-dashboard"
    npm run build --silent && cp -r dist/* "$BASE/shield-website/app/"
    ok "Dashboard deployed → shield-website/app/"

    if command -v flutter &>/dev/null; then
      log "Building Flutter APK..."
      cd "$BASE/shield-app"
      flutter build apk --debug --no-tree-shake-icons --quiet
      cp build/app/outputs/flutter-apk/app-debug.apk "$BASE/static/shield-app.apk"
      ok "Flutter APK → static/shield-app.apk"
    else
      echo "  (flutter not found — skipping APK)"
    fi
    echo -e "\n${GREEN}${BOLD}✅ All builds complete${NC}"
    ;;

  java)
    log "Building all Java microservices..."
    mvn -q package -DskipTests && ok "Java build complete" || fail "Java build FAILED"
    ;;

  dashboard)
    log "Building React dashboard..."
    cd "$BASE/shield-dashboard"
    npm run build && cp -r dist/* "$BASE/shield-website/app/"
    ok "Dashboard deployed → shield-website/app/"
    ;;

  flutter)
    log "Building Flutter APK..."
    cd "$BASE/shield-app"
    flutter build apk --debug --no-tree-shake-icons
    cp build/app/outputs/flutter-apk/app-debug.apk "$BASE/static/shield-app.apk"
    ok "APK → static/shield-app.apk ($(du -sh $BASE/static/shield-app.apk | cut -f1))"
    ;;

  shield-*)
    log "Building $TARGET..."
    mvn -pl "$TARGET" -am -q package -DskipTests && ok "$TARGET built" || fail "$TARGET build FAILED"
    log "Restarting $TARGET..."
    systemctl restart "$TARGET" 2>/dev/null && ok "$TARGET restarted" || echo "  (service not managed by systemd)"
    ;;

  *)
    echo "Usage: ./build.sh [all|java|dashboard|flutter|<service-name>]"
    echo ""
    echo "  all         — Build everything (Java + Dashboard + Flutter)"
    echo "  java        — Build all Java microservices only"
    echo "  dashboard   — Build React dashboard and deploy"
    echo "  flutter     — Build Flutter APK"
    echo "  shield-auth — Build one service and restart it"
    exit 1
    ;;
esac
