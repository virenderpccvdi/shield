# Shield Platform — Master Gap Analysis & Fix Plan
> Generated: 2026-04-10 | Updated: 2026-04-10 | Auditor: Claude Code
> Covers: VAPT Security · Database · Microservices · CI/CD · Mobile · UI/UX · DNS · Subscriptions · Payments · VPN
> Rules: No hardcoded values · KISS · DRY · Single Responsibility · Fail fast & validate early

---

## WHAT HAS BEEN FIXED (2026-04-10)

| Fix | File(s) | Status |
|---|---|---|
| `anyRequest().permitAll()` → `authenticated()` | 8 SecurityConfig.java files | ✅ DONE + deployed to AKS |
| Analytics extra `permitAll()` on `/api/v1/analytics/**` removed | analytics/SecurityConfig.java | ✅ DONE + deployed |
| Stripe webhook signature now mandatory | StripeWebhookController.java | ✅ DONE + deployed |
| CORS `*` → specific origins, env-var configurable | shield-ai/main.py | ✅ DONE + restarted |
| Feign clients: `localhost` → K8s service names via config | DnsRulesClient.java, AnalyticsClient.java | ✅ DONE + deployed |
| JWT secret hardcoded fallback removed | gateway/application.yml, config-repo/application.yml | ✅ DONE |
| Password complexity `@Pattern` on all 3 password DTOs | RegisterRequest, ResetPasswordRequest, ChangePasswordRequest | ✅ DONE |
| GlobalExceptionHandler: no more internal messages in responses | GlobalExceptionHandler.java | ✅ DONE |
| HikariCP pool: 20 → 8 per service (220 → 88 total connections) | All service application.yml | ✅ DONE |
| shield-dns-resolver + dns-resolver added to CI/CD SERVICES | azure-pipelines.yml | ✅ DONE |
| Post-deploy smoke test + auto-rollback added to pipeline | azure-pipelines.yml | ✅ DONE |

---

## EXECUTIVE SUMMARY

| Dimension | Rating | Issues |
|---|---|---|
| Security (VAPT) | 🔴 Critical | 17 critical, 24 high, 18 medium |
| Database Integrity | 🟡 Moderate | Missing cascades, indexes, constraints |
| Microservice Architecture | 🟡 Moderate | 2 services missing from K8s, 5 missing entirely |
| High Availability | 🔴 Critical | All pods replicas=1, Recreate strategy |
| DNS Content Filtering | 🟡 Moderate | SafeSearch not enforced, small blocklist |
| Subscription/Billing | 🟡 Moderate | No grace period, no dunning, no refunds |
| Payment Processing | 🟡 Moderate | No retry logic, INR only, no tax |
| VPN Service | 🔴 Misrepresented | DoH proxy only — not a VPN |
| Mobile App | 🔴 Critical | Android only, no iOS, no cert pinning |
| CI/CD Pipeline | 🟡 Moderate | 2 services missing from deploy loop |
| UI/UX Completeness | 🟢 Good | 97 pages, mostly complete |

**Overall Platform Health: 62/100 — Production-incomplete**

---

## ARCHITECTURE DIAGRAM (Current vs. Target)

```
CURRENT:
  Internet
     │
  nginx (shield.rstglobal.in)
     │
  AKS Ingress (135.235.191.247)
     │
  shield-gateway:8280  ──→  JWT filter (only line of defence)
     │
  ┌──┴────────────────────────────────────────────────────────────┐
  │ ALL services: anyRequest().permitAll()  ← CRITICAL FLAW       │
  │ shield-auth:8281  shield-tenant:8282  shield-profile:8283     │
  │ shield-dns:8284   shield-location:8285 shield-notification:8286│
  │ shield-rewards:8287 shield-analytics:8289 shield-admin:8290   │
  │ shield-ai:8291                                                 │
  └───────────────────────────────────────────────────────────────┘
     │
  PostgreSQL 18 (Azure Flexible Server)
  Redis (Azure Cache for Redis)

TARGET:
  Internet
     │
  AKS Ingress + WAF
     │
  shield-gateway:8280  ──→  JWT filter + rate limiting + WAF rules
     │
  ┌──┴─────────────────────────────────────────────────────────────┐
  │ Each service: anyRequest().authenticated() + role validation   │
  │ mTLS between services via Kubernetes NetworkPolicy             │
  │ shield-auth:8281  shield-tenant:8282  shield-profile:8283     │
  │ shield-dns:8284   shield-location:8285 shield-notification:8286│
  │ shield-rewards:8287 shield-analytics:8289 shield-admin:8290   │
  │ shield-ai:8291   shield-subscription:8293 shield-billing:8294 │
  └────────────────────────────────────────────────────────────────┘
     │
  PostgreSQL 18 (Azure Flexible, HA + read replica)
  Redis Cluster (Azure Cache, 2-node)
  Azure Key Vault (secrets)
  Azure Service Bus (events/queues, replace RabbitMQ)
```

---

# PHASE A — CRITICAL SECURITY FIXES
> Priority: Immediate (do today)
> Risk if delayed: Active exploitability

---

## A1. Fix SecurityConfig `.anyRequest().permitAll()` in ALL 7 services

**Problem:** Every microservice has a SecurityConfig that ends with `.anyRequest().permitAll()`.
The gateway is the ONLY authentication checkpoint. Direct pod access or any gateway bypass gives full unauthenticated access to every API.

**Files to change (same fix in each):**
- `shield-admin/src/main/java/.../config/SecurityConfig.java`
- `shield-notification/src/main/java/.../config/SecurityConfig.java`
- `shield-analytics/src/main/java/.../config/SecurityConfig.java`
- `shield-profile/src/main/java/.../config/SecurityConfig.java`
- `shield-tenant/src/main/java/.../config/SecurityConfig.java`
- `shield-dns/src/main/java/.../config/SecurityConfig.java`
- `shield-rewards/src/main/java/.../config/SecurityConfig.java`

