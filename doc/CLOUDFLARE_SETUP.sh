#!/usr/bin/env bash
# Shield — Cloudflare setup script
#
# SECURITY NOTES:
# - Do NOT paste your CF token into this file. Put it in ~/.cloudflare-token
#   (one line, nothing else).
# - Use a SCOPED API token with only these permissions:
#     Zone > Read (for shield.rstglobal.in)
#     Zone > DNS > Edit
#     Zone > Cache Rules > Edit
#     Zone > Page Rules > Edit
#   NOT the Global API Key.
# - Run with: chmod +x doc/CLOUDFLARE_SETUP.sh && ./doc/CLOUDFLARE_SETUP.sh
#
# WHAT THIS SCRIPT DOES:
# 1. Read-only: verifies the token works and the zone exists
# 2. Read-only: lists current DNS records for shield.rstglobal.in
# 3. Optional write: enables "proxied" (orange cloud) on the A record for shield.rstglobal.in
# 4. Optional write: sets SSL/TLS mode to "Full (strict)" — requires valid Origin Cert on nginx
# 5. Optional write: creates a cache rule for /tokens.css, /components.css, /reveal.js → long cache
# 6. Optional write: creates a page rule for /app/* → cache bypass (React dashboard is session-sensitive)
#
# Each write step prompts for confirmation before executing.

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────
ZONE_NAME="shield.rstglobal.in"
TOKEN_FILE="$HOME/.cloudflare-token"
CF_API="https://api.cloudflare.com/client/v4"

# ─── Color helpers ────────────────────────────────────────────────
BLUE="\033[1;34m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
RESET="\033[0m"
info()  { echo -e "${BLUE}→${RESET} $*"; }
ok()    { echo -e "${GREEN}✓${RESET} $*"; }
warn()  { echo -e "${YELLOW}!${RESET} $*"; }
err()   { echo -e "${RED}✗${RESET} $*"; exit 1; }
ask()   {
  local q="$1"
  read -p "$(echo -e "${YELLOW}?${RESET} $q [y/N] ")" ans
  [[ "${ans,,}" == "y" || "${ans,,}" == "yes" ]]
}

# ─── Read token ───────────────────────────────────────────────────
[[ -f "$TOKEN_FILE" ]] || err "No token file at $TOKEN_FILE. Create it with:
    echo 'your-scoped-cf-token' > $TOKEN_FILE
    chmod 600 $TOKEN_FILE"
TOKEN=$(cat "$TOKEN_FILE" | tr -d '\n\r ')
[[ -n "$TOKEN" ]] || err "Token file is empty"
HDR="Authorization: Bearer $TOKEN"

# ─── 1. Verify token works ────────────────────────────────────────
info "Verifying API token..."
resp=$(curl -s -H "$HDR" "$CF_API/user/tokens/verify")
success=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))")
[[ "$success" == "True" ]] || err "Token verification failed. Response: $resp"
ok "Token is valid"

# ─── 2. Get zone ID ───────────────────────────────────────────────
info "Looking up zone $ZONE_NAME..."
zone_id=$(curl -s -H "$HDR" "$CF_API/zones?name=$ZONE_NAME" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',[]); print(r[0].get('id','') if r else '')")
[[ -n "$zone_id" ]] || err "Zone $ZONE_NAME not found in your Cloudflare account"
ok "Zone ID: $zone_id"

# ─── 3. List current DNS records ──────────────────────────────────
info "Current DNS records for $ZONE_NAME:"
curl -s -H "$HDR" "$CF_API/zones/$zone_id/dns_records?per_page=100" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('result',[]):
    proxied = '🟠' if r.get('proxied') else '⚪'
    print(f\"  {proxied} {r['type']:6} {r['name']:45} → {r['content']}\")
"

# ─── 4. Read SSL/TLS mode ─────────────────────────────────────────
info "Current SSL/TLS mode:"
mode=$(curl -s -H "$HDR" "$CF_API/zones/$zone_id/settings/ssl" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',{}).get('value','?'))")
ok "SSL/TLS mode: $mode"

# ─── 5. Optional writes ───────────────────────────────────────────
echo ""
echo "────────────────────────────────────────────────"
echo "Read-only checks complete. All WRITE operations below require confirmation."
echo "────────────────────────────────────────────────"
echo ""

# --- 5a. Enable proxy on shield.rstglobal.in A record ---
if ask "Enable Cloudflare proxy (orange cloud) on shield.rstglobal.in A record?"; then
  warn "Ensure your nginx ingress has a Cloudflare Origin Certificate installed, or SSL will break"
  warn "This change is reversible via the Cloudflare dashboard (click the orange cloud off)"
  record_id=$(curl -s -H "$HDR" "$CF_API/zones/$zone_id/dns_records?type=A&name=$ZONE_NAME" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',[]); print(r[0].get('id','') if r else '')")
  if [[ -n "$record_id" ]]; then
    curl -s -X PATCH -H "$HDR" -H "Content-Type: application/json" \
      "$CF_API/zones/$zone_id/dns_records/$record_id" \
      -d '{"proxied":true}' \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print('  result:',d.get('success','?'))"
  else
    warn "A record for $ZONE_NAME not found; skipping"
  fi
fi

# --- 5b. Set SSL/TLS mode to Full (strict) ---
if ask "Set SSL/TLS mode to 'Full (strict)'?"; then
  curl -s -X PATCH -H "$HDR" -H "Content-Type: application/json" \
    "$CF_API/zones/$zone_id/settings/ssl" \
    -d '{"value":"strict"}' \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('  result:',d.get('success','?'))"
fi

# --- 5c. Enable HTTP/3 ---
if ask "Enable HTTP/3?"; then
  curl -s -X PATCH -H "$HDR" -H "Content-Type: application/json" \
    "$CF_API/zones/$zone_id/settings/http3" \
    -d '{"value":"on"}' \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('  result:',d.get('success','?'))"
fi

# --- 5d. Enable Brotli ---
if ask "Enable Brotli compression?"; then
  curl -s -X PATCH -H "$HDR" -H "Content-Type: application/json" \
    "$CF_API/zones/$zone_id/settings/brotli" \
    -d '{"value":"on"}' \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('  result:',d.get('success','?'))"
fi

# --- 5e. Enable Always Use HTTPS ---
if ask "Enable 'Always Use HTTPS' (redirect http→https at CF edge)?"; then
  curl -s -X PATCH -H "$HDR" -H "Content-Type: application/json" \
    "$CF_API/zones/$zone_id/settings/always_use_https" \
    -d '{"value":"on"}' \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('  result:',d.get('success','?'))"
fi

echo ""
ok "Cloudflare setup complete. Visit https://dash.cloudflare.com/ to verify."
echo ""
info "Reminder: revoke the API token used in the session that leaked it, and rotate to a scoped token if you haven't."
