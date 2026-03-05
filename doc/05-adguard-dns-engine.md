# 05 — AdGuard Home DNS Engine

## Overview

AdGuard Home is the **core DNS filtering engine** for Shield. It runs in Docker, provides DNS-over-HTTPS (DoH), DNS-over-TLS (DoT), and a REST API that the `shield-dns` service calls to apply per-child filtering rules.

AdGuard Home is used because:
- Free and open-source (GPL-3.0)
- Built-in DoH/DoT server (critical for following child on mobile 4G)
- DNS Client ID feature → route different clients to different rules
- REST API for programmatic rule management
- High-performance Go implementation

---

## Docker Setup

```yaml
# docker-compose.yml (snippet)
services:
  adguard:
    image: adguard/adguardhome:latest
    container_name: adguard
    restart: unless-stopped
    volumes:
      - ./adguard/work:/opt/adguardhome/work
      - ./adguard/conf:/opt/adguardhome/conf
      - /etc/letsencrypt/live/shield.rstglobal.in:/etc/letsencrypt/live/shield.rstglobal.in:ro
    ports:
      - "5353:53/udp"      # DNS for home router
      - "5353:53/tcp"
      - "4443:443/tcp"     # DoH endpoint
      - "853:853/tcp"      # DoT endpoint
      - "3080:3000/tcp"    # Admin UI (proxied by Nginx)
    networks:
      - shield-net
```

> **Port 53 Note:** Port 53 is reserved by `systemd-resolved` on Ubuntu 24.04. Use port 5353 externally and configure home routers to use port 5353, or configure `systemd-resolved` to stop listening on 53.
>
> For DoH on mobile devices — devices connect to `https://jake.dns.shield.rstglobal.in/dns-query` which Nginx proxies to AdGuard's port 4443.

---

## AdGuard Configuration Template

```yaml
# /var/www/ai/Shield/adguard/conf/AdGuardHome.yaml
http:
  address: 0.0.0.0:3000

dns:
  bind_hosts: [0.0.0.0]
  port: 53
  upstream_dns:
    - https://1.1.1.1/dns-query        # Cloudflare DoH
    - https://8.8.8.8/dns-query        # Google DoH
  bootstrap_dns:
    - 1.1.1.1
    - 8.8.8.8
  fallback_dns: []
  all_servers: false
  fastest_addr: true
  cache_size: 4194304                   # 4MB cache
  cache_ttl_min: 300
  cache_ttl_max: 86400

tls:
  enabled: true
  server_name: shield.rstglobal.in
  force_https: true
  port_https: 443
  port_dns_over_tls: 853
  certificate_chain: /etc/letsencrypt/live/shield.rstglobal.in/fullchain.pem
  private_key: /etc/letsencrypt/live/shield.rstglobal.in/privkey.pem

# Per-client rules are managed via REST API (not this config file)
clients:
  sources:
    - name: rdns
    - name: hosts
    - name: arp
  persistent: []    # Managed programmatically via DNS service
```

---

## DNS Client ID System — Per-Child DoH Subdomains

This is the key feature that makes per-child filtering work on mobile 4G.

### How DNS Client IDs Work

AdGuard Home identifies clients via:
1. **IP address** (works on home network)
2. **DNS-over-HTTPS subdomain** (works everywhere — home + 4G)

For Shield, each child gets a unique DoH URL:
```
https://jake-3f2a.dns.shield.rstglobal.in/dns-query
https://emma-7b1d.dns.shield.rstglobal.in/dns-query
```

Nginx routes `*.dns.shield.rstglobal.in` to AdGuard's DoH port. AdGuard extracts the subdomain (`jake-3f2a`) as the Client ID and applies that client's specific rules.

### Nginx Wildcard Config for DNS Subdomains

```nginx
# /etc/nginx/sites-enabled/shield-dns
server {
    listen 443 ssl http2;
    server_name *.dns.shield.rstglobal.in;

    ssl_certificate     /etc/letsencrypt/live/shield.rstglobal.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shield.rstglobal.in/privkey.pem;

    location /dns-query {
        proxy_pass https://127.0.0.1:4443;
        proxy_set_header Host $host;
        proxy_ssl_verify off;
    }
}
```

> **Wildcard SSL:** Requires `*.dns.shield.rstglobal.in` in the Let's Encrypt cert. Use Certbot with DNS-01 challenge:
> ```bash
> certbot certonly --dns-cloudflare \
>   -d "shield.rstglobal.in" \
>   -d "*.dns.shield.rstglobal.in"
> ```

### Setting Private DNS on Android (Per-Child)

On the child's Android device:
```
Settings → Network & Internet → Private DNS
→ Select "Private DNS provider hostname"
→ Enter: jake-3f2a.dns.shield.rstglobal.in
```

This routes **all DNS on the device** (home WiFi + mobile 4G) through Shield.

---

## AdGuard REST API — Used by DNS Service

The `shield-dns` service calls AdGuard Home's REST API on port 3080.

### Authentication

```bash
# AdGuard admin credentials stored in .env
ADGUARD_URL=http://localhost:3080
ADGUARD_USER=shield-api
ADGUARD_PASS=your-secure-password
```

All API calls use Basic Auth.

### Key API Calls

**1. Create a DNS Client (when child profile is created):**
```http
POST /control/clients/add
Content-Type: application/json

{
  "name": "Jake Smith (Profile ID: abc123)",
  "ids": ["jake-3f2a"],          // DNS Client ID (subdomain)
  "use_global_settings": false,
  "filtering_enabled": true,
  "safebrowsing_enabled": true,
  "parental_enabled": true,
  "safe_search": {
    "enabled": true,
    "google": true,
    "bing": true,
    "duckduckgo": true,
    "youtube": true
  },
  "blocked_services": ["youtube"],   // Apps that have hit their daily limit
  "tags": ["family-shield:profile:abc123"]
}
```

