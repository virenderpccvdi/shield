# 01 — Platform Overview

## What is Shield?

**Shield** is a multi-tenant, AI-powered family internet protection platform that ISPs can white-label and offer to their subscribers as a premium family safety add-on. It combines DNS-level content filtering (no device install needed), GPS location tracking with geofencing, AI-powered monitoring, app time controls, social media signal monitoring, panic button, and a reward system — delivered as a Flutter mobile app and React web dashboard.

- **Live URL:** `https://shield.rstglobal.in`
- **Project path:** `/var/www/ai/FamilyShield/`
- **Java package:** `com.rstglobal.shield`
- **Maven group:** `com.rstglobal.shield`

---

## User Roles — 4-Tier Hierarchy

```
┌───────────────────────────────────────────────────────────┐
│                    GLOBAL ADMIN                           │
│  Platform operator. Manages all ISP tenants.              │
│  Threat intel, AI models, quota, billing, compliance.     │
└──────────────────────┬────────────────────────────────────┘
                       │ 1:N
┌──────────────────────▼────────────────────────────────────┐
│                     ISP ADMIN                             │
│  Manages subscribers for one ISP tenant.                  │
│  Customer lifecycle, TR-069 provisioning, white-label.    │
└──────────────────────┬────────────────────────────────────┘
                       │ 1:N
┌──────────────────────▼────────────────────────────────────┐
│                  CUSTOMER ACCOUNT                         │
│  Household/family. Parent or guardian.                    │
│  Child profiles, DNS rules, GPS alerts, rewards.          │
└──────────────────────┬────────────────────────────────────┘
                       │ 1:N (up to 10)
┌──────────────────────▼────────────────────────────────────┐
│                   CHILD PROFILE                           │
│  Managed entity — no login. Gets:                         │
│  - unique DoH DNS subdomain per profile                   │
│  - up to 10 registered devices                            │
│  - child-facing Flutter mini-app (panic/SOS/tasks)        │
└───────────────────────────────────────────────────────────┘
```

---

## Key Differentiators vs Competitors

| Feature | Shield | Bark | Qustodio | OpenDNS |
|---------|--------|------|----------|---------|
| DNS-level (no device install) | ✅ | ❌ | Partial | ✅ |
| Works on mobile 4G via DoH | ✅ | ❌ | ✅ App | ❌ |
| GPS + Geofencing | ✅ | ✅ | ✅ | ❌ |
| Panic button (SOS) | ✅ | ❌ | ❌ | ❌ |
| AI monitoring (privacy-safe) | ✅ Signal-based | ✅ Message scan | Partial | ❌ |
| Reward system | ✅ Full | ❌ | ❌ | ❌ |
| ISP white-label multi-tenant | ✅ Full | ❌ | ❌ | Partial |
| Self-hosted open source | ✅ | ❌ | ❌ | Partial |
| Cost (family) | €3–5/mo | USD 14/mo | USD 11/mo | Free |

---

## Technology Stack — 2026

### Backend (Spring Boot Microservices)

| Component | Technology | Version (2026) |
|-----------|-----------|----------------|
| Language | Java | **21.0.10** LTS (OpenJDK — minimum for Boot 4.0) |
| Framework | Spring Boot | **4.0.3** |
| Spring Framework | Spring Framework | **7.0.x** (included in Boot 4.0) |
| Microservices | Spring Cloud | **2025.0.1** (compatible with Boot 4.0.x) |
| Service Discovery | Spring Cloud Eureka | 2025.0.1 |
| API Gateway | Spring Cloud Gateway | 2025.0.1 |
| Spring Security | Spring Security | **7.0.x** (included in Boot 4.0) |
| Authentication | JWT HS512 + BCrypt | JJWT **0.13.0** |
| Database | PostgreSQL | **18** (primary :5454, replica :5455) |
| DB Migrations | Flyway | Built-in (Spring Boot 4.0.3) |
| Caching & Sessions | Redis | **7.0.15** (server) |
| ORM | Spring Data JPA + Hibernate | **7.x** (Spring Framework 7 requires Hibernate 7) |
| Build | Maven | **3.8.7** |
| Validation | Jakarta Bean Validation | **3.1** |
| API Docs | Springdoc OpenAPI | **3.0.2** (new major for Spring Boot 4.x) |
| Metrics | Micrometer Prometheus | 1.15.x |
| Tracing | Micrometer + Zipkin | 1.15.x |
| Code Gen | Lombok **1.18.36** + MapStruct **1.6.3** | — |
| Serialization | Jackson | **2.19.x** |

### AI Service (Python)

| Component | Technology | Version (2026) |
|-----------|-----------|----------------|
| Language | Python | **3.12.3** (server) |
| Framework | FastAPI | **0.115.11** |
| ML | scikit-learn | **1.6.1** |
| NLP | HuggingFace Transformers | **4.47.x** |
| Anomaly Detection | Isolation Forest (sklearn) | — |
| ASGI Server | Uvicorn | **0.34.x** |
| HTTP Client | httpx | **0.28.x** |
| Validation | Pydantic | **2.10.x** |