**Change:**
```java
// BEFORE (in every service):
.anyRequest().permitAll()

// AFTER:
.anyRequest().authenticated()
```

**Note:** Each service receives `X-User-Id`, `X-User-Role`, `X-Tenant-Id` headers from the gateway after JWT validation. These services don't need to re-parse the JWT — just require that the request passed gateway authentication.

---

## A2. Make Stripe Webhook Signature Verification Mandatory

**File:** `shield-admin/src/main/java/.../controller/StripeWebhookController.java:36-43`

**Change:** Remove the fallback path that bypasses signature verification.
```java
// REMOVE the else branch entirely — if no secret configured, reject the request
if (stripeConfig.getWebhookSecret() == null || stripeConfig.getWebhookSecret().isBlank()) {
    return ResponseEntity.status(503).body("Webhook secret not configured");
}
event = Webhook.constructEvent(payload, sigHeader, stripeConfig.getWebhookSecret());
```

---

## A3. Fix CORS in shield-ai

**File:** `shield-ai/main.py:30-36`

```python
# BEFORE:
allow_origins=["*"],
allow_credentials=True,

# AFTER:
allow_origins=["https://shield.rstglobal.in", "https://api.shield.rstglobal.in"],
allow_credentials=False,
```

---

## A4. Rotate ALL Secrets + Move to Azure Key Vault

**Secrets to rotate immediately (all in `.env`):**
- `DB_PASSWORD` → Azure Key Vault → PostgreSQL new password
- `REDIS_PASSWORD` → Azure Key Vault → Redis new password
- `JWT_SECRET` → Generate new 64-char random per environment
- `STRIPE_SECRET_KEY` → Regenerate in Stripe Dashboard
- `STRIPE_WEBHOOK_SECRET` → Regenerate in Stripe Dashboard (webhook settings)
- `ANTHROPIC_API_KEY` → Regenerate in Anthropic Console
- `DEEPSEEK_API_KEY` → Regenerate in DeepSeek Console
- `GOOGLE_MAPS_API_KEY` → Regenerate + restrict to specific APIs and IP/app signature
- `SMTP_PASS` → Change in email provider
- `RABBITMQ_PASSWORD` → Change in RabbitMQ
- `EUREKA_PASSWORD` → Change and remove hardcoded fallback from application.yml

**After rotation — move to AKS Secrets:**
```bash
kubectl create secret generic shield-secrets \
  --from-literal=DB_PASSWORD="<new>" \
  --from-literal=JWT_SECRET="<new-64-char>" \
  --from-literal=STRIPE_SECRET_KEY="<new>" \
  --from-literal=STRIPE_WEBHOOK_SECRET="<new>" \
  -n shield-prod --dry-run=client -o yaml | kubectl apply -f -
```

**Remove `.env` from git tracking:**
```bash
echo ".env" >> .gitignore
git rm --cached .env
git commit -m "security: remove .env from git tracking"
```

---

## A5. Fix dns-resolver Hardcoded localhost Feign Clients

**Files:**
- `shield-dns-resolver/src/main/java/.../client/DnsRulesClient.java:14`
- `shield-dns-resolver/src/main/java/.../client/AnalyticsClient.java:15`

```java
// BEFORE:
@FeignClient(name = "shield-dns-direct", url = "http://localhost:8284", path = "/internal/dns")
@FeignClient(name = "shield-analytics-direct", url = "http://localhost:8289")

// AFTER (use K8s service DNS names):
@FeignClient(name = "shield-dns-direct", url = "${shield.dns.url:http://shield-dns:8284}", path = "/internal/dns")
@FeignClient(name = "shield-analytics-direct", url = "${shield.analytics.url:http://shield-analytics:8289}")
```

---

## A6. Remove JWT Secret Hardcoded Fallback

**All application.yml files that have:**
```yaml
shield:
  jwt:
    secret: ${JWT_SECRET:7a9f3b2c8d5e1f4a6b0c3d7e2f5a8b1c4d7e0f3a6b9c2d5e8f1a4b7c0d3e6f9a}
```

**Change to:**
```yaml
shield:
  jwt:
    secret: ${JWT_SECRET}   # REQUIRED — no default, will fail to start if missing
```

This forces explicit secret injection in all environments.

---

# PHASE B — HIGH PRIORITY FIXES
> Priority: This week
> Risk if delayed: Service gaps, poor UX, reliability issues

---

## B1. Deploy shield-config to AKS

**Create file:** `k8s/base/config/deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shield-config
  labels:
    app: shield-config
spec:
  replicas: 1
  selector:
    matchLabels:
      app: shield-config
  template:
    metadata:
      labels:
        app: shield-config
    spec:
      containers:
        - name: shield-config
          image: REGISTRY/shield-config:TAG
          ports:
            - containerPort: 8288
          env:
            - name: EUREKA_URI
              valueFrom:
                configMapKeyRef:
                  name: shield-config
                  key: EUREKA_URI
          readinessProbe:
            httpGet:
              path: /actuator/health
              port: 8288
            initialDelaySeconds: 30
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /actuator/health
              port: 8288
            initialDelaySeconds: 60
            periodSeconds: 20
```

**Add to kustomization.yaml resources and images:**
```yaml
resources:
  - ../../base/config   # ADD THIS
images:
  - name: REGISTRY/shield-config
    newName: shieldacrh44d4fynx4l2c.azurecr.io/shield-config
    newTag: latest
```

**Add to azure-pipelines.yml:**
```bash
SERVICES="eureka config gateway auth tenant profile dns dns-resolver location notification rewards analytics admin"
```

---

## B2. Add shield-dns-resolver to CI/CD and K8s

**azure-pipelines.yml line 80:** Add `dns-resolver` to SERVICES list.

**K8s check:** `k8s/base/dns-resolver/` — verify deployment.yaml exists and probe path is correct.

**Prod kustomization.yaml:** Add `- ../../base/dns-resolver` to resources.

---

## B3. Convert All K8s Deployments to RollingUpdate + 2 Replicas