**2. Update client rules (when parent changes settings):**
```http
POST /control/clients/update
{
  "name": "Jake Smith (Profile ID: abc123)",
  "data": {
    "filtering_enabled": true,
    "blocked_services": ["youtube", "tiktok"],
    "tags": ["family-shield:profile:abc123"]
  }
}
```

**3. Add custom blocked domain to client:**
```http
POST /control/filtering/add_url
{
  "name": "Jake - Roblox block",
  "url": "||roblox.com^",           // AdGuard filter rule format
  "enabled": true
}
```

**4. Get query logs for a client:**
```http
GET /control/querylog?client_id=jake-3f2a&limit=100&offset=0
```

**5. Block a service (when time budget is reached):**
AdGuard Home has a built-in "Blocked Services" feature with pre-configured domain lists for 200+ services including YouTube, TikTok, Instagram, Gaming, etc.
```http
POST /control/clients/update
{
  "name": "...",
  "data": {
    "blocked_services": ["youtube", "tiktok", "instagram", "twitch"]
  }
}
```

---

## Blocklist Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     BLOCKLIST HIERARCHY                                 │
│                                                                         │
│  Level 1: GLOBAL (managed by Global Admin, applies to ALL)              │
│  ├── Malware: URLhaus, Abuse.ch, Malware Domains                       │
│  ├── CSAM: IWF hash list, NCMEC                                        │
│  ├── Phishing: PhishTank, Google Safe Browsing                         │
│  └── Cannot be overridden by anyone                                    │
│                                                                         │
│  Level 2: ISP TENANT (managed by ISP Admin, applies to ISP customers)  │
│  ├── Country-specific regulatory blocks                                │
│  ├── ISP custom blocks (competitors, crypto, etc.)                     │
│  └── Cannot be overridden by customers                                 │
│                                                                         │
│  Level 3: CUSTOMER (managed by parent)                                  │
│  ├── Content category enables/disables                                 │
│  ├── Custom allow list (whitelist overrides categories)                │
│  └── Custom block list (always blocked even if category allowed)       │
│                                                                         │
│  Level 4: AUTOMATED (system-managed, dynamic)                           │
│  ├── Time budget enforcement (block YouTube when limit reached)        │
│  ├── Schedule blocks (block all during bedtime)                        │
│  └── AI-flagged domains (parent review queue)                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Blocklist Sources (Auto-Updated Every 6 Hours)

| List Name | URL / Source | Category |
|-----------|-------------|----------|
| URLhaus | `https://urlhaus-filter.pages.dev/urlhaus-filter-agh.txt` | Malware |
| MalwareDomainList | `https://www.malwaredomainlist.com/hostslist/hosts.txt` | Malware |
| PhishTank | `https://phishtank.org/phish_download.php?format=text` | Phishing |
| AdGuard Base | `https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt` | Ads/Tracking |
| OISD Big | `https://big.oisd.nl/` | Ads/Malware/Phishing |
| HaGeZi Gambling | `https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/gambling.txt` | Gambling |
| HaGeZi Adult | `https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/porn.txt` | Adult |
| StevenBlack | `https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts` | Combined |

---

## Per-Child Rule Sync Flow

When a parent changes a child's settings in the app:

```
Parent taps "Block Gaming" in Flutter app
  → PATCH /api/v1/rules/{profileId}/categories {gaming: false}
  → Profile Service updates dns_rules table
  → DNS Service is notified (internal REST call from Profile Service)
  → DNS Service calls AdGuard REST API to update client's blocked_services
  → DNS Service invalidates Redis cache: dns-rules:{profileId}
  → Change takes effect immediately (next DNS query from child's device is filtered)
```

Real-time feedback to parent:
```
DNS query comes in from jake-3f2a → roblox.com
  → BLOCKED (gaming category)
  → AdGuard logs query
  → DNS Service Vector log pipeline picks up log entry
  → Publishes to Redis pub/sub: shield.dns.activity.{customerId}
  → WebSocket STOMP server pushes to parent app: /topic/activity/{profileId}
  → Parent app shows: "Jake tried to access roblox.com — BLOCKED"
```

---

## Schedule Enforcement

Schedules are implemented using AdGuard's "Schedule" feature per client:

```json
// AdGuard client schedule (embedded in client config)
// 24 hours × 7 days, 1 = internet off, 0 = internet on
{
  "schedule": {
    "time_zone": "Europe/London",
    "mon": [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,1],
    // 0am-7am = off (sleep), 8am-4pm = off (school), 5pm-10pm = on, 10pm-12am = off
    "tue": [...],
    "wed": [...],
    "thu": [...],
    "fri": [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1],
    "sat": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
    "sun": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1]
  }
}
```

The DNS Service syncs the schedule from the `dns.schedules` table to AdGuard whenever the parent saves changes.

---

## Vector Log Pipeline (AdGuard → Analytics)

```yaml
# /var/www/ai/Shield/infra/vector/vector.toml
[sources.adguard_logs]
type = "file"
include = ["/opt/adguardhome/work/data/querylog.json"]
read_from = "end"

[transforms.parse_adguard]
type = "remap"
inputs = ["adguard_logs"]
source = """
. = parse_json!(.message)
.profile_id = get_env_var!("PROFILE_" + string!(.ClientID))
.action = if .Result.IsFiltered { "BLOCKED" } else { "ALLOWED" }
.queried_at = now()
"""

[sinks.postgres_analytics]
type = "postgres"
inputs = ["parse_adguard"]
connection = "host=localhost port=5454 dbname=shield_db user=shield"
table = "analytics.dns_query_logs"
```
