# 08 — API Reference

## Base URL

```
https://shield.rstglobal.in/api/v1
```

## Authentication

All endpoints (except `/auth/**`) require:
```
Authorization: Bearer <jwt-access-token>
```

Child app endpoints (`/child/**`) use a long-lived child device token:
```
Authorization: Bearer <child-app-token>
```

---

## Auth Service (`/api/v1/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | None | Customer self-registration |
| POST | `/auth/login` | None | Login → returns JWT pair |
| POST | `/auth/refresh` | Refresh token | Issue new access token |
| POST | `/auth/logout` | JWT | Blacklist tokens |
| POST | `/auth/forgot-password` | None | Send reset email |
| POST | `/auth/reset-password` | None | Apply new password via token |
| GET | `/auth/me` | JWT | Current user info |
| POST | `/auth/child/token` | JWT (CUSTOMER) | Issue child app device token |

**POST /auth/login**
```json
// Request
{ "email": "parent@example.com", "password": "secret", "tenantSlug": "rst-default" }

// Response 200
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "abc-uuid-123",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "email": "parent@example.com",
    "firstName": "John",
    "role": "CUSTOMER",
    "tenantId": "uuid"
  }
}
```

---

## Profile Service (`/api/v1`)

### Child Profiles

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/children` | CUSTOMER | List all child profiles |
| POST | `/children` | CUSTOMER | Create child profile |
| GET | `/children/{id}` | CUSTOMER | Get child profile detail |
| PUT | `/children/{id}` | CUSTOMER | Update child profile |
| DELETE | `/children/{id}` | CUSTOMER | Delete child profile |
| GET | `/children/{id}/doh-url` | CUSTOMER | Get DoH URL for device setup |
| GET | `/children/{id}/status` | CUSTOMER | Online status + battery |

**POST /children**
```json
// Request
{
  "name": "Jake",
  "dateOfBirth": "2014-06-15",
  "ageGroup": "CHILD",
  "filterLevel": "STRICT",
  "avatarUrl": null
}

// Response 201
{
  "id": "profile-uuid",
  "name": "Jake",
  "dnsClientId": "jake-3f2a",
  "dohUrl": "https://jake-3f2a.dns.shield.rstglobal.in/dns-query",
  "ageGroup": "CHILD",
  "filterLevel": "STRICT"
}
```

### Devices

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/devices` | CUSTOMER | List all registered devices |
| POST | `/devices` | CUSTOMER | Register device to child profile |
| GET | `/devices/qr/{profileId}` | CUSTOMER | QR code for Private DNS setup |
| DELETE | `/devices/{id}` | CUSTOMER | Remove device |
| PUT | `/devices/{id}/transfer` | CUSTOMER | Transfer to another profile |
| GET | `/devices/{id}/status` | CUSTOMER | Online status, battery, last seen |

### Family Members

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/family` | CUSTOMER | List co-guardians |
| POST | `/family/invite` | CUSTOMER | Invite co-parent by email |
| DELETE | `/family/{id}` | CUSTOMER | Remove co-parent |

---

## DNS Service (`/api/v1`)

### Filtering Rules

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/rules/{profileId}` | CUSTOMER | Get all rules for profile |
| PUT | `/rules/{profileId}/categories` | CUSTOMER | Update category toggles |
| PUT | `/rules/{profileId}/allowlist` | CUSTOMER | Update custom allow list |
| PUT | `/rules/{profileId}/blocklist` | CUSTOMER | Update custom block list |
| GET | `/rules/{profileId}/activity` | CUSTOMER | Recent DNS queries (paged) |
| POST | `/rules/{profileId}/domain/action` | CUSTOMER | Allow/block specific domain now |
| GET | `/categories` | CUSTOMER | List all 80+ categories |

**PUT /rules/{profileId}/categories**
```json
{
  "adult": false,
  "gambling": false,
  "gaming": true,
  "socialMedia": true,
  "streaming": true,
  "vpnProxy": false,
  "malware": true,
  "phishing": true
}
```