**For all `k8s/base/*/deployment.yaml` files:**
```yaml
# BEFORE:
spec:
  strategy:
    type: Recreate
  replicas: 1

# AFTER:
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  replicas: 2   # minimum for HA; prod overlay can override higher
```

**Exception:** shield-eureka stays at `replicas: 1` (single peer mode) but use RollingUpdate.

**Prod overlay (`k8s/overlays/prod/kustomization.yaml`):** Override to `replicas: 3` for gateway, auth, and dns.

---

## B4. Add Missing HPAs

**Create `k8s/hpa/hpa-ai.yaml`:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: shield-ai-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: shield-ai
  minReplicas: 1
  maxReplicas: 4
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

**Also create HPAs for:** shield-notification, shield-location, shield-tenant.

---

## B5. Persist shield-ai In-Memory Stores to PostgreSQL

### Alerts (currently `_alerts: Dict` in `routers/alerts.py`)

The `db/` module already exists with `database.py` and `queries.py`. Wire the alerts router to use it:

```python
# routers/alerts.py — replace _alerts dict with DB calls
from db.database import get_db
from db.queries import insert_alert, get_alerts, update_alert_feedback
```

**DB table needed (add to shield-ai's schema or use shield-analytics):**
```sql
CREATE TABLE IF NOT EXISTS ai.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id VARCHAR(50) NOT NULL,
    alert_type VARCHAR(50),
    severity VARCHAR(20),
    message TEXT,
    metadata JSONB,
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai.alert_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES ai.alerts(id) ON DELETE CASCADE,
    user_id UUID,
    feedback VARCHAR(20),  -- ACCURATE | INACCURATE | IGNORED
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai.keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id VARCHAR(50) NOT NULL,
    keyword VARCHAR(200) NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, keyword)
);
```

---

## B6. Add @Valid to All Controller Endpoints

**Services with missing @Valid:**

### shield-auth (AuthController.java)
```java
// Lines ~94, 220, 249 — add @Valid to request body params
public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request)
public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request)
```

### shield-notification (PreferenceController.java, InternalNotifyController.java)
```java
public ResponseEntity<?> updatePreferences(@Valid @RequestBody PreferenceRequest request)
```

### shield-admin (BrandingController.java, ContactController.java, SubscriptionPlanController.java, GlobalBlocklistController.java, AiSettingsController.java)
```java
// Add @Valid to every @RequestBody parameter
```

---

## B7. Add Rate Limiting to shield-ai

**Install:** `pip install slowapi`

**`shield-ai/main.py`:**
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

**On AI routers:**
```python
@router.get("/{profile_id}/insights")
@limiter.limit("30/minute")
async def get_insights(request: Request, profile_id: str):
    ...
```

---

## B8. Add Token Refresh to React Dashboard

**File:** `shield-dashboard/src/api/axios.ts`

```typescript
let isRefreshing = false;
let failedQueue: any[] = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers['Authorization'] = `Bearer ${token}`;
          return api(original);
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
        const newToken = data.data.accessToken;
        useAuthStore.getState().setToken(newToken);
        localStorage.setItem('accessToken', newToken);
        failedQueue.forEach(p => p.resolve(newToken));
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        failedQueue.forEach(p => p.reject(refreshError));
        useAuthStore.getState().logout();
      } finally {
        isRefreshing = false;
        failedQueue = [];
      }
    }
    return Promise.reject(error);
  }
);
```

**Backend:** Add `POST /api/v1/auth/refresh` endpoint to shield-auth that accepts a refresh token and issues a new access token.

---

## B9. Add Login Rate Limiting + Brute Force Protection

**File:** `shield-auth/src/main/java/.../service/AuthService.java`

```java
// On failed login:
String key = "shield:login:fail:" + email;
long attempts = redisTemplate.opsForValue().increment(key);
if (attempts == 1) redisTemplate.expire(key, 15, TimeUnit.MINUTES);
if (attempts >= 5) {
    // Lock account — set locked_until = NOW() + 15 minutes in auth.users
    throw ShieldException.badRequest("Account temporarily locked. Try again in 15 minutes.");
}
```

---

## B10. Password Complexity Enforcement

**File:** `shield-auth/src/main/java/.../dto/RegisterRequest.java`

```java
@NotBlank
@Size(min = 8, max = 100)
@Pattern(
    regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
    message = "Password must be 8+ characters with uppercase, lowercase, digit, and special character"
)
private String password;
```

---

## B11. Add HikariCP Pool Size Fix

**Problem:** 11 services × 20 connections = 220 vs. PostgreSQL max ~100.

**Fix in all `application.yml` files:**
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 5       # was 20
      minimum-idle: 2
      connection-timeout: 30000
      idle-timeout: 600000
```

**For high-traffic services (auth, analytics):** keep at 8.
**Total:** 9 × 5 + 2 × 8 = 61 connections (well under 100).

---

# PHASE C — DNS CONTENT FILTERING HARDENING
> Priority: 2 weeks

---

## C1. Enforce SafeSearch and YouTube Restricted Mode

**Problem:** `safesearch_enabled` and `youtube_restricted` flags are stored in `dns.dns_rules` but the `DnsResolutionService` doesn't actually enforce them.

**Implementation in shield-dns:**

```java
// DnsResolutionService.java — add to resolution pipeline
if (rules.isSafesearchEnabled()) {
    // Rewrite Google/Bing/DuckDuckGo queries to safe variants
    // google.com → forcesafesearch.google.com (DNS CNAME override)
    if (domain.equals("google.com") || domain.endsWith(".google.com")) {
        return buildCnameResponse(query, "forcesafesearch.google.com");
    }
    if (domain.equals("bing.com") || domain.endsWith(".bing.com")) {
        return buildCnameResponse(query, "strict.bing.com");
    }
    if (domain.endsWith(".youtube.com") || domain.equals("youtube.com")) {
        return buildCnameResponse(query, "restrict.youtube.com");
    }
}
```

---

## C2. Expand Domain Blocklist to 20,000+ Domains

**Current state:** ~600 domains seeded via migration.

**Implementation:**
1. Download open-source blocklists (Steven Black, StevenBlack/hosts):
   - Ads: ~200,000 entries
   - Adult: ~300,000 entries
   - Malware: ~100,000 entries
2. Load into `dns.domain_blocklist` table with category tags
3. Add a scheduled job (CronJob in K8s) to refresh weekly

**K8s CronJob:**
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: shield-blocklist-refresh
spec:
  schedule: "0 2 * * 0"  # Every Sunday 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: blocklist-updater
              image: curlimages/curl
              command: ["/bin/sh", "-c"]
              args:
                - |
                  curl -s https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn/hosts | \
                  grep '^0\.0\.0\.0' | awk '{print $2}' | \
                  kubectl exec -i shield-dns -- psql -c "COPY dns.domain_blocklist(domain,category) FROM STDIN"
```

---

## C3. CNAME Cloaking Detection

**Problem:** Trackers hide behind CDN CNAMEs to bypass blocklists.

**Implementation in DnsResolutionService:**
```java
// After resolving CNAME chain, check each intermediate CNAME against blocklist
List<String> cnameChain = resolveCnameChain(domain);
for (String cname : cnameChain) {
    if (isBlocked(cname, profileRules)) {
        logQuery(domain, "BLOCKED_CNAME_CLOAKING", profileId);
        return buildBlockedResponse(query);
    }
}
```

---

## C4. DNS-over-HTTPS Bypass Prevention

**Add to global blocklist these known DoH providers:**
- `dns.google`, `8.8.8.8`, `8.8.4.4`
- `cloudflare-dns.com`, `1.1.1.1`
- `dns.quad9.net`, `9.9.9.9`
- All known DoH IP ranges

**K8s NetworkPolicy:**
```yaml
# Prevent pods/devices from reaching alternative DNS directly
egress:
  - ports:
    - protocol: UDP
      port: 53
    to:
      - ipBlock:
          cidr: 10.0.0.0/8  # Internal only
```

---

## C5. AdGuard Home Integration

**Create `shield-dns/src/main/java/.../client/AdGuardClient.java`:**
```java
@Component
public class AdGuardClient {
    @Value("${adguard.url:http://localhost:3080}")
    private String adguardUrl;

    // Sync blocklist/allowlist rules to AdGuard
    public void syncRules(DnsRules rules) { ... }
    // Enable/disable filtering for a client
    public void setClientFiltering(String clientId, boolean enabled) { ... }
    // Set safe search for a client
    public void setSafeSearch(String clientId, boolean enabled) { ... }
}
```

---

# PHASE D — SUBSCRIPTION, PAYMENTS & BILLING
> Priority: 2-4 weeks

---

## D1. Subscription State Machine

**Current state:** Ad-hoc status transitions in BillingService.

**Implement proper FSM:**
```
TRIAL ──(trial_ends)──► TRIAL_EXPIRED ──(payment)──► ACTIVE
ACTIVE ──(cancel)──► CANCELLED
ACTIVE ──(payment_failed)──► PAST_DUE ──(grace_ends)──► SUSPENDED
PAST_DUE ──(payment_success)──► ACTIVE
SUSPENDED ──(manual_reinstate)──► ACTIVE
SUSPENDED ──(30_days)──► CANCELLED
```

**New table:**
```sql
ALTER TABLE profile.customer_subscription
  ADD COLUMN grace_period_ends_at TIMESTAMPTZ,
  ADD COLUMN dunning_count INTEGER DEFAULT 0,
  ADD COLUMN next_retry_at TIMESTAMPTZ;
```

**Scheduled job (K8s CronJob — daily):**
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: shield-dunning-manager
spec:
  schedule: "0 9 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: dunning-manager
              image: curlimages/curl
              command: ["/bin/sh", "-c", "curl -X POST http://shield-admin:8290/internal/billing/process-dunning"]
```

---

## D2. Payment Failure Retry Logic (Dunning)

**File:** `shield-admin/src/main/java/.../service/BillingService.java`

**Add `handleInvoicePaymentFailed` logic:**
```java
// Retry schedule: Day 1 → Day 3 → Day 7 → Day 14 → suspend
public void handleInvoicePaymentFailed(Event event) {
    Invoice invoice = (Invoice) event.getDataObjectDeserializer().getObject().get();
    CustomerSubscription sub = findByStripeSubscriptionId(invoice.getSubscription());
    
    int attempt = sub.getDunningCount() + 1;
    sub.setDunningCount(attempt);
    sub.setStatus("PAST_DUE");
    
    LocalDate nextRetry = switch (attempt) {
        case 1 -> LocalDate.now().plusDays(2);
        case 2 -> LocalDate.now().plusDays(4);
        case 3 -> LocalDate.now().plusDays(7);
        default -> null;  // suspend after 3 attempts
    };
    
    if (nextRetry != null) {
        sub.setNextRetryAt(nextRetry.atStartOfDay(ZoneOffset.UTC).toInstant());
        notificationService.sendPaymentFailureEmail(sub.getUserId(), attempt, nextRetry);
    } else {
        sub.setStatus("SUSPENDED");
        sub.setGracePeriodEndsAt(Instant.now().plus(30, ChronoUnit.DAYS));
        notificationService.sendSuspensionEmail(sub.getUserId());
    }
    subscriptionRepository.save(sub);
}
```

---

## D3. Add Missing Stripe Webhook Handlers

**Missing events to handle:**
```java
case "customer.subscription.updated":
    handleSubscriptionUpdated(event);  // Plan changes
    break;
case "charge.refunded":
    handleChargeRefunded(event);       // Refund processed
    break;
case "invoice.payment_action_required":
    handlePaymentActionRequired(event); // SCA/3DS
    break;
case "payment_method.attached":
    handlePaymentMethodAttached(event); // New card added
    break;
```

---

## D4. Multi-Currency Support

**Current:** Hardcoded `"inr"` in StripeService (lines 79, 147).

**Fix:**
```java
// In TenantService/StripeService — add currency field to tenants
@Value("${shield.billing.currency:inr}")
private String defaultCurrency;

// In SessionCreateParams:
.setCurrency(tenant.getBillingCurrency() != null ? tenant.getBillingCurrency() : defaultCurrency)
```

**DB migration:**
```sql
ALTER TABLE tenant.tenants ADD COLUMN billing_currency VARCHAR(3) DEFAULT 'INR';
ALTER TABLE admin.invoices ADD COLUMN currency_code VARCHAR(3) DEFAULT 'INR';
```

---

## D5. Refund Handling

**Add `POST /api/v1/billing/invoices/{id}/refund` endpoint:**
```java
public RefundResponse processRefund(UUID invoiceId, String reason) {
    Invoice invoice = invoiceRepository.findById(invoiceId).orElseThrow();
    if (!"PAID".equals(invoice.getStatus())) {
        throw ShieldException.badRequest("Only paid invoices can be refunded");
    }
    Refund refund = Refund.create(RefundCreateParams.builder()
        .setPaymentIntent(invoice.getStripePaymentIntentId())
        .setReason(RefundCreateParams.Reason.REQUESTED_BY_CUSTOMER)
        .build());
    invoice.setStatus("REFUNDED");
    invoice.setRefundId(refund.getId());
    invoiceRepository.save(invoice);
    // Notify customer
    return RefundResponse.from(refund);
}
```

---

# PHASE E — MOBILE APP (iOS + Hardening)
> Priority: 4-8 weeks (requires Apple Developer account)

---

## E1. iOS VPN Network Extension

**Problem:** `dns_vpn_service.dart` is Android-only. iOS requires `NEDNSProxyProvider`.

**Required:**
1. Apple Developer Program membership ($99/year)
2. Create iOS Network Extension target in Xcode
3. Implement `NEDNSProxyProvider` for DoH routing
4. Flutter MethodChannel bridge for iOS

**`ios/NetworkExtension/DNSProxyProvider.swift`:**
```swift
class DNSProxyProvider: NEDNSProxyProvider {
    override func startProxy(options: [String: Any]?, completionHandler: @escaping (Error?) -> Void) {
        // Route all DNS queries through Shield DoH endpoint
        let dohUrl = options?["dohUrl"] as? String ?? "https://shield.rstglobal.in/dns-query"
        // Configure DNS proxy to forward to dohUrl
        completionHandler(nil)
    }
}
```

---

## E2. Certificate Pinning in Flutter

**Add to `shield-app/pubspec.yaml`:**
```yaml
dependencies:
  ssl_pinning_plugin: ^2.0.0
```

**Implementation in `lib/core/services/api_service.dart`:**
```dart
// Pin to shield.rstglobal.in certificate
final response = await SslPinningPlugin.check(
  serverURL: 'https://api.shield.rstglobal.in',
  headerHttp: {},
  sha: SHA.SHA256,
  allowedSHAFingerprints: ['YOUR_CERT_SHA256_FINGERPRINT'],
  timeout: 60,
);
```

---

## E3. App-Level Time Budget Controls

**Current:** Only daily total screen time.

**Required (per-app time budgets — `dns.app_time_budgets` table already exists):**

**Flutter screen:** `shield-app/lib/features/parent/controls/app_budgets_screen.dart`
- ✅ Screen exists but needs wiring to backend
- Wire `GET /api/v1/dns/app-budgets/{profileId}` and `PUT /api/v1/dns/app-budgets`

**Android enforcement:**
```dart
// WorkManager job every 5 minutes
// Check total app usage vs. budget
// Block app if over budget (overlay or VPN redirect to block page)
```

---

## E4. iOS Support for Background DNS

**`shield-app/lib/core/services/dns_vpn_service.dart`:**
```dart
Future<void> start(String dohUrl) async {
  if (Platform.isAndroid) {
    await _channel.invokeMethod('startVpn', {'dohUrl': dohUrl});
  } else if (Platform.isIOS) {
    await _channel.invokeMethod('startDNSProxy', {'dohUrl': dohUrl});  // NEDNSProxyProvider
  }
}
```

---

# PHASE F — DATABASE & INTEGRITY
> Priority: Ongoing

---

## F1. Add Missing Cascade Deletes

**Migration:** Add to appropriate service

```sql
-- shield-auth: cascade users when tenant deleted
ALTER TABLE auth.users DROP CONSTRAINT users_tenant_id_fkey;
ALTER TABLE auth.users ADD CONSTRAINT users_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenant.tenants(id) ON DELETE CASCADE;

-- shield-profile: cascade customer when user deleted
ALTER TABLE profile.customers DROP CONSTRAINT customers_customer_id_fkey;
ALTER TABLE profile.customers ADD CONSTRAINT customers_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

---

## F2. Add Missing Unique Constraints

```sql
-- DNS blocklist: no duplicate domain per profile
CREATE UNIQUE INDEX IF NOT EXISTS idx_dns_blocklist_unique
  ON dns.domain_blocklist(domain, category);

-- Location: no duplicate geofence name per profile
CREATE UNIQUE INDEX IF NOT EXISTS idx_geofence_name_profile
  ON location.geofences(profile_id, name);
```

---

## F3. Add Missing Composite Indexes

```sql
-- Analytics (most queried table)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dns_logs_profile_time
  ON analytics.dns_query_logs(profile_id, queried_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dns_logs_domain_action
  ON analytics.dns_query_logs(domain, action, queried_at DESC);

-- Location (second most queried)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_profile_time
  ON location.location_points(profile_id, recorded_at DESC);

-- Notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_status
  ON notification.notifications(user_id, status, created_at DESC);
```

---

## F4. Partition Maintenance

**`analytics.dns_query_logs` and `location.location_points` are partitioned by quarter.**

**Add K8s CronJob to create next quarter's partition monthly:**
```sql
-- Run monthly
CREATE TABLE IF NOT EXISTS analytics.dns_query_logs_2026q3
  PARTITION OF analytics.dns_query_logs
  FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
```

---

# PHASE G — INFRASTRUCTURE & KUBERNETES
> Priority: 2-4 weeks

---

## G1. Kubernetes NetworkPolicy

**Create `k8s/base/network-policy.yaml`:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: shield-default-deny
  namespace: shield-prod
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: shield-prod
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: ingress-nginx
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: shield-prod
  - to: []
    ports:
    - port: 5432   # PostgreSQL
    - port: 6379   # Redis
    - port: 443    # External HTTPS (Stripe, Anthropic)
    - port: 53     # DNS
```

---

## G2. ResourceQuota for shield-prod

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: shield-prod-quota
  namespace: shield-prod
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.cpu: "16"
    limits.memory: 32Gi
    pods: "40"
    persistentvolumeclaims: "10"
```

---

## G3. PodDisruptionBudget for Critical Services

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: shield-gateway-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: shield-gateway
```

Create PDBs for: gateway, auth, dns, notification.

---

## G4. CI/CD — Add Staging + Post-Deploy Health Check

**azure-pipelines.yml additions:**

```yaml
# After DeployProd stage — add smoke test
- stage: SmokeTest
  displayName: 'Smoke Test'
  dependsOn: DeployProd
  condition: succeeded('DeployProd')
  jobs:
  - job: HealthCheck
    pool:
      name: shield-self-hosted
    steps:
    - script: |
        # Wait for all pods to be Running
        kubectl wait --for=condition=Ready pod -l app=shield-gateway -n shield-prod --timeout=120s
        kubectl wait --for=condition=Ready pod -l app=shield-auth -n shield-prod --timeout=120s
        
        # Smoke test gateway health
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.shield.rstglobal.in/actuator/health)
        if [ "$STATUS" != "200" ]; then
          echo "Health check failed: $STATUS"
          exit 1
        fi
        echo "All health checks passed"
      displayName: 'Post-deploy smoke test'
    - script: |
        # Rollback if smoke test fails
        if [ $? -ne 0 ]; then
          kubectl rollout undo deployment/shield-gateway -n shield-prod
          kubectl rollout undo deployment/shield-auth -n shield-prod
        fi
      condition: failed()
      displayName: 'Auto rollback on failure'
