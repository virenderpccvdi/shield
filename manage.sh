#!/bin/bash
# =============================================================================
# Shield Platform — Management Script
# Usage: ./manage.sh <command> [options]
# =============================================================================

BASE=/var/www/ai/FamilyShield
STATE_FILE=/var/lib/shield/scaler-state
LOG_DIR=/var/log/shield

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Service tiers (startup order) ─────────────────────────────────────────────
TIER1="shield-eureka shield-config shield-gateway shield-auth"
TIER2="shield-tenant shield-profile shield-dns shield-notification shield-admin"
TIER3="shield-location shield-rewards shield-analytics shield-ai"
ALL_SVCS="$TIER1 $TIER2 $TIER3"
DOCKER_SVCS="shield-adguard shield-prometheus shield-grafana shield-zipkin"

declare -A SVC_PORT=(
  [shield-eureka]=8261   [shield-config]=8288   [shield-gateway]=8280
  [shield-auth]=8281     [shield-tenant]=8282    [shield-profile]=8283
  [shield-dns]=8284      [shield-location]=8285  [shield-notification]=8286
  [shield-rewards]=8287  [shield-analytics]=8289 [shield-admin]=8290
  [shield-ai]=8291
)

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $*"; }
ok()   { echo -e "  ${GREEN}✔${NC} $*"; }
fail() { echo -e "  ${RED}✘${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $*"; }
sep()  { echo -e "${BLUE}────────────────────────────────────────────────────${NC}"; }

wait_up() {
  local svc=$1 port=$2 max=${3:-90} i=0
  while [ $i -lt $max ]; do
    if curl -sf "http://localhost:$port/actuator/health" 2>/dev/null | grep -q '"UP"'; then
      ok "$svc is UP (:$port)"; return 0
    fi
    [ $i -eq 0 ] && printf "  ${YELLOW}⏳${NC} Waiting for $svc"
    printf "."; sleep 3; i=$((i+3))
  done
  echo; warn "$svc not responding after ${max}s"
}

# ── start ─────────────────────────────────────────────────────────────────────
cmd_start() {
  local target=${1:-all}
  mkdir -p /var/lib/shield /var/log/shield
  echo -e "\n${BOLD}${GREEN}▶ Starting Shield Platform${NC} (target: $target)\n"

  log "Tier 1 — Eureka → Config → Gateway → Auth"
  systemctl start shield-eureka; sleep 6
  systemctl start shield-config; sleep 4
  systemctl start shield-gateway shield-auth
  wait_up shield-auth 8281
  echo "1" > "$STATE_FILE"
  [ "$target" = "tier1" ] && { echo; ok "Tier 1 ready"; return; }

  echo
  log "Tier 2 — Tenant, Profile, DNS, Notification, Admin"
  systemctl start shield-tenant shield-profile shield-dns shield-notification shield-admin
  wait_up shield-profile 8283 60
  echo "2" > "$STATE_FILE"
  [ "$target" = "tier2" ] && { echo; ok "Tier 2 ready"; return; }

  echo
  log "Tier 3 — Location, Rewards, Analytics, AI"
  systemctl start shield-location shield-rewards shield-analytics shield-ai
  sleep 8
  echo "3" > "$STATE_FILE"

  echo
  log "Docker containers..."
  for c in $DOCKER_SVCS; do
    docker start "$c" 2>/dev/null && ok "$c" || warn "$c not found"
  done

  echo; sep
  echo -e "${GREEN}${BOLD}✅ Shield Platform started${NC}"; sep
  sleep 2; cmd_status
}

# ── stop ──────────────────────────────────────────────────────────────────────
cmd_stop() {
  local target=${1:-all}
  echo -e "\n${BOLD}${RED}■ Stopping Shield Platform${NC}\n"

  log "Tier 3 — Location, Rewards, Analytics, AI"
  systemctl stop shield-ai shield-analytics shield-rewards shield-location 2>/dev/null
  ok "Tier 3 stopped"

  if [ "$target" != "tier3" ]; then
    log "Tier 2 — Admin, Notification, DNS, Profile, Tenant"
    systemctl stop shield-admin shield-notification shield-dns shield-profile shield-tenant 2>/dev/null
    ok "Tier 2 stopped"
  fi

  if [ "$target" = "all" ]; then
    log "Tier 1 — Auth, Gateway, Config, Eureka"
    systemctl stop shield-auth shield-gateway shield-config shield-eureka 2>/dev/null
    ok "Tier 1 stopped"
    log "Docker containers..."
    for c in $DOCKER_SVCS; do docker stop "$c" 2>/dev/null; done
    ok "Docker stopped"
    echo "0" > "$STATE_FILE" 2>/dev/null
  fi

  echo; ok "Shield Platform stopped"
}

