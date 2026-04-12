# Shield Platform — Database & API Route Audit
**Date:** 2026-04-12
**Target:** Azure Prod (`shield-pg-prod.postgres.database.azure.com`) + `api.shield.rstglobal.in`

---

## 1. Database Health Scorecard

### 1.1 Schemas & Table Counts

| Schema       | Tables | Total Rows | Health |
|-------------|--------|-----------|--------|
| admin       | 14     | 7,357     | OK     |
| ai          | 4      | 0         | WARN - all empty |
| analytics   | 5+partitions | 450,028 | OK |
| auth        | 3      | 47        | OK     |
| dns         | 16     | 696       | OK     |
| location    | 7+partitions | 477   | OK     |
| notification| 5      | 457       | WARN - orphans |
| profile     | 9      | 308       | OK     |
| rewards     | 6      | 24        | OK     |
| tenant      | 3      | 6         | OK     |

### 1.2 Row Counts — Key Tables

| Schema.Table | Rows | Notes |
|---|---|---|
| admin.audit_logs | 7,052 | Active logging |
| admin.website_visitors | 288 | |
| admin.subscription_plans | 4 | |
| admin.invoices | 5 | |
| analytics.dns_query_logs | 449,740 | Partitioned: Q1=172,035, Q2=277,705 |
| auth.users | 13 | 2 with NULL tenant_id |
| auth.sessions | 32 | |
| dns.dns_rules | 8 | 2 orphaned |
| dns.domain_blocklist | 619 | |
| dns.filter_categories | 30 | |
| location.location_points | 320 | All in Q1 partition |
| location.sos_events | 153 | |
| notification.notifications | 444 | 293 orphaned |
| notification.device_tokens | 12 | |
| profile.child_profiles | 6 | |
| profile.customers | 6 | |
| profile.devices | 2 | |
| profile.device_apps | 287 | |
| rewards.badges | 12 | |
| tenant.tenants | 6 | |

---

## 2. Flyway Migration Status

All migrations successful across all 9 schemas. **No failed migrations.**

| Schema | Migrations | Latest Version | Status |
|---|---|---|---|
| admin | 17 (V1-V17) | trial period | ALL PASS |
| analytics | 8 (V1-V8) | daily summaries | ALL PASS |
| auth | 10 (V1-V10) | password history | ALL PASS |
| dns | 27 (V1-V27) | schedule presets table | ALL PASS |
| location | 10 (V1-V10) | cascade and partitions | ALL PASS |
| notification | 6 (V1-V6) | user preferences ext | ALL PASS |
| profile | 18 (V1-V18) | nullable tenant ids | ALL PASS |
| rewards | 6 (V1-V6) | updated at triggers | ALL PASS |
| tenant | 10 (V1-V10) | schema fixes | ALL PASS |

---

## 3. Foreign Key Constraints

17 FK constraints defined (all within-schema, no cross-schema FKs):

| Schema | Table | Column | References |
|---|---|---|---|
| admin | crm_activities | lead_id | contact_leads.id |
| admin | invoices | plan_id | subscription_plans.id |
| admin | payment_transactions | invoice_id | invoices.id |
| ai | ai_alert_feedback | alert_id | ai_alerts.id |
| ai | training_feedback | alert_id | ai_alerts.id |
| auth | password_history | user_id | users.id |
| auth | sessions | user_id | users.id |
| dns | domain_blocklist | category_id | filter_categories.id |
| location | geofence_events | geofence_id | geofences.id |
| profile | child_profiles | customer_id | customers.id |
| profile | device_apps | profile_id | child_profiles.id |
| profile | device_pairing_codes | profile_id | child_profiles.id |
| profile | devices | profile_id | child_profiles.id |
| profile | emergency_contacts | profile_id | child_profiles.id |
| profile | subscription_history | customer_id | customers.id |
| rewards | profile_badges | badge_id | badges.id |
| rewards | reward_transactions | task_id | tasks.id |

**NOTE:** No cross-schema FK enforcement (e.g., dns.dns_rules.profile_id does not FK to profile.child_profiles). This is by microservice design but allows orphans.

---

## 4. Integrity Issues Found

### 4.1 CRITICAL: Orphaned Records

| Check | Violations | Severity | Details |
|---|---|---|---|
| DNS rules without matching child profiles | **2** | HIGH | profile_id `00000000-0000-0000-0000-000000000099` (test/placeholder) and `de7e6303-6b1a-4dd9-9563-b929a5e8266d` (deleted profile) |
| Notifications without valid user | **293** | HIGH | 293 of 444 notifications (66%) reference 4 non-existent user_ids. All are user_id `8db7fb6f-...` (bulk of orphans) — likely a deleted user |
| Users without tenant_id | **2** | MEDIUM | `admin@rstglobal.in` (GLOBAL_ADMIN — expected NULL) and `newcust.test@example.com` (CUSTOMER — should NOT be NULL) |
| Child profiles without parent user | **0** | OK | All child_profiles link to valid customers |
| Devices without profiles | **0** | OK | |
| Child profiles without dns_client_id | **0** | OK | |
| Duplicate emails | **0** | OK | |

### 4.2 NULL/Required Field Check

| Check | Violations |
|---|---|
| users.email IS NULL | 0 |
| users.role IS NULL | 0 |
| tenants.name IS NULL | 0 |
| devices.device_type IS NULL | 0 |
| child_profiles.name IS NULL | 0 |

### 4.3 Timestamp Coverage

Tables missing `created_at` and/or `updated_at` — potential audit gaps:

| Schema.Table | created_at | updated_at | Concern |
|---|---|---|---|
| admin.compliance_reports | N | N | Cannot track report creation |
| admin.website_visitors | N | N | Cannot track visit timing |
| ai.ai_alert_feedback | N | N | No audit trail for feedback |
| ai.ai_alerts | N | N | Cannot track alert timing |
| analytics.daily_summaries | N | N | Missing temporal metadata |
| analytics.suspicious_activity_alerts | N | N | Security alerts lack timestamps |
| dns.browsing_history | N | N | History lacks its own timestamps |
| dns.budget_usage | N | N | Usage tracking unauditable |
| dns.filter_categories | N | N | |
| dns.screen_time_requests | N | N | |
| location.geofence_events | N | N | Events lack timestamps |
| location.spoofing_alerts | N | N | Security alerts lack timestamps |
| notification.isp_communications | N | N | |
| rewards.achievements | N | N | |
| rewards.badges | N | N | |
| rewards.profile_badges | N | N | |
| profile.subscription_history | N | N | Billing history lacks timestamps |