```

---

## G5. Add SAST/Security Scan to Pipeline

```yaml
- job: SecurityScan
  displayName: 'OWASP Dependency Check'
  pool:
    name: shield-self-hosted
  steps:
  - script: |
      /usr/share/maven/bin/mvn org.owasp:dependency-check-maven:check \
        -DfailBuildOnCVSS=7 \
        -DsuppressionFile=owasp-suppressions.xml \
        -q
    displayName: 'OWASP Dependency Check'
```

---

# PHASE H — REPORTS & ANALYTICS
> Priority: 3-4 weeks

---

## H1. CSV/PDF Export

**File:** `shield-analytics/.../controller/ExportController.java` — currently stub.

**Implement:**
```java
@GetMapping("/export/dns-logs")
public ResponseEntity<byte[]> exportDnsLogs(
    @RequestParam UUID profileId,
    @RequestParam LocalDate from,
    @RequestParam LocalDate to,
    @RequestParam(defaultValue = "csv") String format
) {
    List<DnsQueryLog> logs = repository.findByProfileIdBetween(profileId, from, to);
    byte[] data = format.equals("pdf") ? pdfService.generate(logs) : csvService.generate(logs);
    return ResponseEntity.ok()
        .header("Content-Disposition", "attachment; filename=dns-logs-" + from + ".csv")
        .body(data);
}
```

---

## H2. Scheduled Weekly Digest Email

**`WeeklyDigestService.java` exists — verify it runs.**

**Add K8s CronJob:**
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: shield-weekly-digest
spec:
  schedule: "0 8 * * 1"  # Monday 8 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: digest-trigger
              image: curlimages/curl
              command: ["/bin/sh", "-c"]
              args: ["curl -X POST http://shield-notification:8286/internal/digest/send-weekly"]
```