# ── restart ───────────────────────────────────────────────────────────────────
cmd_restart() {
  local svc=${1:-all}
  if [ "$svc" = "all" ]; then
    cmd_stop all; sleep 3; cmd_start all
  else
    log "Restarting $svc..."
    systemctl restart "$svc" && ok "$svc restarted" || fail "Failed to restart $svc"
  fi
}

# ── status ────────────────────────────────────────────────────────────────────
cmd_status() {
  local tier=$(cat "$STATE_FILE" 2>/dev/null || echo "?")
  local load=$(awk '{print $1" "$2" "$3}' /proc/loadavg)
  local mem_used=$(free -m | awk 'NR==2{print $3}')
  local mem_total=$(free -m | awk 'NR==2{print $2}')
  local mem_pct=$(( mem_used * 100 / mem_total ))
  local slice_mb="N/A"
  [ -f /sys/fs/cgroup/shield.slice/memory.current ] && \
    slice_mb="$(( $(cat /sys/fs/cgroup/shield.slice/memory.current) / 1024 / 1024 ))MB"

  echo
  echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗"
  echo -e "║          Shield Platform — Status Dashboard              ║"
  echo -e "╚══════════════════════════════════════════════════════════╝${NC}"
  echo
  printf "  ${BOLD}Tier :${NC} %s    ${BOLD}Load :${NC} %s\n" "$tier" "$load"
  printf "  ${BOLD}RAM  :${NC} %s/%sMB (%s%%)    ${BOLD}Shield Slice :${NC} %s\n" \
         "$mem_used" "$mem_total" "$mem_pct" "$slice_mb"
  echo; sep
  printf "  ${BOLD}%-30s %-10s %-6s %s${NC}\n" "Service" "Status" "Port" "Health"
  sep

  local t=1
  for svc in $ALL_SVCS; do
    [ "$svc" = "shield-tenant"   ] && t=2
    [ "$svc" = "shield-location" ] && t=3
    local st=$(systemctl is-active "$svc" 2>/dev/null)
    local port=${SVC_PORT[$svc]}
    if [ "$st" = "active" ]; then
      if [ "$port" = "8291" ]; then
        h=$(curl -sf "http://localhost:$port/" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print('UP' if d.get('status')=='running' else 'UP')" 2>/dev/null || echo "?")
      else
        h=$(curl -sf "http://localhost:$port/actuator/health" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "?")
      fi
      [ "$h" = "UP" ] && hc=$GREEN || hc=$YELLOW
      printf "  ${GREEN}●${NC} %-28s T%s  %-10s :%-6s ${hc}%s${NC}\n" "$svc" "$t" "running" "$port" "$h"
    else
      printf "  ${RED}○${NC} %-28s T%s  %-10s :%-6s ${RED}---${NC}\n" "$svc" "$t" "$st" "$port"
    fi
  done

  sep
  for c in $DOCKER_SVCS; do
    local cs=$(docker inspect --format='{{.State.Status}}' "$c" 2>/dev/null || echo "not found")
    [ "$cs" = "running" ] \
      && echo -e "  ${GREEN}●${NC} $c  ${GREEN}running${NC}" \
      || echo -e "  ${RED}○${NC} $c  ${RED}$cs${NC}"
  done
  sep
  echo -e "  Scaler: $(systemctl is-active shield-scaler.timer 2>/dev/null)  |  Backup: $(systemctl is-active shield-db-backup.timer 2>/dev/null)"
  echo -e "  Web: https://shield.rstglobal.in  |  App: https://shield.rstglobal.in/app/"
  echo
}

# ── health ────────────────────────────────────────────────────────────────────
cmd_health() {
  echo -e "\n${BOLD}Health Checks${NC}\n"
  local all_ok=true
  for svc in $ALL_SVCS; do
    local port=${SVC_PORT[$svc]}
    if [ "$port" = "8291" ]; then
      r=$(curl -sf "http://localhost:$port/" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print('UP' if d.get('status')=='running' else '?')" 2>/dev/null)
    else
      r=$(curl -sf "http://localhost:$port/actuator/health" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)['status'])" 2>/dev/null)
    fi
    [ "$r" = "UP" ] && ok "$svc (:$port)" || { fail "$svc (:$port) — ${r:-DOWN}"; all_ok=false; }
  done
  echo
  $all_ok && echo -e "${GREEN}${BOLD}All services healthy ✔${NC}" \
           || warn "Some services down — check: ./manage.sh logs <service>"
}

# ── logs ──────────────────────────────────────────────────────────────────────
cmd_logs() {
  local svc=${1:-shield-gateway}
  log "Tailing $svc logs (Ctrl+C to stop)..."
  journalctl -u "$svc" -f --no-pager -n 50
}

# ── scale ─────────────────────────────────────────────────────────────────────
cmd_scale() {
  case "$1" in
    up)
      log "Scale UP → Tier 3, 16GB / 6 cores"
      systemctl set-property shield.slice MemoryMax=16G CPUQuota=600% 2>/dev/null
      systemctl start shield-location shield-rewards shield-analytics shield-ai 2>/dev/null
      echo "3" > "$STATE_FILE"
      ok "Scaled to Tier 3 (16GB / 6 cores)"
      ;;
    down)
      log "Scale DOWN → Tier 2, 8GB / 2 cores"
      systemctl stop shield-location shield-rewards shield-analytics shield-ai 2>/dev/null
      systemctl set-property shield.slice MemoryMax=8G CPUQuota=200% 2>/dev/null
      echo "2" > "$STATE_FILE"
      ok "Scaled to Tier 2 (8GB / 2 cores)"
      ;;
    min)
      log "Minimum → Tier 1, 4GB / 1 core"
      systemctl stop shield-location shield-rewards shield-analytics shield-ai 2>/dev/null
      systemctl stop shield-admin shield-notification shield-dns shield-profile shield-tenant 2>/dev/null
      systemctl set-property shield.slice MemoryMax=4G CPUQuota=100% 2>/dev/null
      echo "1" > "$STATE_FILE"
      ok "Minimum mode (4GB / 1 core)"
      ;;
    *)
      echo "Usage: manage.sh scale [up|down|min]"
      echo "  up  — Tier 3, 16GB/6 cores"
      echo "  down — Tier 2, 8GB/2 cores (default)"
      echo "  min — Tier 1 only, 4GB/1 core"
      ;;
  esac
}