### Frontend (Web Dashboard)

| Component | Technology | Version (2026) |
|-----------|-----------|----------------|
| Framework | React | **19.2.4** |
| Language | TypeScript | **5.7.x** |
| UI Library | MUI (Material UI) | **v7.3.8** |
| State | Zustand | **5.0.x** |
| HTTP | Axios | **1.7.x** |
| Charts | Recharts | **2.15.x** |
| Maps | Leaflet.js + react-leaflet | **4.2.x** |
| Build | Vite | **6.2.x** |
| Runtime | Node.js | **25.6.1** (server) |

### Mobile App (Flutter)

| Component | Technology | Version (2026) |
|-----------|-----------|----------------|
| Framework | Flutter | **3.41.0** (upgrade from 3.27.4 on server: `flutter upgrade`) |
| Language | Dart | **3.7.0** |
| State | Riverpod | **2.6.1** |
| Navigation | go_router | **14.6.2** |
| HTTP | Dio + Interceptors | **5.8.0** |
| WebSocket | stomp_dart_client | **3.1.x** |
| Push (Android) | firebase_messaging | **15.2.4** |
| Push (iOS) | flutter_apns_only | **1.3.x** |
| Secure Storage | flutter_secure_storage | **9.2.x** |
| Maps | google_maps_flutter | **2.9.0** |
| GPS | geolocator | **13.0.x** |
| Background GPS | background_locator_2 | **2.2.x** |
| Charts | fl_chart | **0.70.0** |
| Multi-flavor | flutter_flavor | **3.x** |
| Local notifications | flutter_local_notifications | **18.x** |
| Crash reporting | sentry_flutter | **8.x** |

### Infrastructure

| Component | Technology | Version / Detail |
|-----------|-----------|-----------------|
| DNS Engine | AdGuard Home | Latest (Docker) |
| Web Server | Nginx | **1.24.0** (Ubuntu package) |
| SSL | Let's Encrypt (certbot --nginx) | Auto-renew, expires 2026-06-02 |
| Containers | Docker | **29.1.3** |
| OS | Ubuntu | **24.04.3** LTS |
| Push Notifications | Firebase FCM + APNs | Free tier |
| Error Tracking | Sentry | Free tier |
| Monitoring | Prometheus **3.1.x** + Grafana **11.4.x** | Docker |
| Log Pipeline | Vector (Rust) | **0.43.x** |

---

## Domain & Access Points

| URL | What It Serves |
|-----|---------------|
| `https://shield.rstglobal.in/` | React web dashboard |
| `https://shield.rstglobal.in/api/v1/*` | REST API via Gateway |
| `https://shield.rstglobal.in/ws/*` | WebSocket (live alerts, DNS feed) |
| `https://shield.rstglobal.in/eureka/` | Eureka dashboard (localhost only) |
| `https://shield.rstglobal.in/adguard/` | AdGuard Home UI (localhost only) |
| `https://shield.rstglobal.in/actuator/health` | Health check |
| `https://shield.rstglobal.in/shield-latest.apk` | Android APK |
| `https://{childId}.dns.shield.rstglobal.in/dns-query` | Per-child DoH endpoint |

### Per-Child DNS Client IDs

Each child profile gets a unique DoH subdomain:
```
https://jake-3f2a.dns.shield.rstglobal.in/dns-query
https://emma-7b1d.dns.shield.rstglobal.in/dns-query
```

Set as **Private DNS** on Android or **DNS Profile** on iOS — works on home WiFi **and** mobile 4G/5G.

---

## Multi-Tenant ISP Model

```
Shield Platform (Global Admin — rstglobal)
│
├── ISP: rstglobal (tenant: rst-default)
│   ├── Brand: "Shield"
│   ├── Portal: shield.rstglobal.in
│   └── Development / production tenant
│
├── ISP: Vodafone India (tenant: vodafone-in)
│   ├── Brand: "Vodafone Family Protect"
│   ├── Portal: familyprotect.vodafone.in
│   └── Flutter flavour: vodafone-familyprotect
│
└── ISP: Any ISP (tenant: custom)
    ├── Brand: their choice
    ├── Portal: their subdomain
    └── Flutter flavour: auto-built from brand config
```

Each ISP tenant has:
- Isolated data via PostgreSQL Row-Level Security (tenant_id)
- Custom blocklists on top of global lists
- Own branding and Flutter app flavor
- Separate Grafana dashboard view

---

## Privacy Architecture

Shield AI monitors **DNS-level signals and usage patterns only** — not message content.

| What AI Analyses | What AI Does NOT Access |
|-----------------|------------------------|
| DNS query domain names (anonymised) | Message content (WhatsApp, iMessage, SMS) |
| Query frequency and time patterns | Photos or videos on device |
| Usage duration per app category | Email content |
| Schedule compliance violations | Call recordings |
| Location arrival/departure patterns | Keystrokes or passwords |
| Device battery and online patterns | Screen content |
| App install signals (DNS patterns) | Clipboard content |

All AI processing runs **on-premises** on this server — no data leaves to external AI vendors.
