# Shield — Documentation Index

> **Shield — Smart Family Internet Protection Platform**
> Multi-Tenant ISP · GPS Geofencing · AI Monitoring · Flutter Mobile App
> Version 2.0 | March 2026

---

## Live URL

**`https://shield.rstglobal.in`** — SSL active, auto-renews via Let's Encrypt (expires 2026-06-02)

---

## Documentation Files

| File | Contents |
|------|----------|
| [01-platform-overview.md](01-platform-overview.md) | Product vision, user roles, 2026 tech stack, domain setup |
| [02-system-architecture.md](02-system-architecture.md) | Architecture diagram, microservices, communication patterns, ports |
| [03-microservices-specification.md](03-microservices-specification.md) | Each service — responsibilities, APIs, DB schema |
| [04-database-design.md](04-database-design.md) | PostgreSQL schema per service — all tables, columns, indexes |
| [05-adguard-dns-engine.md](05-adguard-dns-engine.md) | AdGuard Home integration, DoH/DoT, per-child DNS Client IDs |
| [06-flutter-mobile-app.md](06-flutter-mobile-app.md) | 30+ screen specification, navigation, packages, flavours |
| [07-web-dashboard.md](07-web-dashboard.md) | React 19 TypeScript dashboard — all pages and components |
| [08-api-reference.md](08-api-reference.md) | Full REST API — all endpoints with auth, request/response |
| [09-ai-monitoring-service.md](09-ai-monitoring-service.md) | Python FastAPI AI service — models, anomaly detection |
| [10-infrastructure-deployment.md](10-infrastructure-deployment.md) | Docker Compose, Nginx config, PostgreSQL, Redis, systemd |
| [11-implementation-roadmap.md](11-implementation-roadmap.md) | 8-phase roadmap with tasks, dependencies, and deliverables |

---

## Server Environment (Confirmed)

| Component | Installed Version | Role |
|-----------|------------------|------|
| Ubuntu | 24.04.3 LTS | OS |
| Java (OpenJDK) | 21.0.10 LTS | Backend runtime |
| Maven | 3.8.7 | Build tool |
| Spring Boot | **4.0.3** | Microservices framework |
| Spring Cloud | **2025.0.1** | Service mesh (Boot 4.0 compatible) |
| Flutter | 3.27.4 → upgrade to **3.41.0** | Mobile app (`flutter upgrade`) |
| Dart | 3.6.2 → upgrade to **3.7.0** | Flutter language |
| Node.js | 25.6.1 | React dashboard build |
| npm | 11.9.0 | Package manager |
| Python | 3.12.3 | AI service |
| Docker | 29.1.3 | Containers (AdGuard, monitoring) |
| PostgreSQL | **18** primary :5454, replica :5455 | Primary database |
| Redis | 7.0.15 | Cache, sessions, pub/sub |
| Nginx | 1.24.0 | Reverse proxy + SSL |
| Server RAM | 62 GB | — |
| Server CPU | 8 cores | — |
| Server Disk | 490 GB (265 GB free) | — |

---

## Shield Service Ports

| Service | Port | Phase |
|---------|------|-------|
| API Gateway | **8280** | 1 |
| Eureka Server | **8261** | 1 |
| Config Server | **8288** | 1 |
| Auth Service | **8281** | 1 |
| Tenant Service | **8282** | 1 |
| Profile Service | **8283** | 2 |
| DNS Service | **8284** | 2 |
| Location Service | **8285** | 3 |
| Notification Service | **8286** | 2 |
| Rewards Service | **8287** | 5 |
| Analytics Service | **8289** | 2 |
| Admin Service | **8290** | 6 |
| AI Service (Python) | **8291** | 4 |
| DNS Resolver (DoH/DoT) | **8443** | 2 |

> **No port conflicts** with existing apps:
> - SmartTrack (gps): 8081, 8082–8089, 8093, 8761, 8888
> - MakewishSpring: 8095, 9600–9615
> - Shield: 8261, 8280–8291 — fully isolated range

---

## Project Structure

```
/var/www/ai/FamilyShield/
├── doc/                       ← This documentation
├── shield-common/             ← Shared library (Phase 1)
├── shield-eureka/             ← Service discovery :8261 (Phase 1)
├── shield-config/             ← Config server :8288 (Phase 1)
├── shield-gateway/            ← API gateway :8280 (Phase 1)
├── shield-auth/               ← Auth service :8281 (Phase 1)
├── shield-tenant/             ← Tenant/ISP service :8282 (Phase 1)
├── shield-profile/            ← Profile/device service :8283 (Phase 2)
├── shield-dns/                ← DNS/filter service :8284 (Phase 2)
├── shield-location/           ← GPS/geofence service :8285 (Phase 3)
├── shield-notification/       ← Push/email/WS :8286 (Phase 2)
├── shield-rewards/            ← Rewards/tasks :8287 (Phase 5)
├── shield-analytics/          ← Analytics :8289 (Phase 2)
├── shield-admin/              ← Admin portal API :8290 (Phase 6)
├── shield-ai/                 ← Python AI service :8291 (Phase 4)
├── shield-app/                ← Flutter mobile app (Phase 1+)
├── shield-dashboard/          ← React 19 web dashboard (Phase 2)
│   └── dist/                  ← Built output (served by Nginx)
├── static/                    ← APK downloads, app-version.json
├── adguard/                   ← AdGuard Home config + data
├── config-repo/               ← Spring Cloud Config files
├── docker-compose.yml
├── docker-compose-monitoring.yml
├── pom.xml
└── .env
```

---

## Domain & URLs

| URL | Purpose |
|-----|---------|
| `https://shield.rstglobal.in/` | React web dashboard (SPA) |
| `https://shield.rstglobal.in/api/v1/*` | REST API (all services via Gateway) |
| `https://shield.rstglobal.in/ws/*` | WebSocket (live DNS feed + alerts) |
| `https://shield.rstglobal.in/eureka/` | Eureka dashboard (localhost only) |
| `https://shield.rstglobal.in/adguard/` | AdGuard Home UI (localhost only) |
| `https://shield.rstglobal.in/actuator/health` | Health check endpoint |
| `https://shield.rstglobal.in/shield-latest.apk` | Android APK download |
| `https://{childId}.dns.shield.rstglobal.in/dns-query` | Per-child DoH endpoint |

---

## Nginx Config Location

```
/etc/nginx/sites-available/shield.rstglobal.in   ← Full config
/etc/nginx/sites-enabled/shield.rstglobal.in     ← Symlink (enabled)
/etc/nginx/conf.d/shield-upstream.conf           ← Upstream pool :8280
/etc/letsencrypt/live/shield.rstglobal.in/       ← SSL certificate
```

Other apps on this server are **not affected** — each has its own isolated nginx site config and port range.