# ── build ─────────────────────────────────────────────────────────────────────
cmd_build() {
  local svc=${1:-all}
  cd "$BASE" || exit 1
  case "$svc" in
    all)
      log "Building all Java services..."
      mvn -q package -DskipTests && ok "All services built" || { fail "Build FAILED"; exit 1; }
      ;;
    dashboard)
      log "Building React dashboard..."
      cd "$BASE/shield-dashboard"
      npm run build && cp -r dist/* "$BASE/shield-website/app/" && ok "Dashboard deployed"
      ;;
    flutter)
      log "Building Flutter APK..."
      cd "$BASE/shield-app"
      flutter build apk --debug --no-tree-shake-icons --quiet
      cp build/app/outputs/flutter-apk/app-debug.apk "$BASE/static/shield-app.apk"
      ok "APK → static/shield-app.apk"
      ;;
    *)
      log "Building $svc..."
      mvn -pl "$svc" -am -q package -DskipTests && ok "$svc built" || { fail "$svc FAILED"; exit 1; }
      log "Restarting $svc..."
      systemctl restart "$svc" 2>/dev/null && ok "$svc restarted"
      ;;
  esac
}

# ── resources ─────────────────────────────────────────────────────────────────
cmd_resources() {
  echo -e "\n${BOLD}Resource Usage${NC}\n"; sep
  printf "  CPU : %s cores    Load: %s\n" "$(nproc)" "$(awk '{print $1" "$2" "$3}' /proc/loadavg)"
  free -h | awk 'NR==2{printf "  RAM : %s used / %s total\n",$3,$2}'
  df -h / | awk 'NR==2{printf "  Disk: %s used / %s total\n",$3,$2}'
  sep
  if [ -f /sys/fs/cgroup/shield.slice/memory.current ]; then
    local used=$(( $(cat /sys/fs/cgroup/shield.slice/memory.current) / 1024 / 1024 ))
    local max_raw=$(cat /sys/fs/cgroup/shield.slice/memory.max 2>/dev/null)
    [[ "$max_raw" =~ ^[0-9]+$ ]] && max="$(( max_raw/1024/1024 ))MB" || max="unlimited"
    printf "  Shield Slice RAM : %sMB / %s\n" "$used" "$max"
    printf "  Shield Slice CPU : %s\n" "$(cat /sys/fs/cgroup/shield.slice/cpu.max 2>/dev/null)"
  fi
  sep
  echo -e "  ${BOLD}Per-Service RAM (RSS)${NC}"
  for svc in $ALL_SVCS; do
    local pid=$(systemctl show -p MainPID "$svc" 2>/dev/null | cut -d= -f2)
    if [ -n "$pid" ] && [ "$pid" != "0" ] && [ -f "/proc/$pid/status" ]; then
      local rss=$(awk '/VmRSS/{print $2}' "/proc/$pid/status" 2>/dev/null)
      printf "  %-30s %sMB\n" "$svc" "$(( ${rss:-0} / 1024 ))"
    else
      printf "  %-30s not running\n" "$svc"
    fi
  done
  sep
  echo "  Scaler log (last 5 lines):"
  tail -5 "$LOG_DIR/scaler.log" 2>/dev/null | while read line; do echo "    $line"; done
  echo
}

# ── backup ────────────────────────────────────────────────────────────────────
cmd_backup() {
  mkdir -p /var/backups/shield/daily
  local file="/var/backups/shield/daily/shield_db_$(date +%Y%m%d_%H%M%S).sql.gz"
  log "Backing up database → $file"
  source "$BASE/.env" 2>/dev/null
  PGPASSWORD="${DB_PASSWORD}" pg_dump -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5454}" -U "${DB_USER:-shield}" "${DB_NAME:-shield_db}" | gzip > "$file"
  ok "Backup complete"; ls -lh /var/backups/shield/daily/ | tail -5
}

# ── docker ────────────────────────────────────────────────────────────────────
cmd_docker() {
  case "${1:-status}" in
    start)  docker start $DOCKER_SVCS 2>/dev/null ;;
    stop)   docker stop  $DOCKER_SVCS 2>/dev/null ;;
    status) docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "NAME|shield" ;;
    *)      echo "Usage: manage.sh docker [start|stop|status]" ;;
  esac
}

# ── help ──────────────────────────────────────────────────────────────────────
cmd_help() {
  echo -e "
${BOLD}${CYAN}Shield Platform — Management Script${NC}

${BOLD}USAGE:${NC}  ./manage.sh <command> [options]

${BOLD}COMMANDS:${NC}
  ${GREEN}start${NC}   [tier1|tier2|tier3|all]     Start services in tier order
  ${RED}stop${NC}    [tier1|tier2|tier3|all]     Stop services gracefully
  ${YELLOW}restart${NC} [service|all]               Restart one or all services

  ${CYAN}status${NC}                              Live status dashboard
  ${CYAN}health${NC}                              Health check all services
  ${CYAN}resources${NC}                           CPU/RAM usage per service
  ${CYAN}logs${NC}    <service>                   Tail logs (Ctrl+C to exit)

  ${BLUE}scale${NC}   [up|down|min]               Manual resource scaling
  ${BLUE}build${NC}   [service|dashboard|flutter|all]  Build and restart
  ${BLUE}docker${NC}  [start|stop|status]         Manage Docker containers
  ${BLUE}backup${NC}                              Manual database backup

${BOLD}TIERS:${NC}
  T1 Core:     shield-eureka  shield-config  shield-gateway  shield-auth
  T2 Standard: shield-tenant  shield-profile shield-dns  shield-notification  shield-admin
  T3 Heavy:    shield-location shield-rewards shield-analytics  shield-ai

${BOLD}EXAMPLES:${NC}
  ./manage.sh start all            Start everything (8GB baseline)
  ./manage.sh start tier1          Start core only (~2GB)
  ./manage.sh stop all             Stop all gracefully
  ./manage.sh restart shield-auth  Restart one service
  ./manage.sh scale up             Scale to 16GB / 6 cores (peak)
  ./manage.sh scale down           Back to 8GB / 2 cores
  ./manage.sh build shield-admin   Build + restart admin service
  ./manage.sh build dashboard      Build & deploy React dashboard
  ./manage.sh logs shield-gateway  Tail gateway logs
  ./manage.sh resources            Show RAM per service
"
}

# ── Router ────────────────────────────────────────────────────────────────────
case "${1:-help}" in
  start)     cmd_start   "$2" ;;
  stop)      cmd_stop    "$2" ;;
  restart)   cmd_restart "$2" ;;
  status)    cmd_status      ;;
  health)    cmd_health      ;;
  logs)      cmd_logs    "$2" ;;
  scale)     cmd_scale   "$2" ;;
  build)     cmd_build   "$2" ;;
  resources) cmd_resources   ;;
  backup)    cmd_backup      ;;
  docker)    cmd_docker  "$2" ;;
  help|--help|-h) cmd_help  ;;
  *)
    echo -e "${RED}Unknown command: $1${NC}"
    cmd_help; exit 1
    ;;
esac