---

## 5. Index Coverage

### 5.1 Tables with NO non-PK indexes (potential performance risk)

| Schema.Table | Rows | Risk |
|---|---|---|
| admin.ai_settings | 1 | LOW (single row) |
| admin.compliance_reports | 0 | LOW (empty) |
| ai.ai_alert_feedback | 0 | LOW (empty) |
| ai.ai_keywords | 0 | LOW (empty) |
| ai.training_feedback | 0 | LOW (empty) |
| rewards.badges | 12 | LOW (small table) |

### 5.2 Missing Cross-Service Indexes (recommendations)

| Table | Suggested Index | Reason |
|---|---|---|
| dns.dns_rules | idx_dns_rules_profile_id | Frequent lookups by profile_id; orphan check showed issues |
| notification.notifications | idx_notifications_user_id | 293 orphans; user_id is frequently queried |
| location.sos_events | idx_sos_events_profile_id | 153 rows, growing; queried by profile |

---

## 6. Complete API Route Map

### 6.1 shield-auth (port 8281) — `/api/v1/auth`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /api/v1/auth/register | Public | |
| POST | /api/v1/auth/login | Public | Rate-limited 5/s |
| POST | /api/v1/auth/refresh | Public | |
| POST | /api/v1/auth/verify-email | Public | |
| POST | /api/v1/auth/send-verification-email | Auth | |
| POST | /api/v1/auth/forgot-password | Public | |
| POST | /api/v1/auth/reset-password | Public | |
| POST | /api/v1/auth/logout | Auth | |
| DELETE | /api/v1/auth/sessions | Auth | Revoke all sessions |
| GET | /api/v1/auth/sessions | Auth | List sessions |
| DELETE | /api/v1/auth/sessions/{id} | Auth | Revoke session |
| POST | /api/v1/auth/change-password | Auth | |
| GET | /api/v1/auth/me | Auth | |
| PUT | /api/v1/auth/me | Auth | |
| POST | /api/v1/auth/mfa/setup | Auth | |
| POST | /api/v1/auth/mfa/verify | Auth | |
| POST | /api/v1/auth/mfa/disable | Auth | |
| POST | /api/v1/auth/mfa/validate | Public | |
| POST | /api/v1/auth/mfa/email/send | Auth | |
| GET | /api/v1/auth/users | GLOBAL_ADMIN | |
| POST | /api/v1/auth/admin/register | GLOBAL_ADMIN | |
| POST | /api/v1/auth/invite/co-parent | CUSTOMER | |
| POST | /api/v1/auth/child/token | Auth | |
| PUT | /api/v1/auth/admin/users/{id} | GLOBAL_ADMIN | |
| DELETE | /api/v1/auth/admin/users/{id} | GLOBAL_ADMIN | |
| POST | /api/v1/auth/admin/users/{id}/reset-password | GLOBAL_ADMIN | |
| POST | /api/v1/auth/pin/set | Auth | |
| POST | /api/v1/auth/pin/verify | Auth | |
| PUT | /api/v1/auth/pin/biometric | Auth | |
| GET | /api/v1/auth/pin/settings | Auth | |
| DELETE | /api/v1/auth/pin/remove | Auth | |
| *Internal* | POST /internal/users/create-customer | Service-to-service | |

### 6.2 shield-tenant (port 8282) — `/api/v1/tenants`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /api/v1/tenants | GLOBAL_ADMIN | Create tenant |
| GET | /api/v1/tenants | GLOBAL_ADMIN | List tenants |
| GET | /api/v1/tenants/{id} | GLOBAL_ADMIN | |
| GET | /api/v1/tenants/slug/{slug} | Auth | |
| PUT | /api/v1/tenants/{id} | GLOBAL_ADMIN | |
| PATCH | /api/v1/tenants/{id}/features/{feature} | GLOBAL_ADMIN | |
| DELETE | /api/v1/tenants/{id} | GLOBAL_ADMIN | |
| GET | /api/v1/tenants/me | Auth | Current tenant |
| GET | /api/v1/tenants/{id}/quotas | GLOBAL_ADMIN | |
| PUT | /api/v1/tenants/{id}/quotas | GLOBAL_ADMIN | |
| GET | /api/v1/tenants/{tenantId}/branding | Auth | |
| PUT | /api/v1/tenants/{tenantId}/branding | ISP_ADMIN | |
| GET | /api/v1/tenants/internal/{tenantId}/branding | Internal | |
| POST | /api/v1/tenants/{id}/sync-features | GLOBAL_ADMIN | |
| GET | /api/v1/tenants/allowlist | ISP_ADMIN | |
| POST | /api/v1/tenants/allowlist | ISP_ADMIN | |
| DELETE | /api/v1/tenants/allowlist/{id} | ISP_ADMIN | |
| GET | /api/v1/tenants/blocklist | ISP_ADMIN | |
| POST | /api/v1/tenants/blocklist | ISP_ADMIN | |
| DELETE | /api/v1/tenants/blocklist/{id} | ISP_ADMIN | |
| POST | /api/v1/tenants/{id}/customers/bulk-import | ISP_ADMIN | Multipart |
| GET | /api/v1/tenants/{id}/customers/bulk-import/{jobId} | ISP_ADMIN | |
| *Internal* | POST /internal/tenants/{id}/suspend | Service-to-service | |
| *Internal* | POST /internal/tenants/{id}/activate | Service-to-service | |
| *Internal* | GET /internal/tenants/{id}/features/{feature} | Service-to-service | |
| *Internal* | PUT /internal/tenants/{id}/features | Service-to-service | |

**ISSUE:** Controller also maps `/api/v1/tenant/tenants` but gateway has no route for it — returns 404.

