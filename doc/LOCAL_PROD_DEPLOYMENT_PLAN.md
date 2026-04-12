# Shield — Local Server Production Deployment Plan

**Server:** `apps` (103.93.94.120)
**Specs:** 8-core Xeon Platinum, 62 GB RAM, 490 GB disk, Ubuntu 24.04
**Current state:** All 15 Shield services running via systemd (5.4 GB RAM, 22% CPU)
**Date:** 2026-04-12

---

## Phase 1: DNS Migration (5 min, zero downtime)

### 1.1 Update DNS records
Point both domains to the local server IP:

| Record | Type | Value | TTL |
|---|---|---|---|
| `shield.rstglobal.in` | A | `103.93.94.120` | 300 |
| `api.shield.rstglobal.in` | A | `103.93.94.120` | 300 |

**Status:** User has confirmed DNS mapped to 103.93.94.120.

### 1.2 Verify SSL certificates
```bash
# Existing Let's Encrypt cert — valid until 2026-06-02
sudo certbot certificates --cert-name shield.rstglobal.in
```

If `api.shield.rstglobal.in` needs a separate cert:
```bash
sudo certbot --nginx -d api.shield.rstglobal.in
```

---

## Phase 2: Nginx Configuration (15 min)

### 2.1 Update `/etc/nginx/sites-available/shield.rstglobal.in`

The existing config already has most of the proxy rules. Key additions needed:

```nginx
# api.shield.rstglobal.in → gateway
server {
    listen 443 ssl http2;
    server_name api.shield.rstglobal.in;

    ssl_certificate     /etc/letsencrypt/live/shield.rstglobal.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shield.rstglobal.in/privkey.pem;

    # CORS for dashboard at shield.rstglobal.in
    add_header Access-Control-Allow-Origin "https://shield.rstglobal.in" always;
    add_header Access-Control-Allow-Methods "GET,POST,PUT,PATCH,DELETE,OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type,Authorization,X-Tenant-Id,X-Correlation-ID" always;
    add_header Access-Control-Allow-Credentials "true" always;
    add_header Access-Control-Expose-Headers "Authorization,X-Total-Count,X-Total-Pages,X-Correlation-ID" always;

    location / {
        proxy_pass http://127.0.0.1:8280;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# shield.rstglobal.in → website + dashboard
server {
    listen 443 ssl http2;
    server_name shield.rstglobal.in;

    ssl_certificate     /etc/letsencrypt/live/shield.rstglobal.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shield.rstglobal.in/privkey.pem;

    root /var/www/ai/FamilyShield/shield-website;
    index index.html;

    # React dashboard at /app/
    location = /app/index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        try_files $uri /app/index.html;
    }
    location ~* /app/assets/.*\.(js|css|woff2?|ttf|eot|svg|png|jpg|ico)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    location /app/ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        try_files $uri $uri/ /app/index.html;
    }

    # APK download
    location /download/ {
        add_header Content-Type "application/vnd.android.package-archive";
        add_header Content-Disposition 'attachment; filename="shield-app.apk"';
        alias /var/www/ai/FamilyShield/static/;
    }

    # API proxy (so login.html relative URLs work too)
    location /api/ {
        proxy_pass http://127.0.0.1:8280;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Design system CSS — long cache
    location = /tokens.css { add_header Cache-Control "public, max-age=31536000"; }
    location = /components.css { add_header Cache-Control "public, max-age=31536000"; }

    # Static pages
    location / {
        try_files $uri $uri/ =404;
    }

    error_page 404 /404.html;
    location = /404.html { internal; }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_min_length 512;
}
```

### 2.2 Apply and test
```bash
sudo nginx -t
sudo systemctl reload nginx
curl -sk https://shield.rstglobal.in/
curl -sk https://api.shield.rstglobal.in/actuator/health
```

---

## Phase 3: Deploy Redesigned Website + Dashboard (20 min)

### 3.1 Build React dashboard with correct API URL
```bash
cd /var/www/ai/FamilyShield/shield-dashboard
npm install --prefer-offline
VITE_API_URL=https://api.shield.rstglobal.in \
VITE_GOOGLE_MAPS_API_KEY=AIzaSyDXazeaKnjxYsnwE-Vb-gfapzhr566mo2M \
npm run build
```

### 3.2 Deploy dashboard to website directory
```bash
rm -rf /var/www/ai/FamilyShield/shield-website/app/assets
cp -r /var/www/ai/FamilyShield/shield-dashboard/dist/assets \
      /var/www/ai/FamilyShield/shield-website/app/assets
cp /var/www/ai/FamilyShield/shield-dashboard/dist/index.html \
   /var/www/ai/FamilyShield/shield-website/app/index.html
cp /var/www/ai/FamilyShield/shield-dashboard/dist/shield.svg \
   /var/www/ai/FamilyShield/shield-website/app/shield.svg 2>/dev/null || true
echo "Dashboard deployed: $(ls shield-website/app/assets/ | wc -l) chunks"
```

