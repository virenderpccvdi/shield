# Shield — Infrastructure Budget Plan

**Budget:** ₹18,000 / month (~ $216 USD / month at 2026-04 FX)
**Target:** stay at or under budget through launch, scale up linearly as revenue grows.

---

## 1. Current Azure spend (as of 2026-04-12)

This is what the cluster actually costs today, before any changes:

| Resource | SKU | Monthly cost |
|---|---|---|
| AKS node pool `system` (1 node) | `Standard_D4s_v3` (4 vCPU, 16 GB) | **~$140** / ~₹11,700 |
| AKS control plane | Free tier (Basic SLA) | **$0** |
| Azure Load Balancer (public) | Basic SKU via ingress-nginx | **~$20** / ~₹1,670 |
| Public IP (LB) | Basic | **~$4** / ~₹335 |
| Azure Container Registry | Basic tier, 10 GB | **~$5** / ~₹420 |
| Managed disk (OS + PV) | 128 GB Standard SSD | **~$10** / ~₹835 |
| Egress bandwidth (first 100 GB free) | pay-as-you-go | **~$5-10** / ~₹420-835 |
| **TOTAL (current)** | | **~$185 / ~₹15,450** |

You have about **₹2,550/month of headroom** before hitting the Rs.18,000 cap. That is the budget envelope for everything you want to add: dev environment, HA, monitoring, backup, CDN.

---

## 2. Recommendation — stay on Azure, optimise the node

Do **not** try to add a second node. The Standard_D4s_v3 at ~$140/month is already the single biggest line item, and adding a second one puts you at ~$325/month (~₹27,000) — over budget by 50%.

Instead, **downsize + optimise**:

### 2a. Switch `system` node from Standard_D4s_v3 → Standard_B4ms

- **Standard_B4ms**: 4 vCPU burstable, 16 GB RAM
- **Cost:** ~$85/month (~₹7,100) — saves **$55/month / ₹4,600**
- **Trade-off:** burstable CPU credits. Great for Spring Boot services (bursty startup, quiet steady-state). You get **4 credits/hour × 24h = 96 credits/day**, enough for normal traffic. Heavy rollouts will consume credits faster.
- **Realistic:** you're already seeing 8-30% CPU steady-state, so burstable will be fine. The only risk is multi-service rollouts eating credits, which we mitigated with `maxSurge=0` rollouts (one service at a time).

### 2b. Switch LB from Basic → Standard only when you need HA zones

Basic LB is $20/month. Standard LB is ~$25/month + data processing charges. Stay on Basic until traffic justifies the upgrade. **Save $5–15/month.**

### 2c. Reduce ACR retention

Keep only the 5 most recent image tags in ACR instead of all of them. Script a nightly cleanup via `az acr repository show-tags … | az acr repository delete`. **Save $1–3/month on storage as image count grows.**

---

## 3. Budget plan, two scenarios

### Scenario A — lean, pre-launch (what I recommend for now)

| Line | Monthly |
|---|---|
| 1 × Standard_B4ms node (downsize from D4s_v3) | ~₹7,100 |
| Basic Azure LB | ~₹1,670 |
| Public IP (Basic) | ~₹335 |
| ACR Basic | ~₹420 |
| Managed disk (64 GB) | ~₹420 |
| Egress (first 100 GB free) | ~₹400 |
| Reserved buffer (alerts, small overages) | ~₹1,500 |
| **Total** | **~₹11,845** |
| **Remaining budget** | **~₹6,155** |

You have ₹6,155/month of breathing room. I'd reserve ₹3,000 for emergency (unexpected egress spike, extra backup) and use ₹3,155 for one of:
- **Cloudflare Pro** (~$20/mo = ₹1,670): CDN, DDoS, WAF, cache for shield.rstglobal.in
- **Sentry (self-hosted or Team plan)** (~$26/mo = ₹2,170): frontend + backend error tracking
- **Uptime monitoring** (~₹600/mo): Better Uptime, Pingdom, or a free self-hosted Uptime Kuma

My recommendation: **Cloudflare Pro + Uptime Kuma self-hosted**. You get CDN, DDoS protection, and monitoring for about ₹2,300/month total, with ₹3,850 remaining buffer.

### Scenario B — at launch with modest HA

If you want to add a second node (e.g. for dev environment OR for HA of gateway/auth), you'll need to exit the Azure Central India D-series and consider **alternative hosting**:

| Provider | 2 × (4 vCPU, 16 GB) | Notes |
|---|---|---|
| **Azure** (D4s_v3) | ~₹22,000/mo | Over budget |
| **Azure** (B4ms) | ~₹14,000/mo | Fits with B4ms downsize |
| **DigitalOcean Premium** (cpu-optimized 4×16) | ~₹12,500/mo | Fits comfortably |
| **Hetzner Cloud** (CX41 4×16 DE) | ~₹2,700/mo (!) | Insane value, but EU region = ~180ms from India |
| **Linode / Akamai** (Shared CPU 4×16) | ~₹9,000/mo | Fits, US/SG regions |