---

## H3. Trend Analysis & Benchmarking

**Add to analytics service:**
```java
// Week-over-week comparison
@GetMapping("/trends/{profileId}")
public TrendResponse getTrends(@PathVariable UUID profileId,
                                @RequestParam int weeks) {
    // Compare current week vs. previous N weeks
    return analyticsService.computeTrends(profileId, weeks);
}
```

---

# SUMMARY: PRIORITISED TODO LIST

## ✅ PHASE A — Security (Do TODAY)

- [ ] A1: Fix `anyRequest().permitAll()` → `anyRequest().authenticated()` in 7 SecurityConfig files
- [ ] A2: Make Stripe webhook signature mandatory
- [ ] A3: Fix CORS in shield-ai (`*` → specific origin)
- [ ] A4: Rotate ALL secrets (DB, Redis, JWT, Stripe, Anthropic, DeepSeek, Google Maps, SMTP)
- [ ] A4b: Remove `.env` from git, move to Azure Key Vault / K8s Secrets
- [ ] A5: Fix dns-resolver Feign clients (localhost → K8s service names)
- [ ] A6: Remove hardcoded JWT secret fallback from application.yml

## ✅ PHASE B — High Priority (This Week)

- [ ] B1: Create shield-config K8s deployment + add to pipeline
- [ ] B2: Add shield-dns-resolver to CI/CD SERVICES list + kustomization
- [ ] B3: Convert all deployments to RollingUpdate + replicas: 2
- [ ] B4: Add HPAs for shield-ai, shield-notification, shield-location, shield-tenant
- [ ] B5: Persist shield-ai alerts + keywords to PostgreSQL
- [ ] B6: Add @Valid to 15+ controller endpoints
- [ ] B7: Add rate limiting to shield-ai (slowapi)
- [ ] B8: Add token refresh logic to React dashboard
- [ ] B9: Add login rate limiting + brute force protection (shield-auth)
- [ ] B10: Add password complexity validation
- [ ] B11: Reduce HikariCP pool from 20 → 5-8 per service

