# shield-website — Phase A Audit Report

**Date:** 2026-04-11
**Scope:** `/var/www/ai/FamilyShield/shield-website/` — 9 HTML files, 2 CSS files, nginx config, React dashboard entry
**Status:** No code changes in this phase. Review this, then approve Phase B redesign.

---

## 1. Executive summary — the single most important findings

1. **The design system is fragmented across 138 unique colors and 3 different blue palettes.** Every HTML file redefines its own `:root {}` tokens from scratch. The "new" palette in `index.html` (`#005DAC`, `#1976D2`) does not match the "legacy" palette in `style.css` (`#1565C0`, `#0D47A1`), which does not match the palette in `auth.css` (`#0277BD`, `#0a2e6e`). This is the root cause of "inconsistent UI across pages".

2. **`style.css` and `auth.css` are almost entirely dead code.** Only `privacy.html` and `terms.html` import `style.css`. `auth.css` is imported by zero pages. Every other page embeds ~500–1200 lines of inline `<style>` instead of sharing a stylesheet. This is why every page feels different — they are literally different codebases glued together.

3. **`dashboard.html` is 996 lines of dead code.** The file starts with `<meta http-equiv="refresh" content="0;url=/app/"/>` and immediately redirects. All the CSS and markup below is never rendered. Can be shrunk to 15 lines.

4. **There is no 404 page, no forgot-password page, and ~8 broken footer links.** The nginx SPA fallback (`try_files $uri $uri/ /index.html`) silently redirects unknown URLs to the homepage instead of showing an error. Clicking "Forgot password?" on login.html currently takes you to the landing page — confusing and breaks user flow.

5. **Animations and micro-interactions are thin.** There is one scroll effect (nav shadow), one IntersectionObserver (stats counter), and hover `transform: translateY(-1px)` on cards/buttons. No scroll reveals, no parallax, no page transitions. The user complaint "no animations, feels static" is accurate.

6. **Mobile is underserved.** On auth pages, `@media (max-width: 768px) { .auth-brand { display: none; } }` simply hides the entire brand panel on phones — users see a bare form with no context. No "why Shield" content at all on mobile login/register. This is a conversion killer.

7. **Accessibility is weak.** Decorative icon-fonts (Material Symbols) are used as content inside buttons without `aria-hidden`, form errors have no `aria-describedby`, the auth brand panel uses heading-less features, color contrast has not been verified, and the "alert" divs show/hide with display toggles rather than ARIA live regions.

---

## 2. Current stack

```
Static HTML + CSS + vanilla JS → nginx:1.29-alpine → served from / on https://shield.rstglobal.in
React dashboard (Vite build) → mounted at /app/ → separate Vite build, pulled into the same nginx image
Fonts: Google Fonts (Manrope + Inter + Material Symbols), loaded from googleapis.com
Icons: Material Symbols Outlined (variable font, ~300 KB when used heavily)
Map library (share.html only): Leaflet 1.9.4 from unpkg.com
Charting (qa-report.html only): Chart.js 4.4.0 from jsdelivr.net
```

**Total page weight (home):** 13 KB HTML gzipped, ~150 ms TTFB, ~135 ms total (very fast — nginx is doing its job). Perf is not the problem.

**Total page weight (dashboard /app/):** 607 bytes HTML shell + ~several MB of JS assets (React + MUI + i18n + react-query bundle). Not audited in this phase — dashboard is the React app and has its own codebase.

---

## 3. Page-by-page findings

### 3.1 `index.html` — landing page (1246 lines, 1040 lines of inline `<style>`)

**Positives**
- Strong SEO: canonical URL, Open Graph, Twitter Card, JSON-LD MobileApplication schema, sitemap
- Sections are complete: hero, features, how-it-works, stats, pricing, testimonials, download, CTA, footer
- Phone mockup in hero is nicely built with pure CSS (no image assets)
- Mobile hamburger + drawer works
- Counter animation on scroll for stats