### 6.3 shield-profile (port 8283) — `/api/v1/profiles`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /api/v1/profiles/children | CUSTOMER | Create child |
| GET | /api/v1/profiles/children | CUSTOMER | List children |
| GET | /api/v1/profiles/children/{id} | CUSTOMER | |
| PUT | /api/v1/profiles/children/{id} | CUSTOMER | |
| DELETE | /api/v1/profiles/children/{id} | CUSTOMER | |
| GET | /api/v1/profiles/children/{id}/status | CUSTOMER | |
| GET | /api/v1/profiles/children/{id}/doh-url | CUSTOMER | |
| GET | /api/v1/profiles/children/{id}/battery-alerts | CUSTOMER | |
| PUT | /api/v1/profiles/children/{id}/battery-alerts | CUSTOMER | |
| POST | /api/v1/profiles/customers | Auth | Create customer |
| GET | /api/v1/profiles/customers | Auth | |
| GET | /api/v1/profiles/customers/{id} | Auth | |
| GET | /api/v1/profiles/customers/me | CUSTOMER | |
| PUT | /api/v1/profiles/customers/{id} | Auth | |
| DELETE | /api/v1/profiles/customers/{id} | Auth | |
| GET | /api/v1/profiles/customers/{customerId}/children | Auth | |
| POST | /api/v1/profiles/customers/{customerId}/children | Auth | |
| DELETE | /api/v1/profiles/customers/{customerId}/children/{profileId} | Auth | |
| POST | /api/v1/profiles/devices | Auth | Register device |
| POST | /api/v1/profiles/devices/heartbeat | Auth | |
| GET | /api/v1/profiles/devices/profile/{profileId} | Auth | |
| DELETE | /api/v1/profiles/devices/{id} | Auth | |
| GET | /api/v1/profiles/devices/all | GLOBAL_ADMIN | **Tested: 403 for CUSTOMER (correct)** |
| GET | /api/v1/profiles/devices/qr/{childId} | Auth | |
| GET | /api/v1/profiles/devices/qr/{childId}/image | Auth | PNG |
| GET | /api/v1/profiles/devices/stats | Auth | |
| POST | /api/v1/profiles/devices/pairing-code | Auth | |
| POST | /api/v1/profiles/devices/pair | Auth | |
| POST | /api/v1/profiles/devices/{deviceId}/heartbeat | Auth | |
| GET | /api/v1/profiles/devices/setup-script | Auth | |
| POST | /api/v1/profiles/apps/sync | Auth | |
| GET | /api/v1/profiles/apps/{profileId} | Auth | |
| PATCH | /api/v1/profiles/apps/{profileId}/{packageName} | Auth | |
| POST | /api/v1/profiles/apps/uninstall-pin | Auth | |
| GET | /api/v1/profiles/apps/blocked | Auth | |
| POST | /api/v1/profiles/apps/verify-uninstall-pin | Auth | |
| POST | /api/v1/profiles/family/invite | CUSTOMER | |
| POST | /api/v1/profiles/family/accept | Auth | |
| GET | /api/v1/profiles/family | CUSTOMER | |
| PUT | /api/v1/profiles/family/{memberId}/role | CUSTOMER | |
| DELETE | /api/v1/profiles/family/invites/{inviteId} | CUSTOMER | |
| DELETE | /api/v1/profiles/family/{memberId} | CUSTOMER | |
| GET | /api/v1/profiles/family-rules | CUSTOMER | **Tested: 500 INTERNAL_ERROR** |
| POST | /api/v1/profiles/family-rules | CUSTOMER | |
| PUT | /api/v1/profiles/family-rules/{ruleId} | CUSTOMER | |
| DELETE | /api/v1/profiles/family-rules/{ruleId} | CUSTOMER | |
| POST | /api/v1/profiles/family-rules/reorder | CUSTOMER | |
| GET | /api/v1/profiles/children/{profileId}/emergency-contacts | CUSTOMER | |
| POST | /api/v1/profiles/children/{profileId}/emergency-contacts | CUSTOMER | |
| DELETE | /api/v1/profiles/children/{profileId}/emergency-contacts/{contactId} | CUSTOMER | |
| GET | /api/v1/profiles/admin/children | GLOBAL_ADMIN/ISP_ADMIN | |
| GET | /api/v1/profiles/admin/children/{id} | GLOBAL_ADMIN/ISP_ADMIN | |
| PUT | /api/v1/profiles/admin/children/{id} | GLOBAL_ADMIN/ISP_ADMIN | |
| DELETE | /api/v1/profiles/admin/children/{id} | GLOBAL_ADMIN/ISP_ADMIN | |
| GET | /api/v1/profiles/isp/children | ISP_ADMIN | |
| GET | /api/v1/profiles/isp/children/{id} | ISP_ADMIN | |
| PUT | /api/v1/profiles/isp/children/{id} | ISP_ADMIN | |
| DELETE | /api/v1/profiles/isp/children/{id} | ISP_ADMIN | |
| *Internal* | GET /internal/profiles/{profileId}/parent | Service-to-service | |
| *Internal* | GET /internal/profiles/co-parent/customers | Service-to-service | |
| *Internal* | GET /internal/profiles/family-rules | Service-to-service | |
| *Internal* | GET /internal/profiles/{profileId}/emergency-contacts | Service-to-service | |