### Schedules

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/schedules/{profileId}` | CUSTOMER | Get weekly schedule grid |
| PUT | `/schedules/{profileId}` | CUSTOMER | Save full schedule grid |
| POST | `/schedules/{profileId}/preset` | CUSTOMER | Apply preset (SCHOOL/BEDTIME/etc) |
| POST | `/schedules/{profileId}/override` | CUSTOMER | Temporary override (pause/resume) |
| DELETE | `/schedules/{profileId}/override` | CUSTOMER | Cancel active override |

### Time Budgets

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/budgets/{profileId}` | CUSTOMER | Get configured budgets |
| PUT | `/budgets/{profileId}` | CUSTOMER | Update daily limits |
| GET | `/budgets/{profileId}/today` | CUSTOMER | Today's usage per app |
| POST | `/budgets/{profileId}/extend` | CUSTOMER | Grant time extension |
| POST | `/child/budgets/request` | CHILD_APP | Child requests extension |

**GET /budgets/{profileId}/today** Response:
```json
{
  "profileId": "uuid",
  "date": "2026-03-04",
  "usage": {
    "youtube": { "limitMinutes": 120, "usedMinutes": 92, "status": "ACTIVE" },
    "tiktok":  { "limitMinutes": 60, "usedMinutes": 24, "status": "ACTIVE" },
    "total":   { "limitMinutes": 300, "usedMinutes": 156, "status": "ACTIVE" }
  }
}
```

---

## Location Service (`/api/v1`)

### GPS Tracking

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/location/{profileId}/live` | CUSTOMER | Current GPS position |
| GET | `/location/{profileId}/history` | CUSTOMER | History (date range query param) |
| GET | `/location/{profileId}/speed` | CUSTOMER | Current speed (driving detection) |
| POST | `/child/location/update` | CHILD_APP | Upload GPS coordinates (every 60s) |
| POST | `/child/location/checkin` | CHILD_APP | Manual check-in (I'm at school) |
| POST | `/child/location/panic` | CHILD_APP | SOS — sends emergency alert |

**POST /child/location/panic**
```json
// Request
{ "latitude": 53.3498, "longitude": -6.2603, "accuracy": 12.5, "message": null }

// Response 201
{ "eventId": "panic-uuid", "received": true, "alertsSent": 2 }
```

### Geofences

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/geofences` | CUSTOMER | List all geofences |
| POST | `/geofences` | CUSTOMER | Create geofence |
| PUT | `/geofences/{id}` | CUSTOMER | Update geofence |
| DELETE | `/geofences/{id}` | CUSTOMER | Delete geofence |

**POST /geofences (circle)**
```json
{
  "name": "School",
  "type": "CIRCLE",
  "profileId": null,
  "centerLat": 53.3398, "centerLng": -6.2493,
  "radiusM": 250,
  "alertOnEnter": true, "alertOnExit": true
}
```

### Named Places

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/places` | CUSTOMER | List named places |
| POST | `/places` | CUSTOMER | Create named place |
| PUT | `/places/{id}` | CUSTOMER | Update place |
| DELETE | `/places/{id}` | CUSTOMER | Delete place |
| GET | `/places/{id}/visits` | CUSTOMER | Arrival/departure history |

---

## Rewards Service (`/api/v1`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/rewards/{profileId}/tasks` | CUSTOMER | List tasks |
| POST | `/rewards/{profileId}/tasks` | CUSTOMER | Create task |
| PUT | `/rewards/{profileId}/tasks/{id}` | CUSTOMER | Update task |
| DELETE | `/rewards/{profileId}/tasks/{id}` | CUSTOMER | Delete task |
| PUT | `/rewards/tasks/{id}/approve` | CUSTOMER | Approve → credit bank |
| PUT | `/rewards/tasks/{id}/reject` | CUSTOMER | Reject with reason |
| POST | `/child/rewards/tasks/{id}/complete` | CHILD_APP | Mark task done |
| GET | `/rewards/{profileId}/bank` | CUSTOMER | Reward bank balance |
| POST | `/rewards/{profileId}/use` | CUSTOMER | Redeem minutes |
| POST | `/rewards/{profileId}/bonus` | CUSTOMER | Ad-hoc bonus |
| GET | `/rewards/{profileId}/achievements` | CUSTOMER | Earned badges |
| GET | `/rewards/{profileId}/streaks` | CUSTOMER | Streak data |

---