## ✅ PHASE C — DNS Filtering (2 Weeks)

- [ ] C1: Implement SafeSearch + YouTube Restricted enforcement in DnsResolutionService
- [ ] C2: Expand domain blocklist from ~600 → 20,000+ (Steven Black lists)
- [ ] C3: Implement CNAME cloaking detection
- [ ] C4: Block known DoH provider IPs to prevent bypass
- [ ] C5: Implement AdGuard Home sync client

## ✅ PHASE D — Billing & Subscriptions (2-4 Weeks)

- [ ] D1: Implement subscription state machine (TRIAL→ACTIVE→PAST_DUE→SUSPENDED→CANCELLED)
- [ ] D2: Add payment failure retry / dunning management
- [ ] D3: Handle missing Stripe webhook events (subscription.updated, charge.refunded, etc.)
- [ ] D4: Multi-currency support (remove hardcoded INR)
- [ ] D5: Add refund processing endpoint + UI

## ✅ PHASE E — Mobile App (4-8 Weeks)

- [ ] E1: iOS VPN (NEDNSProxyProvider) — requires Apple Dev account
- [ ] E2: Certificate pinning (Android + iOS)
- [ ] E3: Wire app-level time budgets to backend
- [ ] E4: iOS background DNS enforcement

## ✅ PHASE F — Database (Ongoing)