### 6.4 shield-dns (port 8284) — `/api/v1/dns`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/v1/dns/rules/{profileId} | CUSTOMER | |
| PUT | /api/v1/dns/rules/{profileId}/categories | CUSTOMER | |
| PUT | /api/v1/dns/rules/{profileId}/allowlist | CUSTOMER | |
| PUT | /api/v1/dns/rules/{profileId}/blocklist | CUSTOMER | |
| PUT | /api/v1/dns/rules/{profileId}/custom-lists | CUSTOMER | |
| PUT | /api/v1/dns/rules/{profileId}/filter-level | CUSTOMER | |
| POST | /api/v1/dns/rules/{profileId}/domain/action | CUSTOMER | |
| GET | /api/v1/dns/categories | Auth | |
| GET | /api/v1/dns/categories/full | Auth | |
| GET | /api/v1/dns/rules/{profileId}/activity | CUSTOMER | |
| POST | /api/v1/dns/rules/{profileId}/sync | CUSTOMER | |
| POST | /api/v1/dns/rules/{profileId}/pause | CUSTOMER | |
| POST | /api/v1/dns/rules/{profileId}/resume | CUSTOMER | |
| GET | /api/v1/dns/rules/platform | GLOBAL_ADMIN | |
| POST | /api/v1/dns/rules/platform/propagate | GLOBAL_ADMIN | |
| PUT | /api/v1/dns/rules/platform/categories | GLOBAL_ADMIN | |
| PUT | /api/v1/dns/rules/platform/blocklist | GLOBAL_ADMIN | |
| PUT | /api/v1/dns/rules/platform/allowlist | GLOBAL_ADMIN | |
| POST | /api/v1/dns/rules/{profileId}/homework/start | CUSTOMER | |
| POST | /api/v1/dns/rules/{profileId}/homework/stop | CUSTOMER | |
| GET | /api/v1/dns/rules/{profileId}/homework/status | CUSTOMER | |
| POST | /api/v1/dns/rules/{profileId}/youtube-safe-mode | CUSTOMER | |
| POST | /api/v1/dns/rules/{profileId}/safe-search | CUSTOMER | |
| POST | /api/v1/dns/rules/{profileId}/social-block | CUSTOMER | |
| POST | /api/v1/dns/rules/{profileId}/bedtime/configure | CUSTOMER | |
| GET | /api/v1/dns/rules/{profileId}/bedtime/status | CUSTOMER | |
| GET | /api/v1/dns/rules/{profileId}/audit-log | CUSTOMER | |
| GET | /api/v1/dns/{profileId}/status | CUSTOMER | |
| GET | /api/v1/dns/budgets/{profileId} | CUSTOMER | |
| PUT | /api/v1/dns/budgets/{profileId} | CUSTOMER | |
| GET | /api/v1/dns/budgets/{profileId}/today | CUSTOMER | |
| GET | /api/v1/dns/budgets/{profileId}/status | CUSTOMER | |
| POST | /api/v1/dns/budgets/{profileId}/extend | CUSTOMER | |
| POST | /api/v1/dns/approval-requests | CUSTOMER | |
| GET | /api/v1/dns/approval-requests/{profileId} | CUSTOMER | |
| POST | /api/v1/dns/approval-requests/{id}/approve | CUSTOMER | |
| POST | /api/v1/dns/approval-requests/{id}/deny | CUSTOMER | |
| GET | /api/v1/dns/app-budgets/{profileId} | CUSTOMER | |
| POST | /api/v1/dns/app-budgets/{profileId} | CUSTOMER | |
| DELETE | /api/v1/dns/app-budgets/{profileId}/{budgetId} | CUSTOMER | |
| POST | /api/v1/dns/app-budgets/{profileId}/usage | CUSTOMER | |
| POST | /api/v1/dns/app-budgets/{profileId}/usage/sync | CUSTOMER | |
| GET | /api/v1/dns/app-budgets/{profileId}/history | CUSTOMER | |
| POST | /api/v1/dns/screen-time/{profileId}/request | CUSTOMER | |
| POST | /api/v1/dns/screen-time/{requestId}/approve | CUSTOMER | |
| POST | /api/v1/dns/screen-time/{requestId}/deny | CUSTOMER | |
| GET | /api/v1/dns/screen-time/{profileId}/pending | CUSTOMER | |
| GET | /api/v1/dns/screen-time/{profileId}/all | CUSTOMER | |
| GET | /api/v1/dns/schedules/{profileId} | CUSTOMER | |
| PUT | /api/v1/dns/schedules/{profileId} | CUSTOMER | |
| POST | /api/v1/dns/schedules/{profileId}/preset | CUSTOMER | |
| POST | /api/v1/dns/schedules/{profileId}/override | CUSTOMER | |
| GET | /api/v1/dns/schedules/{profileId}/status | CUSTOMER | |
| DELETE | /api/v1/dns/schedules/{profileId}/override | CUSTOMER | |
| GET | /api/v1/dns/schedules/presets | Auth | |
| GET | /api/v1/dns/access-schedules/{profileId} | CUSTOMER | |
| POST | /api/v1/dns/access-schedules/{profileId} | CUSTOMER | |
| PUT | /api/v1/dns/access-schedules/{profileId}/{scheduleId} | CUSTOMER | |
| DELETE | /api/v1/dns/access-schedules/{profileId}/{scheduleId} | CUSTOMER | |
| GET | /api/v1/dns/time-limits/{profileId} | CUSTOMER | |
| PUT | /api/v1/dns/time-limits/{profileId} | CUSTOMER | |
| POST | /api/v1/dns/time-limits/{profileId}/reset | CUSTOMER | |
| GET | /api/v1/dns/history/{profileId} | CUSTOMER | |
| GET | /api/v1/dns/history/{profileId}/stats | CUSTOMER | |
| DELETE | /api/v1/dns/history/{profileId} | CUSTOMER | |
| GET | /api/v1/dns/profiles/{profileId}/usage/today | CUSTOMER | |
| GET | /api/v1/dns/rules/tenant | ISP_ADMIN | Tenant DNS settings |
| PUT | /api/v1/dns/rules/tenant/categories | ISP_ADMIN | |
| PUT | /api/v1/dns/rules/tenant/blocklist | ISP_ADMIN | |
| PUT | /api/v1/dns/rules/tenant/allowlist | ISP_ADMIN | |
| GET | /api/v1/dns/rules/tenant/isp-overrides | ISP_ADMIN | |
| PUT | /api/v1/dns/rules/tenant/isp-overrides/{category} | ISP_ADMIN | |
| DELETE | /api/v1/dns/rules/tenant/isp-overrides/{category} | ISP_ADMIN | |
| POST | /api/v1/dns/child/budgets/request | CHILD | Extension request |
| GET | /api/v1/dns/budgets/extension-requests | CUSTOMER | |
| POST | /api/v1/dns/budgets/extension-requests/{id}/approve | CUSTOMER | |
| POST | /api/v1/dns/budgets/extension-requests/{id}/reject | CUSTOMER | |
| *Internal* | POST /internal/dns/provision | Service-to-service | |
| *Internal* | POST /internal/dns/sync-all | Service-to-service | |
| *Internal* | GET /internal/dns/client/{dnsClientId}/profile | Service-to-service | |
| *Internal* | GET /internal/dns/rules/{profileId} | Service-to-service | |
| *Internal* | POST /internal/dns/filter-level/{profileId} | Service-to-service | |
| *Internal* | POST /internal/dns/history/record | Service-to-service | |
| *Internal* | GET /internal/dns/domain-blocklist | Service-to-service | |
| *Internal* | GET /internal/dns/domain-category/{domain} | Service-to-service | |