**Problems**
- **L59–698: 640 lines of inline `<style>` that duplicate patterns found in style.css.** None of this is cached or reusable.
- **Hero phone mockup is hidden on ≤768px (`.hero-phone { display: none; }`)** — the single most visually compelling element on the page disappears on mobile, where 70% of visitors are.
- **Testimonials are hardcoded fake content** (Priya Rajan, Arvind Kumar, Sunita Mehta with initials avatars). OK as placeholder, but the "50K+ families" stat is also placeholder and the whole social-proof layer feels manufactured.
- **The "Sites Blocked: 137" / "Screen Time: 2h 14m" phone mockup is static** — no animation, no pulsing dots, no fake data update. Users reading it at rest for 5+ seconds see a dead screenshot.
- **Footer links all go to `href="#"`** — About, Privacy Policy, Terms, Support, Cookies, + a duplicate Privacy + Terms row. 6+ dead links visible at the bottom of the page. Privacy and Terms files exist; they should link to `/privacy.html` and `/terms.html`.
- **No hover state on feature cards** beyond `transform: translateY(-4px)` — no icon animation, no gradient shift.
- **No scroll-reveal.** Every section is visible on first paint; there is no "unfold as you scroll" feel.
- **Pricing "Standard" tier marked `featured` uses `transform: translateY(-12px)` to lift** — on mobile this translates to a broken layout and `@media (max-width: 768px) { .pricing-card.featured { transform: none; } }` disables it, fine, but loses the "most popular" emphasis on mobile.
- **QR code placeholder is literally a `<div class="qr-box">` with the `📱` emoji** — not a real QR that links to the APK. Desktop users who scan it with their phone camera get nothing.
- **`href="/download/shield-app.apk"`** — check that this route works. Tested OK (nginx `/download/` location).
- **No analytics (Google Analytics, Plausible, etc.)** — no way to measure conversion or drop-off.
- **`#features` anchor is duplicated** — `.features` section has `id="features"` and nav links to it, but the `.features-header` also uses the same naming without an ID; harmless but confusing.
- **The "Trusted by 50,000+ families worldwide" badge pulses green** (animated `hero-badge-dot`), which is one of only two real animations on the whole page.

**Content hierarchy problems**
- Hero H1 "Protect Your Family's Digital World" is strong, but the sub-copy "Shield wraps every device — phone, tablet, laptop — in a layer of intelligent protection" mentions laptop, which is misleading — Shield is **Android-only** today (confirmed in the download section: "Compatible with Android 7.0+"). This is a trust-breaker when users reach the download button.
- Features section lists 6 features at equal visual weight. The core differentiator ("works on 4G, not just WiFi") is buried as the *second* paragraph inside the "Digital Safety" card, when it should be the headline hook.
- "How it works" steps 1–3 are all described as "seconds" / "minutes" / "instantly" — nothing anchors the user in reality.

### 3.2 `login.html` — sign-in page (734 lines, ~440 lines of inline `<style>`)

**Positives**
- Split layout (brand panel + form panel) is a good SaaS pattern and well-executed
- Password visibility toggle, autocomplete hints, input validation, loading spinner on submit, error alert box
- `autocomplete="email"`, `autocomplete="current-password"`, `autocapitalize="none"` — correct mobile UX
- Stores JWT in localStorage under both legacy and Zustand keys for cross-app compat

**Problems**
- **Brand panel disappears entirely on mobile** (`@media (max-width: 768px) { .auth-brand { display: none; } }`). Mobile users see a bare form with no trust signals, no value prop, no logo at top. This is the single biggest conversion leak on the page.
- **"Forgot password?" links to `forgot-password.html` which does not exist.** Tested — clicking it falls through to the homepage via nginx SPA fallback. Must either build the forgot-password page OR remove the link.
- **No social login** (Google, Apple) — for a consumer parental-controls product where "create yet another account" is the #1 friction, social auth is almost mandatory.
- **No "show password on hold" on touch devices** — the password eye-icon toggles display, but for a family product where parents are typing on phones with small keyboards, a press-and-hold pattern is nicer.
- **Error alert is a red box above the form.** Should also announce to screen readers (`role="alert"` is set ✓) and should clear automatically on input focus (currently persists until next submit attempt).
- **Remember me checkbox** stores a flag but never expires the token based on it — the actual JWT TTL is server-side, so the checkbox is cosmetic.
- **No "last logged in from device X" hint** — good place for a subtle trust/security signal post-login.
- **Redirect destination is hardcoded to `/app/`.** No support for `?redirect=/app/settings` or similar, so deep-linking through login is impossible.

### 3.3 `register.html` — account creation (896 lines, similar structure to login)

**Positives**
- Full name + email + optional phone (with country-code dropdown) + password + confirm + terms checkbox — correct fields
- Password strength meter with live feedback (`checkStrength()` → `pwdFill` bar)
- Terms + Privacy checkbox with link
- Country-code emoji flags for phone prefix (nice touch)

**Problems**
- **Same mobile brand-panel-hidden issue as login.**
- **Terms/Privacy links go to `/terms` and `/privacy` (no `.html`)** — these 404 (fall back to homepage via SPA fallback). Must be `/terms.html` and `/privacy.html`.
- **No email verification flow** — user submits, gets a JWT immediately, redirects to `/app/`. For a family product with child profiles, email verification is table stakes.
- **No captcha** — open to bot signups.
- **Phone prefix dropdown is a `<select>` with only 7 options** — for a platform targeting "families worldwide" this should use an intl-tel-input library or at least a searchable list.
- **4-step onboarding in the brand panel** (Create account → Add profile → Scan QR → Protected) describes a flow that doesn't exist yet — step 3 "Scan QR on Child's Device" is aspirational; there's no QR generation in the product.
- **"100% Free for Families" badge on brand panel** contradicts the landing page which has a paid "Standard ₹299/mo" and "Premium ₹599/mo" tier. Pick one.