### 3.3 Verify
```bash
curl -s https://shield.rstglobal.in/ | head -5
curl -s https://shield.rstglobal.in/login.html | grep -c "tokens.css"
curl -s https://api.shield.rstglobal.in/actuator/health
curl -s -X POST https://api.shield.rstglobal.in/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@rstglobal.in","password":"Shield@Admin2026#"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅' if d.get('data',{}).get('accessToken') else '❌')"
```

---

## Phase 4: CI/CD Pipeline — Local Server (GitHub Actions + self-hosted runner)

### 4.1 Architecture

```
Developer → git push main → GitHub Actions
                               │
                    ┌───────────┼──────────────┐
                    │           │              │
              Quality Gate  Security Scan   Build + Deploy
              (lint, type,  (CodeQL, Trivy, (Maven, npm,
               deps, Docker) Gitleaks)       Flutter)
                    │           │              │
                    └───────────┴──────┬───────┘
                                       │
                              Self-hosted runner
                              (this server: 103.93.94.120)
                                       │
                              ┌────────┴────────┐
                              │ Build artifacts  │
                              │ - Java JARs      │
                              │ - Dashboard dist/ │
                              │ - APK             │
                              └────────┬────────┘
                                       │
                              ┌────────┴────────┐
                              │ Deploy locally   │
                              │ - Copy JARs      │
                              │ - Restart systemd │
                              │ - Copy dashboard  │
                              │ - Copy APK        │
                              └─────────────────┘
```

### 4.2 GitHub Actions workflow: `.github/workflows/deploy-local.yml`

```yaml
name: Shield Local Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-local
  cancel-in-progress: true

jobs:
  quality-gate:
    # Existing quality-gate.yml checks (lint, type, deps, Docker)
    uses: ./.github/workflows/quality-gate.yml

  security-scan:
    # Existing security scans
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: github/codeql-action/init@v4
        with:
          languages: java, javascript, python
      - uses: github/codeql-action/analyze@v4

  build-and-deploy:
    needs: [quality-gate]
    runs-on: self-hosted  # This server IS the runner
    steps:
      - uses: actions/checkout@v6

      # ── Maven build ──
      - name: Build all Java services
        run: |
          export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
          mvn package -DskipTests -q --no-transfer-progress

      # ── Deploy JARs + restart services ──
      - name: Deploy Java services
        run: |
          SERVICES="eureka config gateway auth tenant profile dns dns-resolver location notification rewards analytics admin"
          for svc in $SERVICES; do
            JAR=$(ls shield-$svc/target/shield-$svc-*.jar 2>/dev/null | head -1)
            if [ -f "$JAR" ]; then
              cp "$JAR" /var/www/ai/FamilyShield/shield-$svc/target/
              sudo systemctl restart shield-$svc
              echo "✅ shield-$svc deployed + restarted"
            fi
          done

      # ── Build + deploy dashboard ──
      - name: Build React dashboard
        run: |
          cd shield-dashboard
          npm install --prefer-offline
          VITE_API_URL=https://api.shield.rstglobal.in \
          VITE_GOOGLE_MAPS_API_KEY=AIzaSyDXazeaKnjxYsnwE-Vb-gfapzhr566mo2M \
          npm run build

      - name: Deploy dashboard
        run: |
          rm -rf /var/www/ai/FamilyShield/shield-website/app/assets
          cp -r shield-dashboard/dist/assets /var/www/ai/FamilyShield/shield-website/app/assets
          cp shield-dashboard/dist/index.html /var/www/ai/FamilyShield/shield-website/app/index.html

      # ── Build + deploy APK ──
      - name: Build Flutter APK
        run: |
          export PATH="/opt/flutter/bin:$PATH"
          cd shield-app && flutter pub get
          flutter build apk --debug --no-tree-shake-icons

      - name: Deploy APK
        run: |
          cp shield-app/build/app/outputs/flutter-apk/app-debug.apk \
             /var/www/ai/FamilyShield/static/shield-app.apk

      # ── Smoke test ──
      - name: Smoke test
        run: |
          sleep 30  # Wait for services to start
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.shield.rstglobal.in/actuator/health)
          if [ "$STATUS" = "200" ]; then
            echo "✅ Gateway healthy"
          else
            echo "⚠️ Gateway returned $STATUS"
          fi
```

### 4.3 Security scanning (already in place)

These GitHub Actions workflows already run on every push:

| Workflow | File | What it does |
|---|---|---|
| **CodeQL** | `.github/workflows/codeql.yml` | Scans Java, JS, Python for vulnerabilities |
| **Trivy** | `.github/workflows/trivy.yml` | Scans Docker images, filesystem, IaC |
| **Quality Gate** | `.github/workflows/quality-gate.yml` | Lint, type check, dependency audit, Dockerfile lint |
| **Shield QA** | `.github/workflows/qa.yml` | API integration tests |

---

## Phase 5: Monitoring + Backup (30 min)

### 5.1 Monitoring (already running)
- **Grafana** at smarttrack-grafana container → extend dashboards for Shield
- **Systemd journal** for service logs: `journalctl -u shield-gateway -f`
- **Prometheus** (if installed) or add basic health checks

### 5.2 Automated health check
```bash
# /var/www/ai/FamilyShield/scripts/health-check.sh
#!/bin/bash
SERVICES="eureka:8261 config:8288 gateway:8280 auth:8281 tenant:8282 profile:8283 dns:8284 dns-resolver:8292 location:8285 notification:8286 rewards:8287 analytics:8289 admin:8290 ai:8291"
for svc in $SERVICES; do
  name=${svc%%:*}; port=${svc##*:}
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/actuator/health" --max-time 5)
  if [ "$status" != "200" ]; then
    echo "$(date) ALERT: shield-$name is DOWN (HTTP $status)" >> /var/log/shield-health.log
    sudo systemctl restart shield-$name
  fi
done
```

Add to crontab: `* * * * * /var/www/ai/FamilyShield/scripts/health-check.sh`

### 5.3 Database backup (already configured)
- `shield-backup.timer` runs daily at 2:00 AM
- `shield-db-backup.timer` also at 2:00 AM
- PostgreSQL Patroni HA: primary + replica on the same server

---

## Phase 6: Scale Down Azure (save ₹17,465/month)

### 6.1 Scale AKS to 0 nodes
```bash
az aks nodepool update \
  --cluster-name shield-aks \
  --resource-group shield-rg \
  --name system \
  --node-count 0
```

**Note:** AKS with 0 nodes still charges for the control plane if on Standard tier. The current Base/Free tier = ₹0 for control plane.

### 6.2 Stop managed services (optional — reduces cost further)
```bash
# Stop PostgreSQL (saves ~₹1,250/mo)
az postgres flexible-server stop --resource-group shield-rg --name shield-pg-prod

# Stop Redis (saves ~₹1,250/mo)
az redis update --resource-group shield-rg --name shield-redis-prod --sku Basic --vm-size c0
# Note: can't stop Redis, but Basic C0 is already cheapest
```

### 6.3 Remaining Azure costs after scale-down
| Resource | Monthly |
|---|---|
| AKS control plane (Free) | ₹0 |
| ACR Basic (keep for images) | ₹420 |
| PostgreSQL (stopped) | ₹0 |
| Redis Basic (keep running for backup) | ₹1,250 |
| **TOTAL** | **~₹1,670/mo** (was ₹17,465) |

**Savings: ₹15,795/month = ₹1,89,540/year**

---

## Phase 7: Cloudflare (free CDN + DDoS + caching)

### 7.1 Setup
1. Add `rstglobal.in` zone to Cloudflare dashboard
2. Update nameservers at domain registrar
3. Enable proxy (orange cloud) on `shield.rstglobal.in` and `api.shield.rstglobal.in`
4. Enable: Brotli, HTTP/3, Always HTTPS, Auto Minify, TLS 1.2 minimum

### 7.2 Benefits (free tier)
- Global CDN for static assets
- DDoS protection
- WAF basic rules
- Caching (offloads nginx)
- SSL/TLS at edge
- Analytics

---

## Cost summary

| Scenario | Monthly cost |
|---|---|
| **Current (Azure only)** | ₹17,465 |
| **Local server + Azure backup** | ₹1,670 |
| **Local server + Azure stopped** | ₹420 (ACR only) |
| **Local server only (no Azure)** | ₹0 extra |

---

## Execution checklist

- [ ] DNS propagated to 103.93.94.120
- [ ] SSL cert covers api.shield.rstglobal.in
- [ ] Nginx updated with api. vhost + /api/ proxy
- [ ] Dashboard built with VITE_API_URL + deployed to /app/
- [ ] All 15 services verified healthy
- [ ] Login + forgot-password + reset-password tested
- [ ] Google Maps loads on location pages
- [ ] GitHub Actions self-hosted runner configured
- [ ] Health check cron installed
- [ ] Cloudflare zone added + proxy enabled
- [ ] AKS scaled to 0 nodes
- [ ] Azure managed services stopped (optional)