### 6.5 shield-location (port 8285) — `/api/v1/location`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/v1/location/{profileId}/latest | CUSTOMER | |
| GET | /api/v1/location/{profileId}/history | CUSTOMER | |
| POST | /api/v1/location/child/checkin | CHILD | |
| GET | /api/v1/location/{profileId}/speed | CUSTOMER | |
| GET | /api/v1/location/{profileId}/spoofing-alerts | CUSTOMER | |
| GET | /api/v1/location/sos/platform | GLOBAL_ADMIN | **Tested: 404** |
| GET | /api/v1/location/{profileId}/sos | CUSTOMER | |
| POST | /api/v1/location/child/panic | CHILD | |
| POST | /api/v1/location/sos/{id}/acknowledge | CUSTOMER | |
| POST | /api/v1/location/sos/{id}/resolve | CUSTOMER | |
| POST | /api/v1/location/{profileId}/geofences | CUSTOMER | |
| GET | /api/v1/location/{profileId}/geofences | CUSTOMER | |
| PUT | /api/v1/location/{profileId}/geofences/{id} | CUSTOMER | |
| DELETE | /api/v1/location/{profileId}/geofences/{id} | CUSTOMER | |
| POST | /api/v1/location/{profileId}/places | CUSTOMER | |
| GET | /api/v1/location/{profileId}/places | CUSTOMER | |
| PUT | /api/v1/location/{profileId}/places/{id} | CUSTOMER | |
| DELETE | /api/v1/location/{profileId}/places/{id} | CUSTOMER | |
| POST | /api/v1/location/battery/{profileId}/report | Auth | |
| GET | /api/v1/location/battery/{profileId}/settings | Auth | |
| PUT | /api/v1/location/battery/{profileId}/threshold | Auth | |
| GET | /api/v1/location/checkin-reminder/{profileId} | Auth | |
| PUT | /api/v1/location/checkin-reminder/{profileId} | Auth | |
| POST | /api/v1/location/video-checkin/request | Auth | |
| POST | /api/v1/location/video-checkin/signal | Auth | |
| POST | /api/v1/location/video-checkin/{sessionId}/end | Auth | |
| POST | /api/v1/location/shares | CUSTOMER | |
| GET | /api/v1/location/shares/{profileId} | CUSTOMER | |
| DELETE | /api/v1/location/shares/{shareId} | CUSTOMER | |
| GET | /public/location/share/{token} | Public | |
| *Internal* | POST /internal/location/upload | Service-to-service | |
| *Internal* | POST /internal/location/sos | Service-to-service | |

### 6.6 shield-notification (port 8286) �� `/api/v1/notifications`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/v1/notifications/my | Auth | |
| GET | /api/v1/notifications/my/unread | Auth | |
| GET | /api/v1/notifications/my/unread/count | Auth | |
| PUT | /api/v1/notifications/{id}/read | Auth | |
| PUT | /api/v1/notifications/my/read-all | Auth | |
| POST | /api/v1/notifications/push | GLOBAL_ADMIN | |
| POST | /api/v1/notifications/fcm/register | Auth | |
| DELETE | /api/v1/notifications/fcm/unregister | Auth | |
| GET | /api/v1/notifications/admin/channels | ISP_ADMIN+ | |
| PUT | /api/v1/notifications/admin/channels | ISP_ADMIN+ | |
| POST | /api/v1/notifications/admin/channels/test | ISP_ADMIN+ | |
| GET | /api/v1/notifications/preferences | Auth | |
| PUT | /api/v1/notifications/preferences | Auth | |
| POST | /api/v1/notifications/isp-comms/send | ISP_ADMIN | |
| GET | /api/v1/notifications/isp-comms/history/{tenantId} | ISP_ADMIN | |
| *Internal* | POST /internal/notifications/send | Service-to-service | |
| *Internal* | POST /internal/notifications/push | Service-to-service | |
| *Internal* | POST /internal/notifications/location-update | Service-to-service | |
| *Internal* | POST /internal/notifications/broadcast | Service-to-service | |
| *Internal* | POST /internal/notifications/emergency | Service-to-service | |
| *Internal* | POST /internal/notifications/digest/trigger | Service-to-service | |
| *Internal* | POST /internal/notifications/new-device | Service-to-service | |
| *Internal* | POST /internal/notifications/report-card/trigger | Service-to-service | |
| *Internal* | POST /internal/notifications/email | Service-to-service | |
| *Internal* | POST /internal/notifications/billing/invoice-paid | Service-to-service | |
| *Internal* | POST /internal/notifications/billing/subscription-confirmed | Service-to-service | |

### 6.7 shield-rewards (port 8287) — `/api/v1/rewards`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /api/v1/rewards/tasks | CUSTOMER | Create task (all children) |
| POST | /api/v1/rewards/tasks/{profileId} | CUSTOMER | Create task for child |
| GET | /api/v1/rewards/tasks | CUSTOMER | |
| GET | /api/v1/rewards/tasks/{profileId} | CUSTOMER | |
| POST | /api/v1/rewards/tasks/{taskId}/approve | CUSTOMER | |
| POST | /api/v1/rewards/tasks/{taskId}/reject | CUSTOMER | |
| POST | /api/v1/rewards/tasks/{taskId}/complete | CUSTOMER | |
| GET | /api/v1/rewards/bank/{profileId} | CUSTOMER | |
| POST | /api/v1/rewards/bank/{profileId}/redeem | CUSTOMER | |
| POST | /api/v1/rewards/{profileId}/bonus | CUSTOMER | |
| GET | /api/v1/rewards/achievements/{profileId} | CUSTOMER | |
| POST | /api/v1/rewards/checkin/{profileId} | CUSTOMER | |
| GET | /api/v1/rewards/{profileId}/streaks | CUSTOMER | |
| GET | /api/v1/rewards/transactions/{profileId} | CUSTOMER | |
| GET | /api/v1/rewards/leaderboard | CUSTOMER | |
| GET | /api/v1/rewards/badges | Auth | |
| GET | /api/v1/rewards/badges/profile/{profileId} | Auth | |
| POST | /api/v1/rewards/badges/check/{profileId} | Auth | |
| POST | /api/v1/rewards/badges/award/{profileId}/{badgeId} | Auth | |
| *Internal* | POST /internal/rewards/tasks/{taskId}/submit | Service-to-service | |
| *Internal* | POST /internal/rewards/tasks/{taskId}/complete | Service-to-service | |
| *Internal* | POST /internal/rewards/award | Service-to-service | |