### 3.4 `dashboard.html` — **DEAD CODE** (996 lines)

**Problem**
- `<meta http-equiv="refresh" content="0;url=/app/"/>` redirects immediately. Everything else in the file (~990 lines of HTML + CSS for a sidebar, topnav, kids list, etc.) is never rendered.
- The file is there as a legacy artifact from before the React dashboard was built.

**Fix**
- Replace with a 15-line redirect shell:
  ```html
  <!DOCTYPE html>
  <html lang="en"><head>
    <meta charset="UTF-8"/>
    <meta http-equiv="refresh" content="0;url=/app/"/>
    <link rel="canonical" href="https://shield.rstglobal.in/app/"/>
    <title>Shield Dashboard</title>
    <script>window.location.replace('/app/');</script>
  </head><body>
    <p>Redirecting to <a href="/app/">Shield Dashboard</a>…</p>
  </body></html>
  ```
- Saves ~40 KB on the shipped nginx image.

### 3.5 `privacy.html` (623 lines) and `terms.html` (443 lines)

**Positives**
- These are the only two pages that actually use `style.css` + a modest inline `<style>` supplement
- Proper Table of Contents with anchor navigation
- Legal content is complete and readable

**Problems**
- **Different color palette** from every other page. Uses `#1565C0` / `#0D47A1` (from the legacy `style.css`) instead of `#005DAC` / `#003D72` (from the new index.html inline palette). When a user clicks "Privacy" from the homepage footer, they visit a page that looks like a different product.
- **No nav bar on these pages.** The user lands on the legal page and has no way to navigate back to Features, Pricing, etc. without clicking the browser Back button.
- **`.policy-hero` on privacy.html uses `background: linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)`** — a completely different gradient from `index.html`'s hero which uses `#003D72 → #005DAC → #1976D2`. Side-by-side they look like different websites.
- **No "Last updated" timestamp visible from quick scan** — may need inspection.

### 3.6 `share.html` — public location share page (198 lines)

**Positives**
- Standalone, single-purpose page: unauthenticated share of a child's location via token
- Clean Leaflet map integration with custom marker + accuracy circle
- Handles 404 (expired), 410 (removed), network errors with friendly messages
- Auto-refreshes every 30s

**Problems**
- **Uses `'Segoe UI', Arial, sans-serif`** — not Manrope/Inter like the rest of the site. This is 1990s Windows default and clashes with the SaaS aesthetic.
- **Uses colors `#1976D2` / `#1565C0`** — third different blue palette across the site.
- **No Shield logo in the header** — users viewing a share link from someone else have no brand anchor.
- **Loads Leaflet from `unpkg.com`** — external CDN, adds a DNS lookup + possible blocker if unpkg is down or blocked in certain regions. For a location feature that might be used from school WiFi, this is risky.
- **Info bar (Child / Last Updated / Accuracy / Expires)** is OK but the typography scale is inconsistent with other pages (13px/14px labels vs 11.5px/0.88rem elsewhere).
- **No "Refresh" button** — user has to wait 30s for the next auto-refresh.

### 3.7 `qa-report.html` — auto-generated QA dashboard (355 lines)

**Positives**
- Dark mode slate palette (`#0f172a` / `#1e293b`) is legitimately nice-looking
- KPI cards at top with Total / Passed / Failed / Pass Rate / Duration
- Uses Chart.js for visualizations
- Print-friendly CSS (`@media print { body { background:#fff;color:#000 } }`)

**Problems**
- **Completely disconnected from the site aesthetic.** Dark slate palette, different font stack (`-apple-system`), no nav, no footer, no Shield branding.
- **Publicly accessible** at `/qa-report.html` — is this intentional? It exposes internal test counts and failure details to anyone who guesses the URL. Should probably be `noindex, nofollow` and/or gated behind auth.
- **Auto-generated** — by whom? By the QA agent in `qa/shield_qa_agent.py`? If yes, it overwrites this file every run, which means any manual edits get wiped. Needs to be documented.
- **Hardcoded date "2026-04-08"** in the title suggests the generator does not refresh the title dynamically.

### 3.8 Missing pages

