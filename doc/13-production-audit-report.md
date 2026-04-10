# Shield Platform — Production-Grade SaaS Audit Report

**Date**: 2026-04-10  
**Version**: 1.0  
**Prepared by**: Claude Code (Senior Software Architect / Security Expert)  
**Platform**: Shield Family Internet Protection — https://shield.rstglobal.in

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Diagram](#architecture-diagram)
3. [Application Understanding](#application-understanding)
4. [Microservices Inventory](#microservices-inventory)
5. [Complete Feature Breakdown](#complete-feature-breakdown)
6. [Account Roles & Permissions](#account-roles--permissions)
7. [Page-wise Application Structure](#page-wise-application-structure)
8. [Flutter Mobile App Screens](#flutter-mobile-app-screens)
9. [API Reference — All Endpoints](#api-reference--all-endpoints)
10. [AI Service (shield-ai)](#ai-service-shield-ai)
11. [Database Schemas](#database-schemas)
12. [Security Audit (VAPT)](#security-audit-vapt)
13. [Performance Analysis](#performance-analysis)
14. [UI/UX Review](#uiux-review)
15. [Kubernetes & DevOps](#kubernetes--devops)
16. [Production Readiness Checklist](#production-readiness-checklist)
17. [Improvement Roadmap](#improvement-roadmap)

---

## Executive Summary

Shield is a family internet protection SaaS platform built on a microservices architecture. It enables Internet Service Providers (ISPs) and parents to monitor, filter, and manage children's internet usage via DNS filtering, real-time analytics, location tracking, AI-powered insights, and parental controls.

### Key Metrics
| Item | Count |
|------|-------|
| Microservices | 11 (Java) + 1 (Python FastAPI) |
| React Dashboard Pages | 103+ |
| Flutter Mobile Screens | 37+ |
| REST API Endpoints | 180+ |
| Database Schemas | 10 |
| Flyway Migrations | 80+ |
| DNS Blocklist Domains | 345 (target: 20,000) |
| Current DNS Query Logs | 449,740 |

### Overall Health: ⚠ Partially Production-Ready
- Strong: Architecture, JWT security, circuit breakers, feature completeness
- Weak: Single-replica K8s, missing input validation, hardcoded secrets, no HA

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                    CLIENTS                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │  React Dashboard │  │  Flutter App    │  │  Child Device    │   │
│  │  (Vite + MUI v7) │  │  (Android/iOS)  │  │  (DoH DNS)       │   │
│  └────────┬─────────┘  └───────┬─────────┘  └────────┬─────────┘   │
└───────────┼───────────────────┼────────────────────┼─────────────┘
            │ HTTPS/443          │ HTTPS              │ DoH/443
            ▼                   ▼                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                  AKS Ingress (nginx-ingress)                       │
│         shield.rstglobal.in → 135.235.191.247                     │
│  /api/* → shield-gateway   /ws/* → shield-notification            │
│  /app/* → shield-website   /docs/* → shield-gateway               │
└───────────────────────────┬───────────────────────────────────────┘
                            │
               ┌────────────▼────────────┐
               │    shield-gateway       │
               │    Port 8280            │
               │  ✓ JWT Validation       │
               │  ✓ Rate Limiting        │
               │  ✓ Circuit Breakers     │
               │  ✓ Correlation IDs      │
               │  ✓ CORS Filter          │
               └────────────┬────────────┘
                            │
     ┌──────────┬───────────┼───────────┬──────────────┐
     ▼          ▼           ▼           ▼              ▼
┌─────────┐ ┌──────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
│  Auth   │ │Tenant│ │ Profile │ │   DNS    │ │ Location │
│  8281   │ │ 8282 │ │  8283   │ │  8284    │ │  8285    │
└─────────┘ └──────┘ └─────────┘ └──────────┘ └──────────┘
     ▼          ▼           ▼           ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Notif   │ │ Rewards  │ │Analytics │ │  Admin   │ │  AI/ML   │
│  8286    │ │  8287    │ │  8289    │ │  8290    │ │  8291    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
                            │
          ┌─────────────────┼──────────────────┐
          ▼                 ▼                  ▼
    ┌──────────┐     ┌──────────┐       ┌──────────┐
    │Eureka    │     │  Redis   │       │RabbitMQ  │
    │8261      │     │  6379    │       │  5672    │
    └──────────┘     └──────────┘       └──────────┘
          │
          ▼
    ┌──────────────────────────────────┐
    │  PostgreSQL (Azure Flexible)     │
    │  shield-pg-prod.postgres.azure   │
    │  Schemas: auth, tenant, profile  │
    │          dns, location, notif    │
    │          rewards, analytics      │
    │          admin                   │
    └──────────────────────────────────┘
```

---

## Application Understanding

### What is Shield?

Shield is a **Family Internet Protection Platform** — a B2B2C SaaS product where:

- **ISPs (Internet Service Providers)** subscribe to Shield and offer it to their customers
- **Parents (Customers)** use Shield to protect their children's internet usage
- **Children** use the mobile app with restricted access + AI safe chat

### Business Domain
- **Category**: Child Safety / Parental Controls / Network Security
- **Model**: B2B2C — ISP → Parent → Child
- **Revenue**: Subscription-based (Starter / Growth / Enterprise plans)
- **Differentiator**: DNS-level filtering + AI behavioral insights + Flutter mobile app

### Core Workflows

```
1. ISP Onboarding
   Admin creates ISP tenant → ISP configures branding → ISP invites customers

2. Parent Onboarding
   Parent registers → Creates family → Adds child profiles → Pairs child device → Sets DNS rules

3. DNS Filtering (Real-time)
   Child device → DoH DNS query → AdGuard Home → shield-dns-resolver → Block/Allow → Log to analytics

4. Parental Monitoring
   DNS logs → shield-analytics → AI insights → Parent dashboard → Alerts

5. Child Experience
   Flutter app → View tasks → Earn rewards → AI safe chat → SOS button
```

---

## Microservices Inventory

| Service | Port | Purpose | Tech |
|---------|------|---------|------|
| **shield-eureka** | 8261 | Service discovery registry | Spring Cloud Netflix Eureka |
| **shield-config** | 8288 | Centralized config server | Spring Cloud Config |
| **shield-gateway** | 8280 | API gateway, JWT auth, rate limiting | Spring Cloud Gateway (WebFlux) |
| **shield-auth** | 8281 | Authentication, JWT issuance, MFA, PIN | Spring Boot + Spring Security |
| **shield-tenant** | 8282 | Multi-tenant/ISP management, billing | Spring Boot + JPA |
| **shield-profile** | 8283 | User profiles, family, children, devices | Spring Boot + JPA |
| **shield-dns** | 8284 | DNS rules, filtering, schedules, time limits | Spring Boot + JPA |
| **shield-location** | 8285 | GPS tracking, geofencing, SOS | Spring Boot + JPA |
| **shield-notification** | 8286 | Push (FCM), email, SMS, WebSocket/STOMP | Spring Boot + RabbitMQ |
| **shield-rewards** | 8287 | Gamification, tasks, achievements, points | Spring Boot + JPA |
| **shield-analytics** | 8289 | DNS logs, usage metrics, anomaly detection | Spring Boot + JPA |
| **shield-admin** | 8290 | Platform admin, billing, GDPR, Stripe | Spring Boot + JPA |
| **shield-ai** | 8291 | AI insights, safe chat, anomaly ML, training | FastAPI + scikit-learn + Claude + DeepSeek |

### Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Backend Framework | Spring Boot | 4.0.3 |
| Cloud Framework | Spring Cloud | 2025.1.1 |
| Security | Spring Security | 7.0.x |
| JWT | JJWT | 0.13.0 |
| API Docs | SpringDoc OpenAPI | 3.0.2 |
| Frontend | React + TypeScript | 19.x |
| UI Library | MUI (Material UI) | v7.3.8 |
| Build Tool | Vite | 6.2.x |
| Mobile | Flutter | 3.41.0 |
| AI Backend | FastAPI + Python | 3.12 |
| ML Model | scikit-learn IsolationForest | — |
| LLM Primary | DeepSeek Chat | deepseek-chat |
| LLM Fallback | Claude Haiku | claude-haiku-4-5 |
| Database | PostgreSQL | 18 (Azure Flexible) |
| Cache | Redis | 7.0.15 |
| Message Broker | RabbitMQ | 3.x |
| Service Discovery | Eureka | Spring Cloud |
| Container | Docker | 29.1.3 |
| Orchestration | Kubernetes (AKS) | Azure |
| CI/CD | Azure DevOps | Self-hosted agent |

---

## Complete Feature Breakdown

### Authentication & Authorization
| Feature | Status | Notes |
|---------|--------|-------|
| Email/Password Login | ✅ Complete | JWT HS512 |
| Registration | ✅ Complete | Email verification |
| Password Reset | ✅ Complete | Email token |
| Multi-Factor Auth (TOTP) | ✅ Complete | Google Authenticator |
| Backup Codes | ✅ Complete | MFA recovery |
| App PIN (Child Lock) | ✅ Complete | 4-6 digit PIN |
| JWT Refresh Token | ✅ Complete | 7-day refresh |
| Token Revocation | ✅ Complete | Redis blacklist |
| Role-Based Access | ✅ Complete | 5 roles |
| Family/Co-Parent Invite | ✅ Complete | Email invitation |
| QR Device Registration | ✅ Complete | Pairing codes |

### DNS Filtering & Controls
| Feature | Status | Notes |
|---------|--------|-------|
| Content Category Filtering | ✅ Complete | 30 categories |
| Custom Domain Blocklist | ✅ Complete | Per-profile |
| Custom Domain Allowlist | ✅ Complete | Per-profile |
| Global Platform Blocklist | ✅ Complete | Admin-managed |
| ISP Blocklist/Allowlist | ✅ Complete | ISP-level override |
| Filter Level Presets | ✅ Complete | RELAXED/MODERATE/STRICT/MAXIMUM |
| Safe Search Enforcement | ✅ Complete | Google/Bing |
| YouTube Restricted Mode | ✅ Complete | DNS-level |
| Schedule-Based Blocking | ✅ Complete | Time-of-day rules |
| Bedtime Lock | ✅ Complete | Hard block at bedtime |
| Homework Mode | ✅ Complete | Blocks distractions |
| Screen Time / Time Limits | ✅ Complete | Daily budgets |
| App Time Budgets | ✅ Complete | Per-app limits |
| Time Extension Requests | ✅ Complete | Child requests, parent approves |
| DoH (DNS-over-HTTPS) | ✅ Complete | Per-child unique URL |
| AdGuard Integration | ⚠ Optional | ADGUARD_ENABLED flag |
| Domain Blocklist (seed) | ⚠ Partial | 345 domains (target: 20,000) |

### Location & Safety
| Feature | Status | Notes |
|---------|--------|-------|
| Real-time GPS Tracking | ✅ Complete | Flutter background service |
| Location History | ✅ Complete | Queryable timeline |
| Geofence Alerts | ✅ Complete | Enter/exit notifications |
| SOS / Panic Button | ✅ Complete | Immediate parent alert |
| Location Sharing | ✅ Complete | Share link with token |
| Battery Alerts | ✅ Complete | Low battery notification |
| Anti-Spoofing Detection | ✅ Complete | Location anomaly flag |
| School Zone Safety | ✅ Complete | Geofence preset |
| Check-in Reminders | ✅ Complete | Scheduled location check |

### Analytics & Reports
| Feature | Status | Notes |
|---------|--------|-------|
| DNS Query Logs | ✅ Complete | Real-time, 449K+ records |
| Browsing History | ✅ Complete | Domain + category + action |
| Daily/Weekly/Monthly Stats | ✅ Complete | Charts + export |
| Top Blocked Domains | ✅ Complete | Per-profile |
| Category Breakdown | ✅ Complete | Pie/bar charts |
| Tenant-wide Overview | ✅ Complete | ISP aggregate |
| Platform-wide Stats | ✅ Complete | GLOBAL_ADMIN |
| Hourly Heatmap | ✅ Complete | 24-hour activity |
| PDF Report Export | ✅ Complete | Per-profile |
| CSV Export | ✅ Complete | URL activity page |
| Social Media Monitoring | ✅ Complete | Alerts for social queries |
| Suspicious Activity Alerts | ✅ Complete | Pattern detection |
| AI Insights (Weekly Digest) | ✅ Complete | LLM-enhanced narrative |
| Anomaly Detection | ✅ Complete | IsolationForest ML |
| Mental Health Risk Score | ✅ Complete | 5 risk patterns |

### Notifications
| Feature | Status | Notes |
|---------|--------|-------|
| Firebase Push (FCM) | ✅ Complete | FIREBASE_ENABLED flag |
| Email Notifications | ✅ Complete | SMTP |
| SMS (Twilio) | ✅ Complete | TWILIO_ENABLED flag |
| In-App Notifications | ✅ Complete | WebSocket/STOMP |
| Real-time Live Feed | ✅ Complete | /topic/tenant/{id} |
| Notification Preferences | ✅ Complete | Per-user config |
| Weekly Email Digest | ✅ Complete | Monday 8AM cron |
| ISP Communications | ✅ Complete | ISP → customer messaging |

### Billing & Payments
| Feature | Status | Notes |
|---------|--------|-------|
| Stripe Checkout | ✅ Complete | INR currency |
| Subscription Management | ✅ Complete | 3 plan tiers |
| Invoice Generation | ✅ Complete | PDF (3-tier fallback) |
| Invoice Email | ✅ Complete | Auto-sent on payment |
| Plan Upgrade/Downgrade | ✅ Complete | Auto-applies feature flags |
| Stripe Webhook | ⚠ Partial | Missing signature verification |
| Coupon Codes | ✅ Complete | Admin-managed |
| GDPR Data Export | ✅ Complete | User-triggered |
| GDPR Data Delete | ✅ Complete | Right to be forgotten |

### Rewards & Gamification
| Feature | Status | Notes |
|---------|--------|-------|
| Task Assignment | ✅ Complete | Parent sets tasks |
| Task Completion | ✅ Complete | Child marks done |
| Points / Reward Bank | ✅ Complete | Earn + redeem |
| Achievements / Badges | ✅ Complete | Milestone unlocks |
| Reward Catalog | ✅ Complete | Redeemable rewards |
| Screen Time as Reward | ✅ Complete | Extra time for good behavior |

### AI Features
| Feature | Status | Notes |
|---------|--------|-------|
| AI Weekly Digest | ✅ Complete | DeepSeek + Claude fallback |
| Risk Scoring | ✅ Complete | Behavioral risk assessment |
| Safe AI Chat (Child) | ✅ Complete | Filtered, age-appropriate |
| Parent Q&A Chat | ✅ Complete | Child data context |
| Anomaly Detection ML | ✅ Complete | IsolationForest, 11 features |
| Mental Health Monitoring | ✅ Complete | 5 risk pattern detection |
| Model Retraining | ✅ Complete | On-demand, DB-sourced |
| AI Config Hot-Reload | ⚠ Issue | Via /tmp — insecure |
| Alert Persistence | ⚠ Issue | In-memory only |

---

## Account Roles & Permissions

### Role Hierarchy
```
GLOBAL_ADMIN
    └── ISP_ADMIN (per tenant)
            └── CUSTOMER (parent)
                    └── CHILD_APP (child mobile only)
                    └── CO_PARENT (limited parent)
```

### Role Matrix

| Feature / Page | GLOBAL_ADMIN | ISP_ADMIN | CUSTOMER | CHILD_APP | CO_PARENT |
|---------------|:---:|:---:|:---:|:---:|:---:|
| **Platform Admin** | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| **ISP Management** | ✅ Full | ✅ Own | ❌ | ❌ | ❌ |
| **Tenant Billing** | ✅ Full | ✅ Own | ❌ | ❌ | ❌ |
| **Customer Management** | ✅ Full | ✅ Own | ❌ | ❌ | ❌ |
| **User Management** | ✅ Full | ✅ Own | ❌ | ❌ | ❌ |
| **Family / Children** | ✅ Full | ❌ | ✅ Own | ❌ | ✅ Read |
| **DNS Rules** | ✅ Full | ✅ Tenant | ✅ Children | ❌ | ✅ Read |
| **Location Tracking** | ✅ Full | ❌ | ✅ Children | ❌ | ✅ Read |
| **Analytics** | ✅ All | ✅ Tenant | ✅ Children | ❌ | ✅ Read |
| **Notifications** | ✅ Full | ✅ Own | ✅ Own | ✅ Receive | ✅ Receive |
| **AI Insights** | ✅ Full | ✅ Tenant | ✅ Children | ❌ | ✅ Read |
| **Rewards / Tasks** | ✅ Full | ❌ | ✅ Set | ✅ Complete | ✅ View |
| **Safe Chat** | ✅ Full | ❌ | ❌ | ✅ Only | ❌ |
| **SOS Button** | ❌ | ❌ | ❌ | ✅ Trigger | ✅ Receive |
| **Settings** | ✅ Full | ✅ Tenant | ✅ Own | ❌ | ✅ Own |
| **GDPR Export** | ✅ Full | ✅ Tenant | ✅ Own | ❌ | ❌ |
| **Stripe Billing** | ✅ Full | ✅ Own | ✅ Own | ❌ | ❌ |
| **AI Model Config** | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| **Branding** | ✅ Full | ✅ Own | ❌ | ❌ | ❌ |
| **Compliance/Audit** | ✅ Full | ✅ Tenant | ❌ | ❌ | ❌ |

---

## Page-wise Application Structure

### Authentication Pages (7)

| Page | Route | Purpose | Roles |
|------|-------|---------|-------|
| LoginPage | `/login` | Email+password sign in | All |
| RegisterPage | `/register` | New account creation | Public |
| ForgotPasswordPage | `/forgot-password` | Request reset email | Public |
| ResetPasswordPage | `/reset-password` | Set new password via token | Public |
| VerifyEmailPage | `/verify-email` | Email verification | Public |
| MfaSetupPage | `/mfa/setup` | TOTP setup with QR code | Authenticated |
| MfaVerifyPage | `/mfa/verify` | TOTP code entry at login | Authenticated |

---

### Global Admin Pages (15)

| Page | Route | Purpose | Key APIs |
|------|-------|---------|----------|
| AdminDashboardPage | `/admin/dashboard` | Platform KPIs, tenant list, health | `/analytics/platform/overview` |
| AdminTenantsPage | `/admin/tenants` | All ISP tenants list + management | `/api/v1/tenants` |
| TenantDetailPage | `/admin/tenants/:id` | Single tenant details, plan, features | `/api/v1/tenants/:id` |
| AdminCustomersPage | `/admin/customers` | All customers across all tenants | `/api/v1/admin/customers` |
| CustomerDetailPage | `/admin/customers/:id` | Single customer profile | `/api/v1/admin/customers/:id` |
| AdminUsersPage | `/admin/users` | All platform user accounts | `/api/v1/auth/users` |
| SubscriptionPlansPage | `/admin/plans` | Define/edit subscription plans | `/api/v1/admin/billing/plans` |
| BillingInvoicesPage | `/admin/invoices` | All invoices across platform | `/api/v1/admin/billing/invoices` |
| PlatformAnalyticsPage | `/admin/analytics` | Platform-wide DNS stats | `/analytics/platform/overview` |
| GlobalBlocklistPage | `/admin/blocklist` | Global domain blocklist | `/api/v1/admin/global-blocklist` |
| AiSettingsPage | `/admin/ai-settings` | Configure LLM provider, keys | `/api/v1/admin/ai-settings` |
| CompliancePage | `/admin/compliance` | GDPR audit log, exports | `/api/v1/admin/compliance/gdpr` |
| ContactLeadsPage | `/admin/leads` | Website contact form submissions | `/api/v1/admin/contact` |
| WebsiteVisitorsPage | `/admin/visitors` | Website analytics | `/api/v1/admin/visitors` |
| SystemHealthPage | `/admin/health` | All services health status | `/actuator/health` |

---

### ISP Admin Pages (18)

| Page | Route | Purpose | Key APIs |
|------|-------|---------|----------|
| IspDashboardPage | `/isp/dashboard` | ISP KPIs, active customers, block rate | `/analytics/tenant/:id/overview` |
| IspLiveDashboardPage | `/isp/live` | Real-time DNS feed, hourly chart, WS | `/analytics/tenant/:id/hourly` + `/ws/` |
| IspCustomersPage | `/isp/customers` | Customer list + status | `/profiles/customers` |
| IspUrlActivityPage | `/isp/url-activity` | DNS query history per child profile | `/analytics/:profileId/history` |
| IspDnsPage | `/isp/dns` | ISP-level DNS rules, categories | `/api/v1/dns/rules/tenant` |
| IspReportsPage | `/isp/reports` | Tenant reports, PDF export | `/analytics/tenant/:id/daily` |
| IspAnalyticsPage | `/isp/analytics` | Category breakdown, top domains | `/analytics/tenant/:id/categories` |
| IspBillingPage | `/isp/billing` | ISP subscription, invoices | `/api/v1/billing/subscription` |
| IspBrandingPage | `/isp/branding` | White-label logo, colors | `/api/v1/admin/branding` |
| IspSettingsPage | `/isp/settings` | ISP configuration, SMTP, FCM | `/api/v1/tenants/:id` |
| IspNotificationsPage | `/isp/notifications` | Notification channel config | `/api/v1/notifications/channels` |
| IspAllowlistPage | `/isp/allowlist` | ISP-level domain allowlist | `/api/v1/tenant/allowlist` |
| IspBlocklistPage | `/isp/blocklist` | ISP-level domain blocklist | `/api/v1/tenant/blocklist` |
| IspCommunicationsPage | `/isp/communications` | Message all customers | `/api/v1/notifications/isp-communications` |
| IspUsersPage | `/isp/users` | ISP admin user management | `/api/v1/auth/users` |
| IspOnboardingPage | `/isp/onboarding` | ISP setup wizard | Multiple |
| InviteCustomerPage | `/isp/invite` | Invite new customer by email | `/api/v1/tenants/:id/invite-user` |
| IspProfilePage | `/isp/profile` | ISP admin account settings | `/api/v1/auth/user` |

---

### Customer / Parent Pages (40)

#### Dashboard
| Page | Route | Purpose | Key APIs |
|------|-------|---------|----------|
| DashboardPage | `/parent/dashboard` | Family overview, active profiles, alerts | `/analytics/tenant/:id/overview` |
| NotificationsPage | `/parent/notifications` | All alerts and notifications | `/api/v1/notifications/:profileId` |
| AlertsPage | `/parent/alerts` | Safety alerts, SOS, anomalies | `/api/v1/analytics/:id/social-alerts` |
| AiInsightsPage | `/parent/insights` | AI weekly digest, risk scores | `/api/v1/ai/:profileId/insights` |

#### Family & Profiles
| Page | Route | Purpose | Key APIs |
|------|-------|---------|----------|
| FamilyPage | `/parent/family` | All family members list | `/profiles/customers/:id/children` |
| ChildDetailPage | `/parent/family/:childId` | Child profile summary | `/profiles/children/:id` |
| NewChildPage | `/parent/family/new` | Add new child profile | `POST /profiles/children` |
| CoParentPage | `/parent/co-parents` | Manage co-parent invites | `/profiles/:id/co-parents` |
| EmergencyContactsPage | `/parent/emergency` | SOS alert recipients | `/api/v1/location/emergency-contacts` |

#### Devices
| Page | Route | Purpose | Key APIs |
|------|-------|---------|----------|
| DevicesPage | `/parent/devices` | All paired devices | `/profiles/devices` |
| PairDevicePage | `/parent/devices/pair` | QR code device pairing | `/profiles/pairing-codes` |
| DeviceHealthPage | `/parent/devices/:id` | Battery, last seen, status | `/api/v1/location/:profileId/current` |

#### DNS Controls
| Page | Route | Purpose | Key APIs |
|------|-------|---------|----------|
| SafeFiltersPage | `/parent/controls/filters` | Category on/off toggles | `/api/v1/dns/rules/:profileId/categories` |
| TimeLimitsPage | `/parent/controls/time-limits` | Daily internet budget | `/api/v1/dns/time-limits/:profileId` |
| SchedulePage | `/parent/controls/schedule` | Allow/block by time of day | `/api/v1/dns/schedules/:profileId` |
| BedtimePage | `/parent/controls/bedtime` | Hard bedtime lock | `/api/v1/dns/rules/:profileId` |
| HomeworkModePage | `/parent/controls/homework` | Focus mode on/off | `/api/v1/dns/rules/:profileId` |
| AppBlockingPage | `/parent/controls/apps` | Block specific apps | `/api/v1/dns/rules/:profileId/app-blocks` |
| AppBudgetsPage | `/parent/controls/app-budgets` | Per-app time limits | `/api/v1/dns/budgets/:profileId` |
| CustomBlocklistPage | `/parent/controls/blocklist` | Add custom blocked domains | `/api/v1/dns/rules/:profileId/blocklist` |
| CustomAllowlistPage | `/parent/controls/allowlist` | Always-allow domains | `/api/v1/dns/rules/:profileId/allowlist` |
| ApprovalRequestsPage | `/parent/approvals` | Child's time extension requests | `/api/v1/dns/budgets/extension-requests` |

#### Location
| Page | Route | Purpose | Key APIs |
|------|-------|---------|----------|
| LocationHistoryPage | `/parent/location/history` | GPS timeline with map | `/api/v1/location/:profileId/history` |
| GeofencesPage | `/parent/location/geofences` | Create/edit safe zones | `/api/v1/location/geofences/:profileId` |
| LocationSharePage | `/parent/location/share` | Share location via link | `/api/v1/location/sharing/:profileId` |
| AllChildrenMapPage | `/parent/location/map` | Live map all children | `/api/v1/location/:profileId/current` |

#### Activity & Reports
| Page | Route | Purpose | Key APIs |
|------|-------|---------|----------|
| BrowsingHistoryPage | `/parent/activity/history` | DNS query history, filter, export | `/api/v1/analytics/:profileId/history` |
| AiInsightsPage | `/parent/activity/insights` | AI-generated analysis | `/api/v1/ai/:profileId/weekly` |
| SuspiciousActivityPage | `/parent/activity/suspicious` | Flagged content alerts | `/api/v1/analytics/:id/social-alerts` |
| ReportsPage | `/parent/reports` | Generate PDF reports | `/api/v1/analytics/:profileId/report/pdf` |

#### Rewards
| Page | Route | Purpose | Key APIs |
|------|-------|---------|----------|
| RewardsPage | `/parent/rewards` | Set up rewards catalog | `/api/v1/rewards/:profileId/catalog` |
| TasksPage | `/parent/tasks` | Assign + review tasks | `/api/v1/rewards/tasks/:profileId` |
| AchievementsPage | `/parent/achievements` | View child achievements | `/api/v1/rewards/achievements/:profileId` |

#### Settings & Billing
| Page | Route | Purpose | Key APIs |
|------|-------|---------|----------|
| SettingsPage | `/parent/settings` | Account, MFA, notifications | `/api/v1/auth/user` |
| SubscriptionPage | `/parent/subscription` | Plan management, upgrade | `/api/v1/billing/subscription` |
| InvoicesPage | `/parent/invoices` | Billing history | `/api/v1/admin/billing/invoices` |
| CheckoutSuccessPage | `/checkout/success` | Stripe redirect on payment | — |
| CheckoutCancelPage | `/checkout/cancel` | Stripe redirect on cancel | — |

---

## Flutter Mobile App Screens

### Parent App (27 screens)

| Screen | Feature Area | Purpose |
|--------|-------------|---------|
| DashboardScreen | Core | Family status overview, quick actions |
| FamilyScreen | Family | Children list with status dots |
| NewChildScreen | Family | Create new child profile |
| ChildDetailScreen | Family | Per-child control hub |
| TimeLimitsScreen | Controls | Set daily internet budget |
| BedtimeScreen | Controls | Configure bedtime lock |
| HomeworkModeScreen | Controls | Toggle focus mode |
| SafeFiltersScreen | Controls | Category filter toggles |
| ScheduleScreen | Controls | Time-based access rules |
| DnsRulesScreen | Controls | Custom block/allow domains |
| MapScreen | Location | Live child location on map |
| GeofencesScreen | Location | View/create safe zones |
| LocationHistoryScreen | Location | GPS timeline playback |
| AllChildrenMapScreen | Location | All children on single map |
| BrowsingHistoryScreen | Activity | DNS query log with filters |
| AppUsageScreen | Activity | App-by-app time breakdown |
| AiInsightsScreen | Activity | AI weekly digest display |
| AlertsScreen | Safety | All alerts and notifications |
| EmergencyContactsScreen | Safety | SOS recipient management |
| BatteryAlertsScreen | Safety | Low battery notification config |
| DevicesScreen | Devices | Paired device list |
| RewardsScreen | Rewards | Manage reward catalog |
| ApprovalRequestsScreen | Controls | Approve time extensions |
| NotificationsScreen | Notifications | All push notifications |
| ProfileScreen | Account | User profile & settings |
| SettingsScreen | Account | App settings |
| ReportsScreen | Reports | Trigger PDF report |

### Child App (4 screens)

| Screen | Purpose |
|--------|---------|
| ChildHomeScreen | Home with SOS button, points balance, task count |
| ChildTasksScreen | View and complete assigned tasks |
| ChildRewardsScreen | Browse and redeem rewards |
| AiChatScreen | Safe AI assistant (DeepSeek/Claude filtered) |

### Admin App (6 screens)

| Screen | Purpose |
|--------|---------|
| AdminDashboardScreen | Platform KPIs, tenant count, health |
| CustomersScreen | Customer list across all tenants |
| CustomerDetailScreen | Single customer data |
| TenantsScreen | ISP tenant list |
| TenantDetailScreen | ISP configuration, plan, features |
| AdminShell | Navigation wrapper |

### Onboarding (4 screens)
- SplashScreen, OnboardingScreen, LoginScreen, RegisterScreen

---

## API Reference — All Endpoints

### shield-auth (Port 8281)
```
POST   /api/v1/auth/login                     — Email + password login
POST   /api/v1/auth/register                  — New user registration
POST   /api/v1/auth/logout                    — Invalidate JWT in Redis
POST   /api/v1/auth/refresh                   — Refresh access token
POST   /api/v1/auth/forgot-password           — Send reset email
POST   /api/v1/auth/reset-password            — Reset with token
POST   /api/v1/auth/verify-email              — Verify email token
GET    /api/v1/auth/user                       — Current user profile
PUT    /api/v1/auth/password                   — Change password
DELETE /api/v1/auth/account                    — Delete own account
POST   /api/v1/auth/mfa/setup                  — Generate TOTP secret + QR
POST   /api/v1/auth/mfa/validate               — Verify TOTP code
POST   /api/v1/auth/mfa/backup-codes           — Generate backup codes
GET    /api/v1/auth/mfa/status                 — MFA enabled/disabled
POST   /api/v1/auth/pin/setup                  — Set app PIN
POST   /api/v1/auth/pin/verify                 — Verify app PIN
POST   /api/v1/auth/pin/reset                  — Reset app PIN
GET    /api/v1/auth/users                      — (ADMIN) Paginated user list
POST   /api/v1/auth/admin/register             — (ADMIN) Create user with role
INTERNAL:
GET    /internal/users/{userId}
POST   /internal/users/validate-token
```

### shield-tenant (Port 8282)
```
GET    /api/v1/tenants                         — List all tenants (GLOBAL_ADMIN)
POST   /api/v1/tenants                         — Create new tenant
GET    /api/v1/tenants/{tenantId}              — Get tenant details
PUT    /api/v1/tenants/{tenantId}              — Update tenant
DELETE /api/v1/tenants/{tenantId}              — Delete tenant
GET    /api/v1/tenants/{tenantId}/members      — List tenant users
POST   /api/v1/tenants/{tenantId}/invite-user  — Invite user to tenant
GET    /api/v1/tenants/{tenantId}/subscriptions — Subscription info
PUT    /api/v1/tenants/{tenantId}/plan          — Change plan
POST   /api/v1/tenants/{tenantId}/allowlist    — Add to ISP allowlist
DELETE /api/v1/tenants/{tenantId}/allowlist    — Remove from allowlist
POST   /api/v1/tenants/{tenantId}/blocklist    — Add to ISP blocklist
DELETE /api/v1/tenants/{tenantId}/blocklist    — Remove from blocklist
GET    /api/v1/tenants/{tenantId}/isp-config   — ISP configuration
PUT    /api/v1/tenants/{tenantId}/isp-config   — Update ISP config
```

### shield-profile (Port 8283)
```
GET    /api/v1/profiles/{userId}               — User profile
PUT    /api/v1/profiles/{userId}               — Update profile
GET    /profiles/customers                     — ISP customer list
GET    /profiles/customers/{customerId}        — Customer detail
POST   /profiles/customers                     — Create customer profile
GET    /profiles/customers/{customerId}/children — Children list
POST   /profiles/children                      — Create child profile
GET    /profiles/children/{childId}            — Child profile
PUT    /profiles/children/{childId}            — Update child
DELETE /profiles/children/{childId}            — Delete child
POST   /profiles/{id}/co-parents/invite        — Invite co-parent
GET    /profiles/{id}/co-parents               — List co-parents
DELETE /profiles/{id}/co-parents/{coParentId}  — Remove co-parent
POST   /profiles/pairing-codes                 — Generate QR pairing code
POST   /profiles/pairing-codes/redeem          — Redeem pairing code (device)
GET    /profiles/devices                       — List paired devices
DELETE /profiles/devices/{deviceId}            — Unpair device
GET    /profiles/{id}/emergency-contacts        — Emergency contacts
POST   /profiles/{id}/emergency-contacts        — Add emergency contact
DELETE /profiles/{id}/emergency-contacts/{ecId} — Remove emergency contact
INTERNAL:
POST   /internal/profiles/provision             — Create profile on registration
GET    /internal/profiles/{profileId}
```

### shield-dns (Port 8284)
```
GET    /api/v1/dns/rules/{profileId}                      — All DNS rules for profile
PUT    /api/v1/dns/rules/{profileId}/categories           — Update blocked categories
PUT    /api/v1/dns/rules/{profileId}/allowlist            — Update custom allowlist
PUT    /api/v1/dns/rules/{profileId}/blocklist            — Update custom blocklist
PUT    /api/v1/dns/rules/{profileId}/filter-level         — Set filter level preset
PUT    /api/v1/dns/rules/{profileId}/bedtime              — Configure bedtime lock
PUT    /api/v1/dns/rules/{profileId}/homework-mode        — Toggle homework mode
PUT    /api/v1/dns/rules/{profileId}/safe-search          — Enable safe search
GET    /api/v1/dns/categories                             — All 30 content categories
GET    /api/v1/dns/rules/tenant                           — (ISP) Tenant-level rules

GET    /api/v1/dns/time-limits/{profileId}                — Daily time limit config
PUT    /api/v1/dns/time-limits/{profileId}                — Update time limits
POST   /api/v1/dns/time-limits/{profileId}/reset          — Reset daily usage

GET    /api/v1/dns/schedules/{profileId}                  — Access schedule
PUT    /api/v1/dns/schedules/{profileId}                  — Update schedule
POST   /api/v1/dns/schedules/{profileId}/preset           — Apply preset (SCHOOL/BEDTIME/etc.)
POST   /api/v1/dns/schedules/{profileId}/override         — Temporary override
GET    /api/v1/dns/schedules/{profileId}/status           — Current schedule status

GET    /api/v1/dns/history/{profileId}                    — Browsing history
GET    /api/v1/dns/history/{profileId}/stats              — History stats
DELETE /api/v1/dns/history/{profileId}                    — Clear history

GET    /api/v1/dns/budgets/{profileId}                    — App time budgets
PUT    /api/v1/dns/budgets/{profileId}                    — Update budgets
POST   /api/v1/dns/child/budgets/request                  — (CHILD) Request extension
GET    /api/v1/dns/budgets/extension-requests             — Pending requests
POST   /api/v1/dns/budgets/extension-requests/{id}/approve — Approve
POST   /api/v1/dns/budgets/extension-requests/{id}/reject  — Reject

GET    /api/v1/dns/access-schedules/{profileId}           — Access schedule rules
POST   /api/v1/dns/access-schedules/{profileId}           — Add schedule rule
PUT    /api/v1/dns/access-schedules/{profileId}/{ruleId}  — Update rule
DELETE /api/v1/dns/access-schedules/{profileId}/{ruleId}  — Delete rule

INTERNAL:
POST   /internal/dns/provision                            — Create default rules for new profile
POST   /internal/dns/sync-all                             — Push all rules to AdGuard
GET    /internal/dns/client/{dnsClientId}/profile         — Resolve dnsClientId → profileId
GET    /internal/dns/rules/{profileId}                    — Rules for resolver
```

### shield-location (Port 8285)
```
POST   /api/v1/location/checkin                           — Submit GPS coordinates
GET    /api/v1/location/{profileId}/current               — Latest location
GET    /api/v1/location/{profileId}/history               — Location history (paginated)
DELETE /api/v1/location/{profileId}/history               — Clear history

GET    /api/v1/location/geofences/{profileId}             — List geofences
POST   /api/v1/location/geofences/{profileId}             — Create geofence
PUT    /api/v1/location/geofences/{profileId}/{id}        — Update geofence
DELETE /api/v1/location/geofences/{profileId}/{id}        — Delete geofence

POST   /api/v1/location/sos/trigger                       — Trigger SOS alert
GET    /api/v1/location/sos/{profileId}/history           — SOS history
DELETE /api/v1/location/sos/{alertId}                     — Dismiss SOS

POST   /api/v1/location/battery-alerts/settings           — Configure battery threshold
GET    /api/v1/location/battery-alerts/{profileId}        — Battery alert history

POST   /api/v1/location/sharing/{profileId}/invite        — Share location (create token)
GET    /api/v1/location/sharing/{profileId}/list          — Active shares
DELETE /api/v1/location/sharing/{shareId}                 — Revoke share
PUBLIC:
GET    /public/location/share/{shareToken}                — View shared location (no auth)
```

### shield-notification (Port 8286)
```
GET    /api/v1/notifications/{userId}                     — Notification list
POST   /api/v1/notifications/{userId}/mark-read           — Mark as read
DELETE /api/v1/notifications/{notificationId}             — Delete notification

GET    /api/v1/notifications/preferences/{userId}         — Alert preferences
PUT    /api/v1/notifications/preferences/{userId}         — Update preferences

POST   /api/v1/notifications/fcm/token                    — Register FCM token
DELETE /api/v1/notifications/fcm/token/{token}            — Unregister FCM token
POST   /api/v1/notifications/fcm/send-test                — Test push notification

GET    /api/v1/notifications/channels                     — Notification channels
PUT    /api/v1/notifications/channels/{channelId}         — Update channel config

WS     /ws                                                — STOMP WebSocket endpoint
       Subscribe: /topic/tenant/{tenantId}                — Tenant-wide live events
       Subscribe: /user/queue/alerts                       — User-specific alerts

INTERNAL:
POST   /internal/notify                                   — Dispatch notification event
POST   /internal/email/send                               — Send email
POST   /internal/billing-notify/invoice-paid              — Invoice email
POST   /internal/billing-notify/subscription-confirmed    — Subscription email
```

### shield-rewards (Port 8287)
```
GET    /api/v1/rewards/{profileId}/balance                — Points balance
GET    /api/v1/rewards/{profileId}/catalog                — Available rewards
POST   /api/v1/rewards/{profileId}/redeem                 — Redeem reward
GET    /api/v1/rewards/{profileId}/history                — Transaction history

GET    /api/v1/rewards/tasks/{profileId}                  — Task list
POST   /api/v1/rewards/tasks/{profileId}                  — Create task (parent)
PUT    /api/v1/rewards/tasks/{taskId}/complete            — Mark complete (child)
DELETE /api/v1/rewards/tasks/{taskId}                     — Delete task

GET    /api/v1/rewards/achievements/{profileId}           — Achievements list
POST   /api/v1/rewards/achievements/{achievementId}/unlock — Unlock achievement

INTERNAL:
POST   /internal/rewards/award                            — Award points from other services
```

### shield-analytics (Port 8289)
```
GET    /api/v1/analytics/{profileId}/stats                — Usage stats (period=today/week/month)
GET    /api/v1/analytics/{profileId}/history              — DNS query history (paginated)
GET    /api/v1/analytics/{profileId}/daily                — Daily breakdown (days=30)
GET    /api/v1/analytics/{profileId}/categories           — Category breakdown
GET    /api/v1/analytics/{profileId}/top-domains          — Top domains (action=BLOCKED/ALLOWED)
GET    /api/v1/analytics/{profileId}/top-apps             — Top apps by usage
GET    /api/v1/analytics/{profileId}/app-usage            — App usage report
GET    /api/v1/analytics/{profileId}/report/pdf           — Generate PDF report
GET    /api/v1/analytics/{profileId}/social-alerts        — Social media alerts
POST   /api/v1/analytics/{profileId}/social-alerts        — Create alert
GET    /api/v1/analytics/{profileId}/mental-health        — Mental health signals

GET    /api/v1/analytics/tenant/{tenantId}/overview       — Tenant overview (period=)
GET    /api/v1/analytics/tenant/{tenantId}/daily          — Tenant daily breakdown
GET    /api/v1/analytics/tenant/{tenantId}/categories     — Tenant category breakdown
GET    /api/v1/analytics/tenant/{tenantId}/hourly         — 24-hour activity heatmap
GET    /api/v1/analytics/tenant/{tenantId}/social-alerts  — All tenant alerts
GET    /api/v1/analytics/tenant/customers                 — Per-customer activity

GET    /api/v1/analytics/platform/overview                — (ADMIN) Platform-wide stats
GET    /api/v1/analytics/platform/daily                   — (ADMIN) Platform daily

INTERNAL:
POST   /internal/analytics/log                            — Ingest single DNS event
POST   /internal/analytics/log/bulk                       — Bulk ingest (Vector pipeline)
```

### shield-admin (Port 8290)
```
GET    /api/v1/admin/dashboard                            — Platform KPIs
GET    /api/v1/admin/customers                            — All customers
GET    /api/v1/admin/customers/{customerId}               — Customer detail
GET    /api/v1/admin/tenants                              — All ISP tenants

GET    /api/v1/billing/invoices                           — Invoice list
POST   /api/v1/billing/invoices/{id}/send                 — Resend invoice
POST   /api/v1/billing/invoices/{id}/pdf                  — Download PDF
GET    /api/v1/billing/subscriptions                      — Active subscriptions
POST   /api/v1/billing/checkout                           — Create Stripe checkout session
POST   /api/v1/billing/webhook                            — Stripe webhook (public)

GET    /api/v1/admin/branding                             — ISP branding config
PUT    /api/v1/admin/branding                             — Update branding
POST   /api/v1/admin/branding/upload-logo                 — Upload logo

GET    /api/v1/admin/ai-settings                          — AI LLM config
PUT    /api/v1/admin/ai-settings                          — Update AI config
POST   /api/v1/admin/ai-settings/test                     — Test AI connection

GET    /api/v1/admin/compliance/gdpr/{userId}             — GDPR data summary
POST   /api/v1/admin/compliance/gdpr/{userId}/export      — Trigger data export
POST   /api/v1/admin/compliance/gdpr/{userId}/delete      — Right to erasure
GET    /api/v1/admin/compliance/audit-logs                — Audit trail

GET    /api/v1/admin/plans                                — Subscription plan list
POST   /api/v1/admin/plans                                — Create plan
PUT    /api/v1/admin/plans/{id}                           — Update plan

PUBLIC:
POST   /api/v1/admin/contact/submit                       — Website contact form
POST   /api/v1/admin/visitors/track                       — Anonymous website visit
POST   /api/v1/admin/tr069/webhook                        — TR-069 ACS webhook
```

### shield-ai (Port 8291 — FastAPI)
```
GET    /api/v1/ai/model/health                            — Model health status
GET    /api/v1/ai/{profile_id}/weekly                     — Weekly digest (LLM)
GET    /api/v1/ai/{profile_id}/insights                   — AI risk assessment
POST   /api/v1/ai/analyze/batch                           — Anomaly detection
GET    /api/v1/ai/{profile_id}/keywords                   — Profile keywords
POST   /api/v1/ai/{profile_id}/keywords                   — Update keywords
GET    /api/v1/ai/{profile_id}/mental-health              — Mental health signals
GET    /api/v1/ai/alerts                                  — Active anomaly alerts
POST   /api/v1/ai/alerts/{alert_id}/feedback              — Alert feedback
POST   /api/v1/ai/train                                   — Trigger model retrain
GET    /api/v1/ai/train/status                            — Training job status
POST   /api/v1/ai/config/reload                           — Hot-reload AI config
GET    /api/v1/ai/config/current                          — Current config (masked)
POST   /api/v1/ai/chat                                    — Parent Q&A (LLM)
POST   /api/v1/ai/safe-chat                               — Child safe chatbot (filtered LLM)
GET    /api/v1/ai/safe-chat/health                        — Safe chat health
```

---

## AI Service (shield-ai)

### Architecture
```
FastAPI App
    ├── /routers/health.py      — Model health check
    ├── /routers/insights.py    — Weekly digest + risk scoring
    ├── /routers/analysis.py    — IsolationForest anomaly detection
    ├── /routers/alerts.py      — Mental health + anomaly alerts
    ├── /routers/keywords.py    — Profile keyword management
    ├── /routers/training.py    — Model retraining
    ├── /routers/config.py      — Hot-reload LLM provider config
    ├── /routers/chat.py        — Parent AI chat (LLM)
    └── /routers/safe_chat.py   — Child safe chat (filtered LLM)
```

### ML Model — IsolationForest
- **Features (11)**: query_count, block_count, unique_domains, adult_queries, gaming_queries, social_queries, after_hours_queries, day_of_week, hour_of_day, new_domains, block_rate
- **Training**: On DNS query logs from analytics DB (configurable lookback: 7-90 days)
- **Output**: anomaly_score (negative = anomaly), is_anomaly flag
- **Threshold**: score < -0.05 → alert generated

### LLM Routing
```
Request → DeepSeek (primary, cost-effective)
              ↓ on error
          Claude Haiku (fallback, claude-haiku-4-5-20251001)
              ↓ on error  
          Static fallback response
```

### Mental Health Risk Patterns
| Pattern | Trigger | Risk Level |
|---------|---------|-----------|
| SLEEP_DISRUPTION | Late-night queries (23:00-04:00) | HIGH if >30 |
| GAMING_DEPENDENCY | Gaming queries > 40% of total | HIGH if >60% |
| SOCIAL_MEDIA_OVERUSE | Social queries > 35% of total | HIGH if >50% |
| INAPPROPRIATE_CONTENT_SEEKING | Adult/violence queries present | HIGH always |
| REDUCED_ENGAGEMENT | Total queries < 10/day | MEDIUM |

---

## Database Schemas

### Schema Architecture
```
PostgreSQL (shield_db)
├── auth          — Users, sessions, MFA
├── tenant        — Tenants, plans, ISP config
├── profile       — Profiles, children, devices, family
├── dns           — DNS rules, blocklist, schedules, limits
├── location      — GPS, geofences, SOS, sharing
├── notification  — Notifications, channels, preferences
├── rewards       — Tasks, achievements, points
├── analytics     — DNS logs, usage metrics, alerts
└── admin         — Billing, invoices, compliance, branding
```

### Key Tables
| Schema | Table | Purpose | Row Est. |
|--------|-------|---------|---------|
| auth | users | All user accounts + MFA | ~100 |
| tenant | tenants | ISP tenant configurations | ~10 |
| profile | child_profiles | Children being monitored | ~50 |
| profile | devices | Paired child devices | ~50 |
| dns | domain_blocklist | Content filter domains | 345 → 20K |
| dns | dns_rules | Per-profile DNS configurations | ~50 |
| analytics | dns_query_logs | All DNS queries (partitioned) | 449,740 |
| admin | invoices | Billing invoices | ~20 |
| admin | subscription_plans | Available subscription plans | ~3 |

### Partitioning
`analytics.dns_query_logs` is partitioned by quarter:
- `dns_query_logs_2026_q1`
- `dns_query_logs_2026_q2`
- `dns_query_logs_2026_q3`
- `dns_query_logs_2026_q4`
- `dns_query_logs_2027_q1`

---

## Security Audit (VAPT)

### 🔴 CRITICAL — Fix Immediately

#### 1. Hardcoded Secrets in Config Files
- **Issue**: `ShieldEureka2026`, `Shield@Rabbit2026` in application.yml
- **Risk**: Any developer with repo access has production credentials
- **Fix**: Move to Kubernetes Secrets / HashiCorp Vault
  ```yaml
  # Replace:
  password: ShieldEureka2026
  # With:
  password: ${EUREKA_PASSWORD}  # injected from K8s Secret
  ```

#### 2. Stripe Webhook Without Signature Verification
- **Issue**: Webhook endpoint accepts any POST without Stripe signature check
- **Risk**: Fake payment events → fraudulent subscriptions
- **Fix**:
  ```java
  Event event = Webhook.constructEvent(payload, sigHeader, webhookSecret);
  ```

#### 3. AI Config via /tmp Files
- **Issue**: `/tmp/shield_ai_config.json` writable by any process
- **Risk**: API key injection, privilege escalation
- **Fix**: Use Spring Cloud Config or environment variables

#### 4. In-Memory Alert Storage in AI Service
- **Issue**: `alerts_store: Dict[str, AlertItem]` in Python process memory
- **Risk**: All alerts lost on pod restart (AKS restarts pods regularly)
- **Fix**: Persist to `analytics.social_alerts` table

### 🟠 HIGH — Fix Before Production

#### 5. No Input Validation on Controllers
- **Issue**: No `@Valid`, `@Validated` annotations on request DTOs
- **Risk**: Malformed input, injection attacks
- **Fix**: Add Bean Validation to all request DTOs
  ```java
  public ResponseEntity<?> createProfile(@Valid @RequestBody ProfileRequest req) {
  ```

#### 6. Overly Permissive Spring Security
- **Issue**: All downstream services use `.anyRequest().permitAll()`
- **Risk**: If gateway is bypassed (internal network, misconfiguration), all services exposed
- **Fix**: Implement service-to-service authentication using shared API keys or mTLS
  ```java
  .requestMatchers("/internal/**")
      .hasHeader("X-Internal-Service-Key", internalServiceKey)
  ```

#### 7. No Security Headers in Gateway
- **Issue**: Missing `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- **Fix**: Add `SecurityWebFilterChain` with headers in Gateway:
  ```java
  headers.frameOptions().deny()
         .contentTypeOptions().and()
         .referrerPolicy(ReferrerPolicySpec.STRICT_ORIGIN_WHEN_CROSS_ORIGIN);
  ```

### 🟡 MEDIUM — Fix Before Scale

#### 8. Missing Password Reset Rate Limiting
- Brute-force reset attacks possible
- Fix: 3 attempts per email per hour

#### 9. JWT Token Too Long-Lived
- Access tokens valid for 24 hours (industry standard: 15 minutes)
- Fix: Reduce to 15 min, use refresh flow more aggressively

#### 10. CORS Wildcard Risk
- If `APP_URL` env not set properly, may default to `*`
- Fix: Fail-fast validation at startup

#### 11. No SQL Injection Protection on Native Queries
- Analytics service uses native SQL
- All parameters are bound → low risk, but review manually

### 🟢 LOW — Best Practice

#### 12. No Audit Logging for Sensitive Operations
- Password changes, profile deletes, role changes not audit-logged
- Fix: Add `@AuditLog` annotation or AOP aspect

#### 13. No GDPR Data Minimization
- DNS logs store full domain names indefinitely
- Fix: Auto-purge after 90 days, hash domains for privacy

---

## Performance Analysis

### Database Performance

**✅ Good Practices**
- HikariCP connection pooling (20 max connections per service)
- Hibernate batch processing (batch_size: 25)
- Flyway performance indexes (V16, V7, V8 migrations)
- DNS query log table partitioned by quarter
- `@Transactional(readOnly = true)` on read services

**⚠ Issues Found**

| Issue | Impact | Fix |
|-------|--------|-----|
| No JOIN FETCH in child queries | N+1 queries for parent dashboard | Add `@EntityGraph` or `JOIN FETCH` |
| Redis configured but mostly unused | Repeated DB calls for static data | Add `@Cacheable` on categories, rules |
| Tenant overview uses `period=today` default | ISP dashboard shows 0 data | Fixed: use `period=week` |
| Large analytics GROUP BY without covering index | Slow tenant overview queries | Add composite index on (tenant_id, queried_at, action) |

**Recommended Cache Strategy**
```
Cache key                           TTL
dns:categories                      24h   (static data)
dns:blocklist:{tenantId}            1h    (updated infrequently)
analytics:tenant:{id}:week          15m   (refreshed often)
analytics:profile:{id}:stats        5m    (real-time feel)
auth:user:{userId}                  5m    (reduce auth DB hits)
```

### Frontend Performance

**✅ Good**
- React Query for data fetching (automatic caching + background refresh)
- Code splitting via Vite
- Lazy loading on heavy pages

**⚠ Issues**
- Live Dashboard re-fetches all customer profiles every 25 seconds (no diff/cache)
- Location map loads all history points at once (no clustering for large datasets)
- PDF report generation is synchronous (blocks UI)

**Fixes**
```tsx
// Implement virtual scrolling for large tables
import { VirtualList } from '@tanstack/react-virtual';

// Add map clustering for location history
import L from 'leaflet';
import 'leaflet.markercluster';

// Make PDF async with loading state
const { mutate: generatePdf, isLoading: pdfLoading } = useMutation(...)
```

---

## UI/UX Review

### ✅ Strengths
- Clean MUI v7 design system with consistent typography
- Animated page transitions (AnimatedPage component)
- Responsive layout for mobile and desktop
- Color-coded severity indicators (red=blocked, green=allowed)
- Dark gradient stat cards on live dashboard
- EmptyState component for zero-data states

### ⚠ Issues Found

| Issue | Page | Fix |
|-------|------|-----|
| Block rate multiplied by 100 | IspUrlActivityPage | Fixed (already corrected) |
| History response parsing bug | IspUrlActivityPage | Fixed (already corrected) |
| `period=today` shows 0 data | IspUrlActivityPage | Fixed (already corrected) |
| WebSocket URL `/ws/shield` wrong | IspLiveDashboardPage | Fixed → `/ws` |
| No loading skeleton on first paint | Most pages | Add Skeleton from MUI |
| Tables not virtualised for 10K+ rows | BrowsingHistory | Use VirtualList |
| No empty state for 0 DNS categories | IspDnsPage | Add EmptyState |
| Mobile: Filter panel collapses poorly | IspUrlActivityPage | Stack → Accordion on mobile |

### Color Palette (Current)
```
Primary:   #1565C0 (Blue)
Success:   #2E7D32 (Green)
Error:     #E53935 (Red)
Warning:   #F57F17 (Amber)
Teal:      #00897B (ISP pages)
Background: #F8FAFC
```

### Accessibility Issues
- Missing `aria-label` on icon-only buttons
- Color used alone (no icon) to distinguish blocked vs allowed
- Low contrast on `.caption` text in dark stat cards (`rgba(255,255,255,0.80)`)

---

## Kubernetes & DevOps

### Current AKS Configuration

| Service | Replicas | Strategy | CPU Request | Memory Limit |
|---------|----------|----------|-------------|--------------|
| shield-gateway | 1 | Recreate | 100m | 512Mi |
| shield-auth | 1 | Recreate | 100m | 768Mi |
| shield-tenant | 1 | Recreate | 100m | 768Mi |
| shield-profile | 1 | Recreate | 100m | 768Mi |
| shield-dns | 1 | Recreate | 100m | 768Mi |
| shield-location | 1 | Recreate | 100m | 768Mi |
| shield-notification | 1 | Recreate | 100m | 768Mi |
| shield-rewards | 1 | Recreate | 100m | 768Mi |
| shield-analytics | 1 | Recreate | 100m | 768Mi |
| shield-admin | 1 | Recreate | 100m | 768Mi |
| shield-ai | 1 | Recreate | 100m | 512Mi |

### Critical K8s Issues

#### 1. Single Replica = Zero HA
```yaml
# Current (broken HA):
replicas: 1
strategy:
  type: Recreate   # DOWNTIME on every deployment

# Recommended:
replicas: 2
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

#### 2. AI Service Under-Resourced
```yaml
# Current (insufficient for ML):
resources:
  requests: { cpu: "100m", memory: "256Mi" }
  limits:   { cpu: "500m", memory: "512Mi" }

# Recommended (IsolationForest needs headroom):
resources:
  requests: { cpu: "250m", memory: "512Mi" }
  limits:   { cpu: "1000m", memory: "1Gi" }
```

#### 3. Missing NetworkPolicy
```yaml
# Add to isolate services:
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: shield-default-deny
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
```

#### 4. Missing PodDisruptionBudget
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: shield-auth-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: shield-auth
```

### CI/CD Pipeline (Azure DevOps)

**Current Flow:**
```
git push → Azure DevOps Pipeline
  → Build (Maven/Flutter/Python)
  → Docker build + push to ACR
  → kubectl apply -f k8s/
  → Service restarts
```

**Improvements Needed:**
1. Add automated test stage before build
2. Add security scan (Trivy for Docker images)
3. Add smoke test after deployment
4. Implement blue-green or canary for gateway/auth
5. Add rollback on health check failure

---

## Production Readiness Checklist

| Category | Item | Status | Priority |
|----------|------|--------|----------|
| **Architecture** | Microservices separation | ✅ Done | — |
| **Architecture** | API Gateway with JWT | ✅ Done | — |
| **Architecture** | Circuit breakers | ✅ Done | — |
| **Architecture** | Service discovery (Eureka) | ✅ Done | — |
| **Security** | JWT validation at gateway | ✅ Done | — |
| **Security** | Token revocation (Redis) | ✅ Done | — |
| **Security** | Rate limiting | ✅ Done | — |
| **Security** | Secrets externalized | ❌ Missing | 🔴 Critical |
| **Security** | Input validation (@Valid) | ❌ Missing | 🔴 Critical |
| **Security** | Stripe webhook signature | ❌ Missing | 🔴 Critical |
| **Security** | Service-to-service auth | ❌ Missing | 🟠 High |
| **Security** | Security headers (CSP, HSTS) | ❌ Missing | 🟠 High |
| **Database** | Schema separation | ✅ Done | — |
| **Database** | Flyway migrations | ✅ Done | — |
| **Database** | Connection pooling | ✅ Done | — |
| **Database** | Performance indexes | ✅ Done | — |
| **Database** | DNS log partitioning | ✅ Done | — |
| **Kubernetes** | High availability (2+ replicas) | ❌ Missing | 🔴 Critical |
| **Kubernetes** | RollingUpdate strategy | ❌ Missing | 🔴 Critical |
| **Kubernetes** | NetworkPolicy | ❌ Missing | 🟠 High |
| **Kubernetes** | PodDisruptionBudget | ❌ Missing | 🟠 High |
| **Kubernetes** | Resource limits tuned | ⚠ Partial | 🟠 High |
| **Kubernetes** | WebSocket ingress route | ✅ Fixed | — |
| **Monitoring** | Prometheus metrics | ✅ Done | — |
| **Monitoring** | Grafana dashboards | ✅ Done | — |
| **Monitoring** | Zipkin tracing | ✅ Done | — |
| **Monitoring** | Centralized log aggregation | ❌ Missing | 🟡 Medium |
| **Monitoring** | Alerting rules | ❌ Missing | 🟡 Medium |
| **Performance** | Redis caching active | ⚠ Partial | 🟡 Medium |
| **Performance** | N+1 query resolution | ❌ Missing | 🟡 Medium |
| **AI Service** | Alert persistence | ❌ Missing | 🟠 High |
| **AI Service** | Config via secure store | ❌ Missing | 🔴 Critical |
| **DNS Filtering** | Domain blocklist (20K) | ❌ Missing | 🟠 High |
| **Frontend** | URL Activity page working | ✅ Fixed | — |
| **Frontend** | Block rate display correct | ✅ Fixed | — |
| **Testing** | Unit test coverage | ❓ Unknown | 🟡 Medium |
| **Testing** | Integration tests | ❓ Unknown | 🟡 Medium |
| **Backup** | DB backup automation | ✅ Azure Auto | — |
| **GDPR** | Data export/delete | ✅ Done | — |
| **SSL** | HTTPS everywhere | ✅ Done | — |

---

## Improvement Roadmap

### Phase A — Security & Stability (Week 1-2)
1. ✅ Fix K8s liveness probe 403 (done — `/actuator/health/**`)
2. ✅ Fix WebSocket ingress route (done)
3. ✅ Fix URL Activity page bugs (done)
4. 🔲 Add 20,000-domain blocklist migration (V24)
5. 🔲 Implement Stripe webhook signature verification
6. 🔲 Externalize all secrets to Kubernetes Secrets
7. 🔲 Add `@Valid` to all REST controller DTOs

### Phase B — High Availability (Week 2-3)
1. 🔲 Change all deployments to `replicas: 2`, `RollingUpdate` strategy
2. 🔲 Add PodDisruptionBudget for gateway, auth, notification
3. 🔲 Add NetworkPolicy to isolate service-to-service traffic
4. 🔲 Increase AI service resource limits (1 CPU, 1Gi RAM)
5. 🔲 Enable HPA (HorizontalPodAutoscaler) for gateway and analytics

### Phase C — Performance (Week 3-4)
1. 🔲 Activate Redis `@Cacheable` on categories, blocklists, tenant overview
2. 🔲 Add `@EntityGraph` on child profile queries (fix N+1)
3. 🔲 Add composite index on `analytics.dns_query_logs(tenant_id, queried_at, action)`
4. 🔲 Implement virtual scrolling in browsing history table
5. 🔲 Add async PDF generation with progress indicator

### Phase D — Feature Completion (Month 2)
1. 🔲 Persist AI alerts to `analytics.social_alerts` table
2. 🔲 Move AI training status to Redis (replace /tmp)
3. 🔲 Complete DNS blocklist to 20,000 domains
4. 🔲 Implement real-time DNS event push via WebSocket (on DNS query)
5. 🔲 Add leaderboard/gamification dashboard for children
6. 🔲 Complete TR-069 integration for ISP device provisioning
7. 🔲 Add Elasticsearch for full-text domain search at scale

### Phase E — Enterprise Features (Month 3)
1. 🔲 Multi-region deployment (AKS + CDN)
2. 🔲 White-label mobile app build pipeline
3. 🔲 API rate limiting per tenant (custom limits by plan)
4. 🔲 Advanced ML: transformer model for category classification
5. 🔲 Mobile app: Screen time widget (home screen shortcut)
6. 🔲 Automated compliance reports (COPPA, GDPR)
7. 🔲 Multi-language support (i18n)
8. 🔲 Partner API for ISP integration

---

*Document generated: 2026-04-10 | Shield Platform v1.0 | Confidential*