**If you want HA on the current Rs.18,000 budget:**
- **Option 1:** Move to 2 × B4ms on Azure (stay in region) + reserve instance for prod = budget fits tightly, no room for CDN/monitoring.
- **Option 2:** Move to Hetzner in Frankfurt + budget for an India PoP via Cloudflare Workers = ~₹5,000 total for compute, massive headroom. Latency to Indian users is ~150–200ms which is fine for a parental controls app (non-interactive).
- **Option 3:** Wait until first paying customer → upgrade to B4ms × 2 → still only ₹14,000, fits budget.

My recommendation: **Option 3** until you have ₹50k+ monthly revenue, then revisit.

---

## 4. Where does Astro fit in the budget?

**Astro is free** — it's a build tool, not a runtime. Migration cost is **zero** on infra. The Astro-built site is still static HTML/CSS/JS, served by the same `nginx:1.29-alpine` pod on the same AKS cluster.

The only infra change during Astro migration is the **Dockerfile** — it now runs `npm ci && npm run build` in a multi-stage build, then copies the `dist/` output into nginx. Build time adds ~2 minutes to the CI pipeline. Zero prod cost.

**Net: Astro saves you money** because the site ships zero JS where possible, reducing egress bandwidth. For a 50 KB reduction per page-load at 100k monthly page-views, that's ~5 GB/month less egress — negligible cost, but the perf win is real.

---

## 5. When to upgrade — triggers

I recommend upgrading infra only when ONE of these triggers fires:

| Trigger | Action | New monthly cost |
|---|---|---|
| **CPU > 70% sustained for 24h** | B4ms → D4s_v3 (4 vCPU dedicated) | +₹4,600/mo |
| **> 50 active families** (steady state DNS load) | Add 2nd B4ms, enable dev environment | +₹7,100/mo |
| **> 500 active families** | Enable 2-replica HA on gateway/auth, Standard LB | +₹8,000/mo |
| **First paying customer or Premium tier** | Buy 1-yr reserved instance for the `system` node | –30% on node cost |
| **Cross-region customers** | Move to Standard LB + Azure CDN | +₹2,500/mo |

All of these fit within **₹40,000/mo** which should be your post-launch stretch budget.

---

## 6. Cost-safety setup (do this now, costs nothing)

Before anything else, configure these free guardrails on your Azure subscription:

1. **Budget alert** — Portal → Cost Management → Budgets → create ₹18,000 monthly budget with email alerts at 50%, 80%, 100%, and 110% of budget.
2. **Disable auto-scaling on the cluster** — it's already disabled (you're on 1 node), but verify `az aks update --cluster-autoscaler-profile` has no unexpected settings.
3. **Enable cost anomaly detection** — Portal → Cost Management → Cost alerts → "Anomaly alerts" → on.
4. **Tag resources** with `project=shield, env=prod` — makes monthly cost reports actionable.
5. **Delete unused resources weekly** — old disk snapshots, orphaned public IPs, stale ACR tags. A ₹500/mo leak is ₹6,000/yr.

---

## 6.5. CURRENT STATE: only 10 users — you're dramatically over-provisioned

As of 2026-04-12 you have **~10 active users**. At that scale a single `Standard_B2ms` (2 vCPU, 8 GB RAM, ~₹3,500/mo) would serve the entire prod workload comfortably. But the services are already deployed on D4s_v3, so realistic advice is:

**For 10 users** (do this now):
- Downsize `system` node to **Standard_B2ms** → monthly compute **~₹3,500** instead of ₹11,700
- Keep everything else as-is
- **New total: ~₹7,250/mo** — you're using **40% of your budget**
- Apply ~₹8,000/mo savings to **Cloudflare Pro + Sentry + Uptime Kuma + email deliverability (Postmark/Mailgun starter)**

**The catch:** B2ms is CPU-burstable. With 15 Java Spring Boot services starting simultaneously you WILL exhaust CPU credits during cold starts. Mitigations:
1. You already have `maxSurge=0` rollouts (one service at a time) — no simultaneous starts
2. 10 users means near-zero steady-state load → constant credit accrual
3. Shield-gateway + shield-auth get priority; others tolerate slow starts

**Risk level:** LOW at 10 users. MEDIUM once you hit ~50 users. Plan to upgrade back to B4ms around 50 active families.

## 7. TL;DR

- **Right now (10 users, pre-launch):** downsize to **B2ms** → **~₹7,250/mo**, use savings for Cloudflare+Sentry+monitoring (details in section 6.5). You'll sit comfortably at ~60% budget utilisation.
- **You're at ~₹15,450/mo today** with ~₹2,550/mo headroom, which is fine but wasteful for 10 users.
- **This month:** downsize node from D4s_v3 → B4ms to save ₹4,600/mo, apply that saving to **Cloudflare Pro + Uptime Kuma**. New total: **~₹13,100/mo** with proper DDoS, CDN, and uptime monitoring.
- **At launch:** keep the same infra, monitor CPU/memory, add a 2nd node only when traffic justifies it.
- **Revenue gates:** every 50 active families → re-evaluate. Every 500 → upgrade to HA.
- **Don't migrate away from Azure** until you have > 1000 families OR you decide the latency to Hetzner/DO is acceptable. The Azure egress-to-India premium is ~₹400/mo — not worth the switching cost yet.
- **Astro migration does NOT change infra cost.** Same nginx, same image, same pod. Only the build pipeline gains a 2-min `npm run build` step.

---

*Last updated: 2026-04-12 — generated during Phase B website redesign.*