- `/forgot-password.html` — linked from login.html, does not exist, falls back to homepage
- `/404.html` — no explicit error page
- `/500.html` — no explicit error page
- `/about.html` — footer links to "About RST Global" via `href="#"`
- `/support.html` — footer links to "Support" via `href="#"`
- `/blog/` — no content marketing surface for SEO
- `/changelog.html` — no "what's new" feed for existing users
- `/status.html` — no system status page (surprising for a service called "Shield" that handles DNS)
- A `/pricing.html` standalone — currently pricing is an anchor on index.html. For SEO and paid-ads landing, pricing as a standalone URL is better.

---

## 4. Design system analysis

### 4.1 Color palette chaos

**138 unique colors** referenced across the site. The top 15:

| Count | Hex | Where | Purpose |
|---|---|---|---|
| 53 | `#94A3B8` | qa-report | slate-400 (dark mode text) |
| 37 | `#1565C0` | style.css, privacy, terms, share, qa-report | "blue" (legacy primary) |
| 32 | `#334155` | qa-report, legal pages | slate-700 |
| 26 | `#F1F5F9` | multiple | slate-100 |
| 26 | `#16A34A` | qa-report | green-600 (pass) |
| 24 | `#1976D2` | index hero, auth pages, share | "blue-mid" |
| 17 | `#005DAC` | index only | "primary" (new palette) |
| 12 | `#1E293B` | qa-report | slate-800 |
| 8 | `#0D47A1` | style.css, auth.css | "blue-dark" (legacy) |
| 8 | `#003D72` | index only | "primary-dark" (new) |
| 8 | `#64748B` | mixed | slate-500 |

**Translation:** we have *three different "dark blue"* values (`#003D72`, `#0D47A1`, `#1565C0`), *two different "primary blue"* values (`#005DAC`, `#1565C0`), and *three different "accent blue"* values (`#1976D2`, `#42A5F5`, `#0277BD`). No single source of truth.

### 4.2 Typography chaos

- `index.html`, `login.html`, `register.html`: **Manrope** (display) + **Inter** (body) — good dual-font pattern.
- `privacy.html`, `terms.html`: **Inter only** (no Manrope import) — headings are in Inter, inconsistent with the landing page.
- `share.html`: **`'Segoe UI', Arial, sans-serif`** — Windows default, no Google Fonts load.
- `qa-report.html`: **`-apple-system, BlinkMacSystemFont, 'Segoe UI'`** — system stack, no Google Fonts.

Result: **4 different font stacks** across 9 pages.

### 4.3 Spacing chaos

No spacing token system. Values like `padding: 48px 44px` / `gap: 20px` / `margin-bottom: 26px` are hand-tuned per component. Should be a single 8pt (or 4pt) scale:
```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-12: 48px
--space-16: 64px
--space-20: 80px
```

### 4.4 Radius chaos

- `index.html`: `--radius-sm: 10px, --radius-md: 14px, --radius-lg: 20px`
- `login.html` / `register.html` / `dashboard.html`: `--r: 12px` (single)
- `auth.css`: `--radius-sm: 8px, --radius: 14px, --radius-lg: 20px`
- `style.css`: `--radius: 12px`
- Hardcoded values: `8px`, `10px`, `12px`, `14px`, `16px`, `20px`, `36px` (phone mockup), `50%`, `100px`

### 4.5 Shadow chaos

Every page redefines shadows. Common patterns:
- `0 8px 32px -4px rgba(15,31,61,0.06)` (6 files)
- `0 12px 40px -4px rgba(15,31,61,0.12)` (4 files)
- `0 24px 64px -12px rgba(15,31,61,0.14)` (auth only)
- `0 4px 24px rgba(0,0,0,.08)` (style.css)

**Fix: one design-tokens file.**

---

## 5. Animation and interaction review

**Currently on the site:**
1. `pulse-dot` keyframe on hero-badge (green dot) ✓
2. IntersectionObserver counter animation on `.stats` (1600ms ease-out cubic) ✓
3. CSS hover: `transform: translateY(-1px/-4px)` on buttons and cards ✓
4. Nav shadow toggle on scroll (`scrollY > 20`) ✓
5. Mobile menu slide-down (CSS class toggle) ✓
6. Smooth scroll on anchor links ✓
7. Password visibility toggle (JS SVG swap) ✓
8. Login/register button spinner during submit ✓