### 6.8 shield-analytics (port 8289) — `/api/v1/analytics`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/v1/analytics/{profileId}/stats | CUSTOMER | |
| GET | /api/v1/analytics/{profileId}/top-domains | CUSTOMER | |
| GET | /api/v1/analytics/{profileId}/daily | CUSTOMER | |
| GET | /api/v1/analytics/{profileId}/categories | CUSTOMER | |
| GET | /api/v1/analytics/{profileId}/history | CUSTOMER | |
| GET | /api/v1/analytics/{profileId}/top-apps | CUSTOMER | |
| GET | /api/v1/analytics/profiles/{profileId}/app-usage | CUSTOMER | |
| GET | /api/v1/analytics/{profileId}/report/pdf | CUSTOMER | HTML report |
| GET | /api/v1/analytics/{profileId}/hourly | CUSTOMER | |
| GET | /api/v1/analytics/{profileId}/social-alerts | CUSTOMER | |
| POST | /api/v1/analytics/social-alerts/{alertId}/acknowledge | CUSTOMER | |
| GET | /api/v1/analytics/profile/{profileId}/weekly-summary | CUSTOMER | |
| GET | /api/v1/analytics/platform/overview | GLOBAL_ADMIN | |
| GET | /api/v1/analytics/platform/daily | GLOBAL_ADMIN | |
| GET | /api/v1/analytics/platform/categories | GLOBAL_ADMIN | |
| GET | /api/v1/analytics/platform/top-tenants | GLOBAL_ADMIN | |
| GET | /api/v1/analytics/platform/customers-summary | GLOBAL_ADMIN | |
| GET | /api/v1/analytics/tenant/daily | ISP_ADMIN | |
| GET | /api/v1/analytics/tenant/{tenantId}/overview | GLOBAL_ADMIN | |
| GET | /api/v1/analytics/tenant/{tenantId}/daily | GLOBAL_ADMIN | |
| GET | /api/v1/analytics/tenant/{tenantId}/categories | GLOBAL_ADMIN | |
| GET | /api/v1/analytics/tenant/{tenantId}/social-alerts | GLOBAL_ADMIN | |
| GET | /api/v1/analytics/tenant/{tenantId}/top-domains | GLOBAL_ADMIN | |
| GET | /api/v1/analytics/tenant/{tenantId}/hourly | GLOBAL_ADMIN | |
| GET | /api/v1/analytics/tenant/{tenantId}/top-categories | GLOBAL_ADMIN | |
| GET | /api/v1/analytics/alerts/{profileId} | CUSTOMER | Suspicious activity |
| POST | /api/v1/analytics/alerts/{alertId}/acknowledge | CUSTOMER | |
| GET | /api/v1/analytics/tenant/overview | ISP_ADMIN | |
| GET | /api/v1/analytics/tenant/customers | ISP_ADMIN | |
| GET | /api/v1/analytics/tenant/hourly | ISP_ADMIN | |
| GET | /api/v1/analytics/export/dns | GLOBAL_ADMIN | CSV export |
| GET | /api/v1/analytics/export/customers | GLOBAL_ADMIN | CSV export |
| *Internal* | POST /internal/analytics/log | Service-to-service | |
| *Internal* | POST /internal/analytics/log/bulk | Service-to-service | |