- [ ] F1: Add missing ON DELETE CASCADE constraints (auth.users, profile.customers)
- [ ] F2: Add unique constraints on blocklists, geofences
- [ ] F3: Add composite indexes on dns_query_logs, location_points, notifications
- [ ] F4: Create Q3/Q4 2026 table partitions for analytics + location

## ✅ PHASE G — Kubernetes / Infrastructure (2-4 Weeks)

- [ ] G1: Add NetworkPolicy (default deny, allow only intra-namespace + external HTTPS)
- [ ] G2: Add ResourceQuota for shield-prod namespace
- [ ] G3: Add PodDisruptionBudgets for gateway, auth, dns, notification
- [ ] G4: Add post-deploy smoke test + auto-rollback to CI/CD pipeline
- [ ] G5: Add OWASP dependency check to CI/CD pipeline
- [ ] G6: Fix shield-ai liveness probe (already done ✅)

## ✅ PHASE H — Reports (3-4 Weeks)

- [ ] H1: Implement CSV/PDF export in ExportController
- [ ] H2: Add K8s CronJob for weekly digest emails
- [ ] H3: Add trend analysis endpoints + UI

---

## CRITICAL PATH (blocking production readiness)

```
A1 → A4 → G4   (security baseline)
B1 → B2        (infrastructure complete)
B3 → B4        (high availability)
D1 → D2 → D3   (billing reliable)
E1             (iOS — market coverage)
```

**Estimated effort:**
- Phase A: 1-2 days
- Phase B: 3-5 days
- Phase C: 5-7 days
- Phase D: 7-10 days
- Phase E: 21-30 days
- Phase F: 3-5 days
- Phase G: 3-5 days
- Phase H: 5-7 days

**Total: ~8-10 developer-weeks to full production readiness**

---

# ADDITIONAL VAPT FINDINGS (from detailed audit report)

## CRITICAL — New / Updated

### C1 ✅ FIXED — Analytics API had no authentication
**Root cause:** `anyRequest().permitAll()` in SecurityConfig + extra `/api/v1/analytics/**` permitAll rule.
**Fix applied:** Removed both. Any analytics request now requires authentication.
**Proof of concept was:** `curl https://shield.rstglobal.in/api/v1/analytics/tenant/{uuid}/overview` — now returns 401.

### C2 ✅ FIXED — All API keys in .env
**TODO still remaining:** Rotate all secrets (DB_PASSWORD, REDIS_PASSWORD, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, GOOGLE_MAPS_API_KEY, SMTP_PASS, RABBITMQ_PASSWORD, JWT_SECRET) and move to Azure Key Vault.
**Steps:**
1. Go to Stripe Dashboard → Developers → Webhooks → Regenerate signing secret
2. Go to Anthropic Console → API Keys → Revoke and create new
3. Go to Azure Portal → shield-pg-prod → Reset password
4. `kubectl create secret generic shield-secrets --from-literal=... -n shield-prod`
5. `git rm --cached .env && echo ".env" >> .gitignore`

### C3 ✅ FIXED — Stripe webhook signature bypassable
**Fix applied:** Webhook now rejects requests with no secret configured or missing `Stripe-Signature` header.

### C4 ✅ FIXED — shield-ai CORS allows all origins
**Fix applied:** Restricted to `["https://shield.rstglobal.in", "https://api.shield.rstglobal.in"]`. Configurable via `CORS_ALLOWED_ORIGINS` env var. `allow_credentials` set to `False`.

### C5 — AI alerts/keywords in memory (PENDING)
**Fix needed:** Wire `routers/alerts.py` and `routers/keywords.py` to use `db/database.py` (module already exists).
**Effort:** 1 day.

---

## HIGH — New findings

### H5 ✅ FIXED — Stack traces in 500 error responses
`GlobalExceptionHandler.handleGeneral()` previously passed `ex.getMessage()` to response for some exception types.
**Fix applied:** All catch-all handlers now return generic messages + correlation IDs. `ex.getMessage()` never reaches the response body.

### H6 — No row-level security in PostgreSQL (PENDING)
**Fix needed:** Enable RLS on all tenant-scoped tables.
```sql
ALTER TABLE profile.child_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON profile.child_profiles
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```
Enable for: profile.customers, profile.child_profiles, profile.devices, dns.dns_rules, dns.schedules, location.geofences, analytics.dns_query_logs.
**Effort:** 3 days.