**Missing (what "modern, interactive" usually means):**
- **Scroll-reveal** on every major section (fade + 20px rise, staggered)
- **Parallax** on hero background (tilt or ken-burns on scroll)
- **Magnetic buttons** (slight mouse-follow on hover, e.g. `btn-primary`)
- **Marquee / infinite logo slider** for "trusted by" section
- **Animated phone mockup** — live-updating screen time, blocked sites counter, pulsing alert
- **Page transitions** between `/`, `/login.html`, `/register.html` (soft fade or slide) — requires view transitions API or a JS router
- **Hover gradient shift** on feature cards (radial gradient follows cursor)
- **Testimonial carousel** with auto-advance or manual swipe
- **Count-up on scroll** for the "50K+" / "99.9%" / "5★" — already done ✓
- **Sticky CTA** that appears after scrolling past hero (mobile)

Recommendation: add scroll-reveal + parallax + animated phone mockup in Phase B. Skip magnetic buttons and complex transitions until we have a real design spec.

---

## 6. Mobile responsiveness

| Page | Mobile behavior | Status |
|---|---|---|
| index.html | Hamburger menu, features stack, pricing single-col, hero phone **hidden** | 🟡 phone-mockup missing is a loss |
| login.html | Brand panel **hidden** | 🔴 major conversion leak |
| register.html | Brand panel **hidden** | 🔴 major conversion leak |
| dashboard.html | Redirects to /app/ | n/a |
| privacy.html | Reflows via container | 🟡 usable, no hamburger nav |
| terms.html | Reflows via container | 🟡 usable, no hamburger nav |
| share.html | Map full-height, info bar wraps | 🟢 OK |
| qa-report.html | Flex KPI cards wrap | 🟢 OK |

**Critical fix:** Auth pages need a **mobile-first** layout where the brand content becomes a condensed header band above the form (not completely hidden). Something like:

```
┌──────────────────────┐
│  [Shield Logo]       │
│  Your family's       │  ← compressed brand band
│  safety starts here. │    (instead of hidden)
├──────────────────────┤
│                      │
│  [Email  ]           │
│  [Pass   ]           │
│  [Sign In]           │
│                      │
└──────────────────────┘
```

---

## 7. Accessibility review

**Good:**
- `role="alert"` on error boxes ✓
- `aria-label` on hamburger button ✓
- `autocomplete` attributes on form inputs ✓
- Semantic `<nav>`, `<main>`, `<aside>`, `<footer>` on auth pages ✓
- `lang="en"` on `<html>` ✓
- `alt=""` not needed on decorative SVGs — but also NOT set on phone-mockup elements

**Bad:**
- **No skip-link** (`<a href="#main" class="skip-link">Skip to content</a>`) on any page
- **No visible focus ring** styles overridden from browser default — `outline: none` not set explicitly but button/input focus is not styled, so it falls through to browser default which is inconsistent
- **Material Symbols icon fonts** are used as content inside `<span class="material-symbols-outlined">security</span>` — these are **decorative** and should have `aria-hidden="true"` so screen readers don't announce "security" as a word
- **Form errors** (`<div class="field-error" id="emailError">`) are not linked to their inputs via `aria-describedby`
- **Toggled `display: block/none`** for alert boxes — screen readers don't re-announce when `display` changes unless the box has `role="alert"` AND is in a live region. Currently the alert has `role="alert"` ✓ but the pattern could be improved.
- **Pricing cards** use `<div>` — the tier name, price, and list should probably be in an article + heading structure.
- **Testimonials** use `<blockquote>` — actually they use `<p>`. Should be `<blockquote>` + `<cite>` for the author.
- **Color contrast** not verified — `#4A6481` on `#F7F9FB` needs a measurement. Looks borderline.

---

## 8. Performance

**Good:**
- Pages are tiny: home is 13 KB gzipped, all other pages under 10 KB.
- nginx gzip is on for `text/*`, `application/javascript`, `image/svg+xml`.
- Fonts use `&display=swap` (prevents FOIT).
- Long-cache on `/app/assets/*.{js,css,woff2}` via nginx headers.
- No heavy libraries on the landing page (no jQuery, no bootstrap, no Tailwind CDN).

**Bad:**
- **Google Fonts** loaded from `googleapis.com` — 1 DNS lookup, 1 handshake, 1 CSS file, N WOFF2 subsets. Self-hosting the fonts would save ~150 ms on first visit.
- **Material Symbols Outlined** is loaded as a *variable font* that can be 300+ KB. On the landing page, only ~12 distinct symbols are used. Could be replaced with inline SVGs (saves ~280 KB on first visit).
- **Each HTML page duplicates ~40 KB of inline CSS** that should be extracted to a shared stylesheet → 1× browser download + 1× HTTP cache hit across the whole site.
- **No service worker / PWA offline cache** despite the manifest.json being referenced. The manifest is there but there's no `sw.js` or `navigator.serviceWorker.register` call.
- **Dashboard.html is 40 KB of dead code** served to every user who clicks "Dashboard" from the footer before being redirected.
- **Favicon is SVG** — great for sharp rendering, but older browsers will fallback to no icon. Add a `<link rel="alternate icon" href="/favicon.ico">` too.