### 6.9 shield-admin (port 8290) — `/api/v1/admin`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/v1/admin/platform/stats | GLOBAL_ADMIN | |
| GET | /api/v1/admin/platform/revenue | GLOBAL_ADMIN | |
| GET | /api/v1/admin/platform/health | GLOBAL_ADMIN | |
| GET | /api/v1/admin/platform/system/health | GLOBAL_ADMIN | |
| GET | /api/v1/admin/platform/services | GLOBAL_ADMIN | |
| POST | /api/v1/admin/platform/services/{name}/restart | GLOBAL_ADMIN | |
| POST | /api/v1/admin/platform/services/{name}/stop | GLOBAL_ADMIN | |
| POST | /api/v1/admin/platform/services/{name}/start | GLOBAL_ADMIN | |
| GET | /api/v1/admin/platform/services/{name}/logs | GLOBAL_ADMIN | |
| GET | /api/v1/admin/plans | GLOBAL_ADMIN | |
| GET | /api/v1/admin/plans/isp | ISP_ADMIN | |
| GET | /api/v1/admin/plans/public | Public | **ISSUE: Gateway requires auth; PUBLIC_PREFIXES has it, but returned 403 unauthenticated** |
| GET | /api/v1/admin/plans/{id} | GLOBAL_ADMIN | |
| POST | /api/v1/admin/plans | GLOBAL_ADMIN | |
| PUT | /api/v1/admin/plans/{id} | GLOBAL_ADMIN | |
| DELETE | /api/v1/admin/plans/{id} | GLOBAL_ADMIN | |
| POST | /api/v1/admin/plans/{id}/sync-stripe | GLOBAL_ADMIN | |
| GET | /api/v1/admin/audit-logs | GLOBAL_ADMIN | |
| GET | /api/v1/admin/ai-settings | GLOBAL_ADMIN | |
| PUT | /api/v1/admin/ai-settings | GLOBAL_ADMIN | |
| POST | /api/v1/admin/ai-settings/test | GLOBAL_ADMIN | |
| GET | /api/v1/admin/ai-settings/providers | GLOBAL_ADMIN | |
| GET | /api/v1/admin/blocklist/global | GLOBAL_ADMIN | |
| POST | /api/v1/admin/blocklist/global | GLOBAL_ADMIN | |
| DELETE | /api/v1/admin/blocklist/global/{id} | GLOBAL_ADMIN | |
| POST | /api/v1/admin/blocklist/emergency | GLOBAL_ADMIN | |
| POST | /api/v1/admin/billing/checkout | CUSTOMER | |
| GET | /api/v1/admin/billing/subscription | CUSTOMER | |
| POST | /api/v1/admin/billing/subscription/cancel | CUSTOMER | |
| POST | /api/v1/admin/billing/trial | CUSTOMER | |
| POST | /api/v1/admin/billing/customers/{customerId}/change-plan | GLOBAL_ADMIN | |
| GET | /api/v1/admin/billing/invoices/my | CUSTOMER | |
| GET | /api/v1/admin/billing/invoices/{id}/pdf | Auth | |
| GET | /api/v1/admin/branding | ISP_ADMIN | **Returns 400 for GLOBAL_ADMIN without tenantId param** |
| PUT | /api/v1/admin/branding | ISP_ADMIN | |
| GET | /api/v1/admin/branding/public/{tenantSlug} | Public | |
| POST | /api/v1/admin/notify/app-update | GLOBAL_ADMIN | |
| POST | /api/v1/admin/notify/custom | GLOBAL_ADMIN | |
| POST | /api/v1/admin/compliance | GLOBAL_ADMIN | **Returns 400: needs X-Tenant-Id header** |
| GET | /api/v1/admin/compliance | GLOBAL_ADMIN | |
| GET | /api/v1/admin/compliance/{id} | GLOBAL_ADMIN | |
| GET | /api/v1/admin/compliance/export/{userId} | GLOBAL_ADMIN | |
| POST | /api/v1/admin/compliance/forget/{userId} | GLOBAL_ADMIN | |
| GET | /api/v1/admin/compliance/audit-trail | GLOBAL_ADMIN | |
| POST | /api/v1/admin/contact/submit | Public | |
| GET | /api/v1/admin/contact/leads | GLOBAL_ADMIN | |
| GET | /api/v1/admin/contact/leads/stats | GLOBAL_ADMIN | |
| GET | /api/v1/admin/contact/pipeline | GLOBAL_ADMIN | |
| GET | /api/v1/admin/contact/leads/{id} | GLOBAL_ADMIN | |
| PUT | /api/v1/admin/contact/leads/{id} | GLOBAL_ADMIN | |
| DELETE | /api/v1/admin/contact/leads/{id} | GLOBAL_ADMIN | |
| GET | /api/v1/admin/contact/leads/{id}/activities | GLOBAL_ADMIN | |
| POST | /api/v1/admin/contact/leads/{id}/activities | GLOBAL_ADMIN | |
| DELETE | /api/v1/admin/contact/leads/{leadId}/activities/{actId} | GLOBAL_ADMIN | |
| GET | /api/v1/admin/invoices | GLOBAL_ADMIN | |
| GET | /api/v1/admin/invoices/{id} | GLOBAL_ADMIN | |
| GET | /api/v1/admin/invoices/{id}/pdf | GLOBAL_ADMIN | |
| POST | /api/v1/admin/invoices/{id}/refund | GLOBAL_ADMIN | |
| POST | /api/v1/admin/tenants/bulk/suspend | GLOBAL_ADMIN | |
| POST | /api/v1/admin/tenants/bulk/activate | GLOBAL_ADMIN | |
| POST | /api/v1/admin/tenants/bulk/feature | GLOBAL_ADMIN | |
| GET | /api/v1/admin/tenants/stats | GLOBAL_ADMIN | |
| POST | /api/v1/admin/visitors/track | Public | |
| GET | /api/v1/admin/visitors/stats | GLOBAL_ADMIN | |
| GET | /api/v1/admin/visitors | GLOBAL_ADMIN | |
| POST | /api/v1/admin/import | GLOBAL_ADMIN | Multipart |
| GET | /api/v1/admin/import/{jobId} | GLOBAL_ADMIN | |
| GET | /api/v1/admin/import | GLOBAL_ADMIN | List jobs |
| POST | /api/v1/admin/tr069/webhook | Auth/Webhook | |
| GET | /api/v1/admin/tr069 | GLOBAL_ADMIN | |
| DELETE | /api/v1/admin/tr069/{provisionId} | GLOBAL_ADMIN | |
| POST | /api/v1/billing/webhook | Public (Stripe) | |
| *Internal* | POST /internal/audit | Service-to-service | |

### 6.10 shield-ai (port 8291) — `/api/v1/ai`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/v1/ai/model/health | Auth | |
| GET | /api/v1/ai/actuator/health | Public | |
| GET | /api/v1/ai/{profile_id}/weekly | Auth | Weekly digest |
| GET | /api/v1/ai/{profile_id}/insights | Auth | |
| POST | /api/v1/ai/analyze/batch | Auth | Anomaly detection |
| GET | /api/v1/ai/{profile_id}/keywords | Auth | |
| POST | /api/v1/ai/{profile_id}/keywords | Auth | |
| GET | /api/v1/ai/{profile_id}/mental-health | Auth | |
| GET | /api/v1/ai/alerts | Auth | |
| POST | /api/v1/ai/alerts/{alert_id}/feedback | Auth | |
| POST | /api/v1/ai/train | Auth | |
| GET | /api/v1/ai/train/status | Auth | |
| POST | /api/v1/ai/config/reload | Auth | |
| GET | /api/v1/ai/config/current | Auth | |
| POST | /api/v1/ai/chat | Auth | |
| POST | /api/v1/ai/chat/stream | Auth | |
| GET | /api/v1/ai/safe-chat/health | Auth | |
| POST | /api/v1/ai/safe-chat | Auth | |

---

## 7. Gateway Route Analysis

### 7.1 Gateway Routes Defined