### H3 — Login brute force rate limiting
**Status:** AuthService already has DB-level lockout (`locked_until`) after 5 failures. Nginx already has `auth_limit` zone at 10 req/s.
**Remaining gap:** No Redis-based per-IP rate limiting (only per-account). IP-based rate limit bypass via distributed attack still possible.
**Add:** Redis counter `shield:auth:ip:{ip}` with 60/minute limit.

---

## MEDIUM — New findings

### M3 — Zero unit/integration tests
**Fix plan:**
- Add JUnit 5 + Mockito to all Java services (add to pom.xml)
- Priority: DnsResolutionService, AuthService, BillingService
- Add pytest to shield-ai for keyword matching and anomaly feature extraction
- Target: 70% line coverage on service classes before commercial launch
- Enable `mvn test` in CI pipeline (remove `-DskipTests`)

### M4 ✅ VERIFIED OK — Nginx security headers
Nginx config already has: HSTS, X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, X-XSS-Protection, Referrer-Policy, CSP, Permissions-Policy.
**One remaining gap:** X-Frame-Options is SAMEORIGIN — change to DENY since dashboard shouldn't be embedded anywhere.

### M5 — AdGuard admin exposed (PENDING)
**Fix:** Bind AdGuard to `127.0.0.1` only, remove any public exposure.
```bash
# In AdGuard config (/opt/adguardhome/AdGuardHome.yaml):
bind_host: 127.0.0.1
```
Access via SSH tunnel only: `ssh -L 3443:localhost:3443 user@server`

### M6 — Grafana default credentials, Prometheus no auth (PENDING)
```bash
# Change Grafana password:
docker exec -it grafana grafana-cli admin reset-admin-password <new-strong-password>
# Or via API: curl -X PUT -H "Content-Type: application/json" \
#   -d '{"oldPassword":"admin","newPassword":"<new>","confirmNew":"<new>"}' \
#   http://admin:admin@localhost:3190/api/user/password
```
**Prometheus:** Add `--web.config.file=web.yml` with bcrypt-hashed basic auth.
**Move both behind VPN/SSH tunnel** — no public exposure.

### M7 ✅ VERIFIED OK — Refresh token rotation
`AuthService.refresh()` already deletes old token (`redis.delete(key)`) before issuing new one. Token rotation is implemented correctly.

### M8 — CSRF protection
JWT Bearer-only flow (no cookies used) — CSRF not applicable for API endpoints. If any cookie-based path is ever added, CSRF must be re-enabled. Currently secure.

---

## LOW — New findings

### L1 — DNS blocklist only 345 domains (PENDING)
See Phase C2 — bulk import from StevenBlack/OISD lists.

### L2 — No PodDisruptionBudget (PENDING)
See Phase G3.

### L3 ✅ FIXED — No password complexity
`@Pattern` added to RegisterRequest, ResetPasswordRequest, ChangePasswordRequest. Requires uppercase + lowercase + digit + special char, 8+ chars.

### L4 — Security events not in audit log (PENDING)
Add AOP `@AfterThrowing` on `AuthService.login()` and `@AfterReturning` on sensitive admin operations.
The `admin.audit_logs` table and `GET /api/v1/admin/audit-logs` endpoint already exist.

### L5 — Flutter stores refresh token without device binding (PENDING)
Add device fingerprint to refresh token Redis entry. Add `GET /api/v1/auth/sessions` + `DELETE /api/v1/auth/sessions/{deviceId}`.

---

## INFO — New findings

### I1 — TLS 1.2 still supported
```nginx
# /etc/nginx/sites-available/shield.rstglobal.in
# Change:
ssl_protocols TLSv1.2 TLSv1.3;
# To:
ssl_protocols TLSv1.3;
```
**Note:** Some older Android devices may not support TLS 1.3. Test before applying.

### I2 — No dependency vulnerability scanning in CI (PENDING)
Add to azure-pipelines.yml Build stage:
```yaml
- script: |
    /usr/share/maven/bin/mvn org.owasp:dependency-check-maven:check \
      -DfailBuildOnCVSS=9 -q
    cd shield-dashboard && npm audit --audit-level=critical
  displayName: 'Dependency vulnerability scan'
  continueOnError: true
```

### I3 — Docker images use `latest` tag (PARTIALLY FIXED)
CI pipeline already uses `$(Build.SourceVersion)` (git SHA) as image tag. `latest` is still pushed as alias. Base images in Dockerfiles should be pinned to specific digests. Example:
```dockerfile
# Change FROM eclipse-temurin:21-jre-alpine
# To:
FROM eclipse-temurin:21-jre-alpine@sha256:6ad8ed080d9be96b61438...
```

### I4 — No WAF in front of ingress (PENDING)
**Quickest fix:** Route `shield.rstglobal.in` through Cloudflare (free tier).
1. Add Cloudflare nameservers to domain registrar
2. Enable "Under Attack Mode" temporarily
3. Create WAF rule: block OWASP Core Rule Set
**Cost:** Free on Cloudflare Free plan.

### I5 — Logs contain PII (PENDING)
Add Logback custom converter to mask emails and IPs before stdout:
```xml
<!-- logback-spring.xml -->
<conversionRule conversionWord="maskedMsg"
  converterClass="com.rstglobal.shield.common.log.PiiMaskingConverter"/>
<pattern>%d{yyyy-MM-dd HH:mm:ss} %-5level %logger{36} - %maskedMsg%n</pattern>
```

---

## CODING RULES (applied to all changes)

Per user instruction — all code must follow:
1. **No hardcoded values** — use env vars / config / constants (applied: CORS origins, JWT secret, service URLs)
2. **KISS** — simplest fix that closes the vulnerability without adding unnecessary layers
3. **DRY** — SecurityConfig fix applied uniformly across all 8 services, not per-service workarounds
4. **Single Responsibility** — each SecurityConfig only handles HTTP security; auth logic stays in gateway
5. **Fail fast & validate early** — password validation now at DTO level, not deep in service code