**Lighthouse baseline (via curl timing, since headless Chrome is not installed on this server):**
```
Home page    13 KB gzipped     TTFB 107 ms     Total 135 ms    HTTP/2 via Cloudflare-like nginx
Login        6.7 KB gzipped    TTFB ~100 ms    Total 120 ms
Register     8.7 KB gzipped    TTFB ~100 ms    Total 120 ms
Share        2.8 KB gzipped    TTFB ~100 ms    Total 100 ms  (+ external Leaflet)
```

Actual Core Web Vitals (LCP, CLS, INP) require Chrome headless — not available here. Can be run against the new deploy via PageSpeed Insights once the Google quota resets (24h), or by installing Chromium locally.

---

## 9. Content hierarchy and user journey

### Current flow from `/`

```
Home (hero)
  ↓ CTA "Start Free Trial" → /register.html
  ↓ CTA "Download App" → anchor #download → same page scroll → APK link
  ↓ Nav "Sign In" → /login.html → /app/
  ↓ Nav "Get Started" → /register.html → /app/
  ↓ Scroll → Features → How It Works → Stats → Pricing → Testimonials → Download → CTA → Footer
```

### Problems with the journey

1. **No "See a demo" or "Watch video" path.** Users who want proof before signing up have only read-only content.
2. **Download and Sign-Up compete for attention.** The hero has two equal-weight CTAs ("Start Free Trial" + "Download App") which makes the user pick. Single primary CTA + single secondary CTA is stronger.
3. **No exit-intent / email capture.** Users who bounce don't leave an email.
4. **No "Compare plans" modal** on pricing — users scrolling on a phone see 3 tall cards stacked and can't easily diff them.
5. **No live chat** or contact form — users with pre-sale questions have nowhere to ask.
6. **No "case studies" or press mentions** — the site says "50K+ families" but no brand logos, no press quotes, no review site badges.

---

## 10. Codebase/architecture review

- **All presentation is inline HTML + inline CSS.** Maintainability cost is very high — changing a color means search-and-replace across 9 files.
- **No build step for the website.** nginx just serves files as-is. This means:
  - No CSS minification beyond gzip
  - No dead-code elimination
  - No image optimization pipeline
  - No versioning/hashing for cache busting (except `?v=2` on style.css)
- **No linting or formatting.** No `.editorconfig`, no Prettier config for HTML/CSS.
- **No tests.** No visual regression, no lint, no link checker running against the deployed site.
- **JavaScript is inline at the bottom of each page.** Each page has its own ~50-line script block with event listeners, counters, form handlers. Not shared.

**Options going forward:**

1. **Keep static, clean it up** — extract shared tokens to `tokens.css`, extract shared partials (nav, footer) via server-side includes or client-side fetch(). Fastest path; no framework migration; preserves current perf.