## Analytics Service (`/api/v1`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/analytics/{profileId}/usage/today` | CUSTOMER | Today's usage stats |
| GET | `/analytics/{profileId}/usage/week` | CUSTOMER | 7-day chart data |
| GET | `/analytics/{profileId}/top-domains` | CUSTOMER | Top accessed domains |
| GET | `/analytics/{profileId}/blocked` | CUSTOMER | Block event history (paged) |
| GET | `/analytics/{profileId}/report/pdf` | CUSTOMER | Download PDF report |
| GET | `/analytics/tenant/summary` | ISP_ADMIN | ISP-level aggregated stats |
| GET | `/analytics/platform/dashboard` | GLOBAL_ADMIN | Platform-wide dashboard data |

---

## AI Service (`/api/v1`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/ai/{profileId}/weekly` | CUSTOMER | AI-generated weekly summary |
| GET | `/ai/{profileId}/insights` | CUSTOMER | Risk indicators + anomaly scores |
| GET | `/ai/{profileId}/mental-health` | CUSTOMER | Mental health signal dashboard |
| POST | `/ai/{profileId}/keywords` | CUSTOMER | Set custom keyword watch list |
| GET | `/ai/alerts` | CUSTOMER | AI-generated alerts with context |
| POST | `/ai/alerts/{id}/feedback` | CUSTOMER | Rate alert accuracy |

**GET /ai/{profileId}/weekly** Response:
```json
{
  "profileId": "uuid",
  "weekOf": "2026-03-02",
  "summary": "Jake had a generally healthy week online. He stayed within his YouTube limit on 5 out of 7 days. No concerning patterns were detected. His screen time was 14% below last week.",
  "riskLevel": "LOW",
  "signals": [],
  "usageTrend": "DOWN",
  "recommendedConversation": null,
  "generatedAt": "2026-03-04T08:00:00Z"
}
```

---

## Tenant Service — ISP Admin (`/api/v1/tenant`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/tenant/me` | ISP_ADMIN | Own tenant info |
| PUT | `/tenant/branding` | ISP_ADMIN | Update ISP branding |
| GET | `/tenant/customers` | ISP_ADMIN | List customers (paged) |
| POST | `/tenant/customers` | ISP_ADMIN | Create customer account |
| PUT | `/tenant/customers/{id}/plan` | ISP_ADMIN | Change customer plan |
| DELETE | `/tenant/customers/{id}` | ISP_ADMIN | Deactivate customer |
| GET | `/tenant/analytics` | ISP_ADMIN | ISP analytics summary |
| POST | `/tenant/blocklist` | ISP_ADMIN | Add ISP-level blocked domain |
| DELETE | `/tenant/blocklist/{id}` | ISP_ADMIN | Remove ISP-level block |

---

## Global Admin Service (`/api/v1/admin`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/dashboard` | GLOBAL_ADMIN | Platform-wide dashboard |
| GET | `/admin/tenants` | GLOBAL_ADMIN | List all ISP tenants |
| POST | `/admin/tenants` | GLOBAL_ADMIN | Create new ISP tenant |
| PUT | `/admin/tenants/{id}` | GLOBAL_ADMIN | Update tenant config |
| PUT | `/admin/tenants/{id}/features` | GLOBAL_ADMIN | Update feature flags |
| GET | `/admin/tenants/{id}/stats` | GLOBAL_ADMIN | Tenant usage statistics |
| DELETE | `/admin/tenants/{id}` | GLOBAL_ADMIN | Deactivate tenant |
| POST | `/admin/blocklist/global` | GLOBAL_ADMIN | Add global blocked domain |
| POST | `/admin/blocklist/emergency` | GLOBAL_ADMIN | Emergency global block (instant) |

---

## Error Response Format

All errors return:
```json
{
  "success": false,
  "error": "PROFILE_NOT_FOUND",
  "message": "Child profile with ID 'abc123' not found",
  "timestamp": "2026-03-04T17:30:00Z",
  "path": "/api/v1/children/abc123"
}
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted successfully |
| 400 | Validation error (see `fieldErrors` in response) |
| 401 | Unauthorized (missing or invalid JWT) |
| 403 | Forbidden (correct JWT but wrong role) |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, etc.) |
| 429 | Rate limit exceeded |
| 502 | Upstream service unavailable |