| Route ID | Predicate | Target Service |
|---|---|---|
| shield-auth-login | /api/v1/auth/login | SHIELD-AUTH |
| shield-auth-register | /api/v1/auth/register | SHIELD-AUTH |
| shield-auth | /api/v1/auth/** | SHIELD-AUTH |
| shield-tenant | /api/v1/tenants/** | SHIELD-TENANT |
| shield-profile | /api/v1/profiles/** | SHIELD-PROFILE |
| shield-dns | /api/v1/dns/** | SHIELD-DNS |
| shield-location | /api/v1/location/** | SHIELD-LOCATION |
| shield-location-share-public | /public/location/share/** | SHIELD-LOCATION |
| shield-notification | /api/v1/notifications/** | SHIELD-NOTIFICATION |
| shield-notification-ws | /ws/** | SHIELD-NOTIFICATION (WS) |
| shield-rewards | /api/v1/rewards/** | SHIELD-REWARDS |
| shield-analytics | /api/v1/analytics/** | SHIELD-ANALYTICS |
| shield-admin | /api/v1/admin/** | SHIELD-ADMIN |
| shield-ai | /api/v1/ai/** | localhost:8291 |
| shield-billing-webhook | /api/v1/billing/** | SHIELD-ADMIN |
| + 9 Swagger doc routes | /docs/{service}/** | Each service |

### 7.2 Missing Gateway Routes

| Controller Path | Service | Issue |
|---|---|---|
| `/api/v1/tenant/tenants/**` | shield-tenant | Alternate RequestMapping path not routed — **returns 404** |

### 7.3 AI Service Gateway Rewrite Concern

The gateway has `RewritePath=/api/v1/ai/(?<segment>.*), /ai/${segment}` but FastAPI routers use `prefix="/api/v1/ai"`. This means:
- Gateway sends `/ai/model/health` to FastAPI
- FastAPI expects `/api/v1/ai/model/health`

**However, live testing showed AI endpoints return correct data with auth.** This likely means the AKS deployment has a corrected gateway config or the AI service has been adapted. Verify that the local codebase matches the deployed configuration.

---

## 8. Routes That Return Errors

| Route | Status | Token | Error Detail |
|---|---|---|---|
| GET /api/v1/admin/compliance | 400 | ADMIN | "Required header 'X-Tenant-Id' is missing" — expected for multi-tenant GET |
| GET /api/v1/admin/branding | 400 | ADMIN | "GLOBAL_ADMIN must supply a tenantId query param" — design choice |
| GET /api/v1/profiles/devices/all | 403 | CUSTOMER | Correct — requires GLOBAL_ADMIN |
| GET /api/v1/profiles/family-rules | **500** | CUSTOMER | **BUG: INTERNAL_ERROR ref C19F4038** |
| GET /api/v1/location/sos/platform | **404** | ADMIN | **Route exists in controller but returns 404 on AKS** |
| GET /api/v1/admin/plans/public | **403** | None | **BUG: Listed in PUBLIC_PREFIXES but gateway returns 403 unauthenticated. The isPublic() check uses `startsWith` — `/api/v1/admin/plans/public` should match. Possible: admin service's SecurityConfig rejects unauthenticated requests.** |
| GET /api/v1/tenants/allowlist | 403 | CUSTOMER | Correct — requires ISP_ADMIN |
| GET /api/v1/tenants/blocklist | 403 | CUSTOMER | Correct — requires ISP_ADMIN |
| GET /api/v1/ai/model/health | 401 | None | Gateway requires auth (not in PUBLIC_PREFIXES) |

---

## 9. Recommendations

### CRITICAL (fix immediately)

1. **Family Rules 500 Error** — `GET /api/v1/profiles/family-rules` returns 500 for CUSTOMER role. Investigate service logs for ref `C19F4038`. Likely a null-pointer in the query (possibly `family_rules` table is empty and the service doesn't handle that).

2. **293 Orphaned Notifications** — 66% of notifications reference 4 deleted user_ids. These will cause errors if any code tries to resolve user details. Add a cleanup migration or soft-delete cascade.

3. **2 Orphaned DNS Rules** — One references a test UUID (`00000000-...-000000000099`), the other a deleted profile. These should be cleaned up to avoid resolver errors.

### HIGH (fix soon)

4. **Plans /public endpoint unreachable** — `GET /api/v1/admin/plans/public` is in PUBLIC_PREFIXES but returns 403 without auth. The admin service's SecurityConfig likely requires authentication on all `/api/v1/admin/**` paths. Add an explicit `permitAll()` for this path in the admin SecurityConfig.

5. **SOS /platform endpoint 404** — `GET /api/v1/location/sos/platform` returns 404 even with GLOBAL_ADMIN token. The controller exists but the mapping may conflict with `/{profileId}/sos`. Spring may be interpreting `sos` as a path variable. Check controller mapping order.

6. **CUSTOMER user without tenant_id** — `newcust.test@example.com` has NULL tenant_id. This will cause NPEs in tenant-scoped queries. Either assign a tenant or deactivate.

7. **AI Gateway RewritePath mismatch** — The local gateway config rewrites `/api/v1/ai/X` to `/ai/X` but FastAPI routers use prefix `/api/v1/ai`. Verify AKS config matches. If the rewrite is active, the AI service would need to serve at `/ai/` not `/api/v1/ai/`.

### MEDIUM (improve)

8. **Missing `/api/v1/tenant/tenants` gateway route** — The TenantController dual-maps this path but the gateway only routes `/api/v1/tenants/**`. Either add the route or remove the alternate mapping.

9. **17 tables missing both created_at and updated_at** — Particularly concerning for security tables (`suspicious_activity_alerts`, `spoofing_alerts`, `geofence_events`) and billing (`subscription_history`). Add timestamp columns.

10. **6 tables have no non-PK indexes** — While currently small, `ai.ai_keywords`, `ai.training_feedback`, and `rewards.badges` should get indexes before data grows.

11. **ai schema is completely empty** — All 4 tables (ai_alerts, ai_keywords, ai_alert_feedback, training_feedback) have 0 rows. Either the AI pipeline is not persisting data or it's not yet in production use.

### LOW (housekeeping)

12. **2 inactive users** — `ispadmin@test.com` and `john@family.demo` are inactive. Consider cleanup if they're test accounts.

13. **No cross-schema foreign keys** — By microservice design, but consider adding database-level constraints for the most critical relationships (dns_rules.profile_id -> child_profiles.id) to prevent orphans at the DB level.

---

## 10. Summary

| Metric | Value |
|---|---|
| Total tables | 104 (across 11 schemas including public) |
| Total rows | ~459,000+ |
| Flyway migrations | 118 total, **0 failures** |
| FK constraints | 17 defined, **0 violated** (within-schema only) |
| Orphaned records | **295** (293 notifications + 2 DNS rules) |
| API routes (public) | **~230** endpoints across 10 services |
| Internal routes | **~30** service-to-service endpoints |
| Gateway routes | 16 (all services covered) |
| Routes tested | 27 |
| Routes returning errors | **3 bugs** (500, 404, 403-on-public) + 2 expected 400s |
| Missing gateway routes | **1** (`/api/v1/tenant/tenants`) |

**Overall Database Health: GOOD** — No failed migrations, no FK violations, partitioning working, indexes adequate. Main concern is orphaned records from deleted users.

**Overall API Health: GOOD with 3 bugs** — The family-rules 500 error is the highest priority fix. The plans/public 403 and SOS/platform 404 are lower but should be addressed.