2. **Move to a static site generator** — [11ty (Eleventy)](https://www.11ty.dev/), [Astro](https://astro.build/), or [Hugo]. Keeps the pure-static output and nginx serving, but adds component reuse, tokens, Markdown for legal pages, image pipeline. Recommended if content is going to grow (blog, case studies, changelog).

3. **Migrate to Next.js 15** — same component model as the React dashboard, SSR + ISR for SEO, built-in image optimization, MDX for legal pages. Best for a product roadmap with content marketing + a unified codebase. Downside: adds a Node build step to the pipeline.

**My recommendation for Phase B: option 1 (keep static, clean it up).** Get the visible wins fast. Migrate to Astro or Next only if the user explicitly wants blogs / case studies / i18n in the future.

---

## 11. Proposed new design system (ready to apply in Phase B)

### Tokens file — `shield-website/tokens.css`

```css
:root {
  /* ─── Brand ─────────────────────────────────────── */
  --brand-900: #0A1F44;   /* deepest navy - hero text shadow, footer bg */
  --brand-800: #0F2A5E;   /* darker blue for gradient endpoint */
  --brand-700: #1538A0;   /* button hover */
  --brand-600: #1E4FC4;   /* primary — CTA, links */
  --brand-500: #3B6FE0;   /* primary hover, badges */
  --brand-400: #6B9BF5;   /* accent, subtle */
  --brand-100: #E0EBFF;   /* tinted background for cards */
  --brand-50:  #F0F6FF;   /* page-level tinted surface */

  /* ─── Neutrals (slate) ──────────────────────────── */
  --ink-900: #0F172A;     /* headings */
  --ink-700: #334155;     /* body text */
  --ink-500: #64748B;     /* muted text */
  --ink-300: #CBD5E1;     /* borders */
  --ink-100: #F1F5F9;     /* subtle bg */
  --ink-50:  #F8FAFC;     /* page bg */
  --white:   #FFFFFF;

  /* ─── Status ───────────────────────────────────── */
  --success: #16A34A;
  --warning: #F59E0B;
  --danger:  #DC2626;
  --info:    #0EA5E9;

  /* ─── Typography ───────────────────────────────── */
  --font-display: 'Manrope', system-ui, sans-serif;
  --font-body:    'Inter', system-ui, sans-serif;
  --font-mono:    ui-monospace, 'SF Mono', Menlo, monospace;

  --text-xs:   0.75rem;    /*  12px */
  --text-sm:   0.875rem;   /*  14px */
  --text-base: 1rem;       /*  16px */
  --text-lg:   1.125rem;   /*  18px */
  --text-xl:   1.25rem;    /*  20px */
  --text-2xl:  1.5rem;     /*  24px */
  --text-3xl:  1.875rem;   /*  30px */
  --text-4xl:  2.25rem;    /*  36px */
  --text-5xl:  3rem;       /*  48px */
  --text-6xl:  3.75rem;    /*  60px */

  --leading-tight:  1.15;
  --leading-snug:   1.3;
  --leading-normal: 1.55;
  --leading-relaxed: 1.7;

  /* ─── Spacing (4-point scale) ──────────────────── */
  --s-1:  4px;
  --s-2:  8px;
  --s-3:  12px;
  --s-4:  16px;
  --s-5:  20px;
  --s-6:  24px;
  --s-8:  32px;
  --s-10: 40px;
  --s-12: 48px;
  --s-16: 64px;
  --s-20: 80px;
  --s-24: 96px;
  --s-32: 128px;

  /* ─── Radii ────────────────────────────────────── */
  --r-sm:   6px;
  --r-md:   10px;
  --r-lg:   14px;
  --r-xl:   20px;
  --r-2xl:  28px;
  --r-full: 9999px;

  /* ─── Shadows (layered) ────────────────────────── */
  --shadow-sm:  0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-md:  0 6px 16px -4px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04);
  --shadow-lg:  0 16px 40px -8px rgba(15, 23, 42, 0.12), 0 8px 16px -4px rgba(15, 23, 42, 0.06);
  --shadow-xl:  0 32px 72px -12px rgba(15, 23, 42, 0.18);
  --shadow-glow: 0 0 0 6px rgba(30, 79, 196, 0.15);  /* focus ring */

  /* ─── Motion ───────────────────────────────────── */
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --d-fast:    150ms;
  --d-mid:     250ms;
  --d-slow:    400ms;
  --d-very-slow: 700ms;

  /* ─── Layout ───────────────────────────────────── */
  --container: 1200px;
  --container-narrow: 820px;

  /* ─── Z-index scale ────────────────────────────── */
  --z-nav: 100;
  --z-overlay: 1000;
  --z-modal: 1100;
  --z-tooltip: 1200;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Component primitives to be defined in `components.css`

- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-lg`, `.btn-sm`, `.btn-icon`
- `.card`, `.card-interactive` (hover lift)
- `.field`, `.input`, `.input-wrap`, `.label`, `.field-error`
- `.nav`, `.nav-inner`, `.nav-links`, `.nav-cta`
- `.footer`, `.footer-grid`, `.footer-col`
- `.container`, `.container-narrow`
- `.section`, `.section-label`, `.section-title`, `.section-subtitle`
- `.badge`, `.pill`
- `.alert`, `.alert-error`, `.alert-success`, `.alert-info`
- `.reveal` (scroll-triggered opacity/translate) — applied via JS

---

## 12. Proposed Phase B execution order

In strict order of user-impact:

### B1 — Ship the design system (~1.5 hours, 1 PR, zero visible change)
- Create `tokens.css` and `components.css`
- Replace `style.css` and `auth.css` with these (nginx serves `/tokens.css` + `/components.css`)
- No HTML changes yet. This is a refactor to lay the foundation.

### B2 — Redesign login + register (~2.5 hours, 1 PR)
- Replace inline `<style>` with links to `tokens.css` + `components.css`
- Mobile: brand panel becomes a condensed header band (NOT hidden)
- Add Google / Apple social login buttons (stub the handlers for now — backend integration is separate)
- Fix the `/forgot-password.html` link: either build the page or remove the link
- Fix `/terms` and `/privacy` → `/terms.html` and `/privacy.html`
- Add `aria-describedby` on form errors, visible focus rings, `aria-hidden` on decorative icons
- Keep the split-layout but lift typography to the new scale

### B3 — Redesign home page (~3.5 hours, 1 PR)
- Extract hero, features, how-it-works, pricing, testimonials into re-usable sections
- Animated phone mockup (pulse + counter update + alert slide-in)
- Scroll-reveal on feature cards, testimonials, pricing (staggered)
- Subtle parallax on hero gradient (background-position animation on scroll)
- Fix all footer `href="#"` to real URLs or remove
- Fix "Shield wraps every device — phone, tablet, laptop" → "Android phones and tablets" (honest)
- Replace Material Symbols icon font with ~12 inline SVGs (saves ~280 KB)
- Remove `.hero-phone { display: none; }` on mobile — show a scaled-down version instead
- Single primary CTA in hero (Get Started) + single secondary (Watch demo — stub for now)

### B4 — Clean up legal pages + dead code (~1 hour, 1 PR)
- `privacy.html` and `terms.html`: import `tokens.css` + `components.css`, add nav + footer, move to the new palette
- `dashboard.html`: shrink to 15-line redirect shell
- Delete `style.css` and `auth.css` entirely (replaced by `tokens.css` + `components.css`)

### B5 — Build missing pages (~2 hours, 1 PR)
- `forgot-password.html` — mirror login.html layout, email-only field, "check your inbox" success state
- `404.html` — friendly error page with nav back to home
- `500.html` — "something's wrong, we're looking at it" page
- Update nginx `error_page 404 /404.html; error_page 500 502 503 504 /500.html;`

### B6 — Modernize share.html and qa-report.html (~1 hour, 1 PR)
- `share.html`: import `tokens.css`, add Shield logo header, switch to Manrope/Inter, self-host Leaflet via CDN fallback
- `qa-report.html`: add `<meta name="robots" content="noindex, nofollow">`, add Shield logo header, align color palette to new slate tokens

### B7 — Scroll animations layer (~1.5 hours, 1 PR)
- A single `reveal.js` (~40 lines) with `IntersectionObserver` that adds `.is-visible` to any `[data-reveal]` element
- CSS: `[data-reveal] { opacity: 0; transform: translateY(20px); transition: var(--d-slow) var(--ease-out-quart); } [data-reveal].is-visible { opacity: 1; transform: none; }`
- Apply to feature cards, pricing cards, testimonials, how-it-works steps
- Reduced motion is already handled in `tokens.css`

### B8 — Performance + SEO pass (~1 hour, 1 PR)
- Self-host Google Fonts (download woff2, bundle into `/fonts/`)
- Replace Material Symbols with inline SVG sprite
- Add `<link rel="preload" as="image" href="og-image.svg">` for OG preview perf
- Add canonical URLs everywhere missing
- Add `theme-color` meta to all pages
- Add a real `sw.js` service worker + `navigator.serviceWorker.register` for offline index.html
- Run Lighthouse against new build, document scores, measure delta vs baseline

**Total Phase B: ~13 hours of work across 8 PRs, each deployable independently.**

---

## 13. Questions for you before Phase B starts

1. **Design direction** — do you have a Stitch/Figma design to match? If yes, upload screenshots and I'll match them pixel-by-pixel. If no, I'll use the palette and tokens proposed in section 11.

2. **Scope of "modern feel"** — what's the one reference site that feels right to you? Stripe? Linear? Apple? Notion? Vercel? Each has a different "modern" aesthetic.

3. **Platform truth** — is Shield Android-only, or is iOS coming soon / now? This changes the copy on the landing page ("works on phone, tablet, laptop" is currently a lie).

4. **Pricing truth** — is it really free, or is there a paid tier? The landing page shows paid tiers; the register.html brand panel says "100% Free". Which is correct?

5. **Forgot password flow** — does the backend already have a password reset endpoint? If not, building the `/forgot-password.html` page is frontend-only and the submit just shows "email sent" without actually sending.

6. **Email verification on register** — should we add a verification step before the user can access `/app/`?

7. **Do you want a blog / case studies / changelog?** This decides whether we stay static (Option 1) or migrate to Astro (Option 2).

8. **Analytics** — Google Analytics? Plausible? Umami? None?

9. **Approval gate on Azure DevOps for prod deploy** — is that intentional, or should I remove it for faster iteration?

---

## 14. What's NOT in scope for this audit

- **React dashboard at `/app/`** — separate codebase (`shield-dashboard/`), separate build, not reviewed here. Should be audited separately in a future phase.
- **Flutter Android app** — separate codebase, not part of this audit.
- **Backend services** — not part of this audit.
- **i18n** — currently English-only, no translation infrastructure. If needed, plan separately.
- **Accessibility audit with real assistive tech** — this review is code-level only. A real audit requires NVDA/VoiceOver testing.

---

**End of audit. Waiting for your approval on Phase B order, design direction, and the truth-check questions in section 13.**
