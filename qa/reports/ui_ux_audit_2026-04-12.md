# Shield UI/UX Audit — Guardian's Lens Compliance Report

**Date:** 2026-04-12
**Auditor:** Claude Opus 4.6 (automated)
**Scope:** shield-website (tokens.css, components.css, index.html, login.html, register.html) + shield-dashboard MUI theme (theme.ts)

---

## Executive Summary

The Shield platform has **two separate design systems** that partially overlap but do not fully align with the Guardian's Lens spec:

1. **shield-website** uses a navy/cobalt brand palette (`--brand-600: #1E4FC4`) with Manrope + Inter dual fonts. It follows some Guardian's Lens principles but violates the No-Line Rule extensively and uses flat-color buttons instead of gradient buttons.

2. **shield-dashboard** (MUI theme) uses the canonical Guardian's Lens primary `#005DAC` with proper gradient buttons, Guardian Shadow, and the No-Line Rule in light mode. It is significantly more compliant.

**Overall compliance: 6.2/10**

---

## 1. Color Token Mapping: IS vs SHOULD BE

### Guardian's Lens Spec Colors

| Token | Spec Value | Website (tokens.css) | Dashboard (theme.ts) | Match? |
|-------|-----------|---------------------|---------------------|--------|
| Primary | `#005DAC` | `--brand-600: #1E4FC4` | `ds.primary: #005DAC` | WEBSITE WRONG |
| Primary Container | `#1976D2` | `--brand-700: #1538A0` | `ds.primaryContainer: #1976D2` | WEBSITE WRONG |
| Surface | `#F7F9FB` | `--ink-50: #F8FAFC` | `ds.surface: #F7F9FB` | Website close but not exact |
| On Surface | spec n/a | `--ink-900: #0F172A` | `ds.onSurface: #0F1F3D` | Different values |
| Surface Container Low | n/a | `--ink-100: #F1F5F9` | `ds.surfaceContainerLow: #F0F4F8` | Close |
| Surface Container | n/a | n/a | `ds.surfaceContainer: #E8EEF4` | Website has no equivalent |
| Outline Variant | n/a | `--ink-300: #CBD5E1` | `ds.outlineVariant: #C4D0DC` at 20% | Different |

### Key Finding

The website uses a **completely different primary blue** (`#1E4FC4` cobalt) from the spec (`#005DAC` sapphire). This is the most significant color discrepancy. The dashboard correctly uses `#005DAC`.

---

## 2. Per-Page Compliance Audit

---

### 2A. index.html (Landing Page) — Score: 5.5/10

**Screenshot-equivalent description:**
A sticky glassmorphic nav bar sits atop a dark navy-to-cobalt hero section with a floating phone mockup on the right. Below: 6 white feature cards on light grey, a "How It Works" 3-step row, a dark stats bar, 3 pricing cards, 3 testimonial cards, a dark download CTA, a dark final CTA banner, and a dark footer.

#### Violations

| # | Rule Violated | Location | Details |
|---|--------------|----------|---------|
| V1 | **No-Line Rule** | index.html:79 | Nav has `border-bottom: 1px solid rgba(30,79,196,0.06)` — structural border |
| V2 | **No-Line Rule** | index.html:155 | `.nav-mobile` has `border-top: 1px solid var(--ink-200)` |
| V3 | **No-Line Rule** | index.html:164 | `.nav-mobile a` has `border-bottom: 1px solid var(--ink-100)` |
| V4 | **No-Line Rule** | index.html:294 | `.phone-card` has `border: 1px solid rgba(255,255,255,0.12)` — within hero, semi-acceptable as decorative ghost border |
| V5 | **No-Line Rule** | index.html:324 | `.phone-alert` has `border: 1px solid rgba(22,163,74,0.3)` |
| V6 | **No-Line Rule** | index.html:394 | `.feature-card` has `border: 1px solid var(--ink-200)` — full-opacity structural border on cards |
| V7 | **No-Line Rule** | index.html:432-433 | `.how` section has `border-top: 1px solid var(--ink-100)` AND `border-bottom: 1px solid var(--ink-100)` |
| V8 | **No-Line Rule** | index.html:499 | `.stat-item` has `border-right: 1px solid rgba(255,255,255,0.14)` |
| V9 | **No-Line Rule** | index.html:525 | `.pricing-card` has `border: 1px solid var(--ink-200)` |
| V10 | **No-Line Rule** | index.html:588 | `.pricing-divider` is a literal `height: 1px` divider line |
| V11 | **No-Line Rule** | index.html:623 | `.testi-card` has `border: 1px solid var(--ink-200)` |
| V12 | **No-Line Rule** | index.html:831 | `.footer-bottom` has `border-top: 1px solid rgba(255,255,255,0.08)` |
| V13 | **No-Line Rule** | index.html:882 | Mobile `.stat-item` has `border-bottom: 1px solid rgba(255,255,255,0.12)` |
| V14 | **Wrong primary color** | index.html:79 | Nav border uses `rgba(30,79,196,...)` = `#1E4FC4`, not `#005DAC` |
| V15 | **No gradient buttons** | components.css:137 | `.btn-primary` is flat `var(--brand-600)`, spec requires `linear-gradient(135deg, primary, primary_container)` |
| V16 | **Wrong shadow system** | tokens.css:100-105 | Shadows use `rgba(15,23,42,...)` (slate black), spec requires `on_surface@6%` never black |
| V17 | **Section headers centered** | components.css:80 | `.section-header` has `text-align: center` — spec says left-aligned asymmetric layouts |
| V18 | **How-it-works centered** | index.html:452 | `.how-step` has `text-align: center` — should be left-aligned |
| V19 | **CTA banner centered** | index.html:758 | `.cta-banner` has `text-align: center` |
| V20 | **Glassmorphism blur** | index.html:77 | Nav uses `blur(18px)` — spec says `blur(20px)` |
| V21 | **Glassmorphism opacity** | index.html:76 | Nav background is `rgba(248,250,252,0.82)` — spec says surface at 80% opacity. Actual is 82%, close but #F8FAFC is not `#F7F9FB` |
| V22 | **Missing polished sapphire** | hero section | No 15% `surface_tint` overlay on the hero primary container |
| V23 | **No 16px whitespace dividers** | index.html:588 | `.pricing-divider` uses a visible line instead of whitespace |

#### Compliant Elements
- Dual fonts (Manrope display, Inter body) -- CORRECT
- Glassmorphic nav with backdrop-filter -- MOSTLY CORRECT (blur 18 not 20)
- Left-aligned hero text with asymmetric grid layout -- CORRECT
- Phone mockup animations and reveal animations -- GOOD
- Feature icon gradient backgrounds -- CORRECT pattern
- Mobile responsive breakpoints at 1024/860px -- GOOD

---

### 2B. login.html (Sign In) — Score: 6/10

**Screenshot-equivalent description:**
A two-panel auth layout: left panel is a tall dark navy brand card with Shield logo, headline "Your family's safety starts here", 3 feature bullets, and a privacy trust badge. Right panel is a white card with email/password form, social login buttons, and switch links. On mobile (<=860px), the form reorders above the brand panel.

#### Violations

| # | Rule Violated | Location | Details |
|---|--------------|----------|---------|
| V1 | **No-Line Rule** | login.html:140 | `.brand-feat-icon` has `border: 1px solid rgba(255,255,255,0.15)` |
| V2 | **No-Line Rule** | login.html:168 | `.brand-trust` has `border: 1px solid rgba(255,255,255,0.12)` |
| V3 | **No-Line Rule** | login.html:199 | `.auth-form-box` has `border: 1px solid var(--ink-200)` — this is a structural border on a card |
| V4 | **No gradient on submit button** | login.html:554 | Submit button uses `.btn-primary` which is flat color, not gradient |
| V5 | **Social button borders** | login.html:310 | `.btn-social` has `border: 1.5px solid var(--ink-200)` — structural border |
| V6 | **Form divider line** | login.html:290-295 | `.form-divider::before/::after` renders a 1px line — violates no-divider rule |
| V7 | **Wrong primary color** | tokens.css:13 | All brand references point to `#1E4FC4` not `#005DAC` |
| V8 | **Card shadow uses slate** | tokens.css:103 | `--shadow-lg` uses `rgba(15,23,42,...)` not on_surface@6% |
| V9 | **Missing Guardian Shadow** | login.html:199 | `.auth-form-box` uses `--shadow-lg` which is the wrong shadow formula |

#### Compliant Elements
- "Form first" mobile pattern with `order: 1` / `order: 2` -- CORRECT
- Dual font usage throughout -- CORRECT
- Radial gradient background on body -- GOOD atmospheric touch
- Brand panel uses proper dark gradient -- GOOD
- Input focus ring using brand-colored box-shadow -- CORRECT pattern
- Skip link for accessibility -- CORRECT
- `prefers-reduced-motion` respected via tokens.css -- CORRECT

---

### 2C. register.html (Create Account) — Score: 6/10

**Screenshot-equivalent description:**
Same two-panel layout as login but the left brand panel shows numbered setup steps (01-04) instead of feature bullets. Right panel has name, email, phone (with country prefix), password with strength meter, confirm password, terms checkbox, and submit. Sticky left panel on desktop.

#### Violations

| # | Rule Violated | Location | Details |
|---|--------------|----------|---------|
| V1 | **No-Line Rule** | register.html:147 | `.brand-step-num` has `border: 1px solid rgba(255,255,255,0.18)` |
| V2 | **No-Line Rule** | register.html:178 | `.brand-trust` has `border: 1px solid rgba(255,255,255,0.12)` |
| V3 | **No-Line Rule** | register.html:221 | `.auth-form-box` has `border: 1px solid var(--ink-200)` |
| V4 | **Phone prefix border** | register.html:261 | `.phone-prefix` has `border: 1.5px solid var(--ink-300)` — structural border on select |
| V5 | **No gradient submit button** | register.html:299-306 | Same flat `.btn-primary` |
| V6 | **Wrong primary** | throughout | All `--brand-600` references are `#1E4FC4` |

#### Compliant Elements
- Form-first mobile pattern -- CORRECT
- Sticky brand panel on desktop -- GOOD UX
- Password strength meter uses tonal fills -- CORRECT
- Proper form field error states -- CORRECT
- Mobile breakpoints degrade gracefully -- CORRECT

---

### 2D. shield-dashboard MUI Theme (theme.ts) — Score: 8/10

**Screenshot-equivalent description:**
A comprehensive MUI theme implementing Guardian's Lens design tokens. Uses tonal surface stacking, gradient buttons, Guardian Shadow system, glassmorphic AppBar, and the No-Line Rule (no borders in light mode, ghost borders in dark mode only).

#### Violations

| # | Rule Violated | Location | Details |
|---|--------------|----------|---------|
| V1 | **AppBar border** | theme.ts:316 | `borderBottom: 1px solid ${outlineVar}` — the comment says "one allowed line" but spec says NO lines |
| V2 | **Table head border** | theme.ts:388 | `borderBottom: 1px solid ${outlineVar}` on table head cells |
| V3 | **Table cell border** | theme.ts:377 | `borderBottomColor: outlineVar` on all table cells |
| V4 | **Tabs border** | theme.ts:509 | `borderBottom: 1px solid ${outlineVar}` on tab strip |
| V5 | **Gradient direction** | theme.ts:244 | Contained button uses `linear-gradient(135deg, #004A8F 0%, ${p} 100%)` — should be `primary -> primary_container` per spec, not `#004A8F -> primary` |
| V6 | **Guardian Shadow incomplete** | theme.ts:143-155 | Shadow system is close but uses varying opacities (5-14%) rather than the consistent `on_surface@6%` the spec describes |
| V7 | **Missing polished sapphire** | n/a | The sapphire gradient is defined in `gradients.sapphire` but not automatically applied to primary containers |

#### Compliant Elements
- Primary `#005DAC` -- CORRECT
- Primary Container `#1976D2` -- CORRECT
- Surface `#F7F9FB` -- CORRECT
- Dual fonts: Manrope H1-H4, Inter H5+ -- CORRECT
- No card borders in light mode -- CORRECT
- Ghost borders at 20% in dark mode -- CORRECT
- Glassmorphic AppBar with `blur(20px)` at 88% opacity -- CORRECT (spec says 80%, theme uses 88%)
- Gradient buttons on contained variant -- CORRECT pattern
- Tonal surface stacking system -- CORRECT
- No black shadows -- CORRECT (uses `ds.onSurface` not `#000`)

---

## 3. Component-Level Compliance (components.css)

### Buttons (components.css:107-191)

| Aspect | Spec | Actual | Compliant? |
|--------|------|--------|-----------|
| Gradient | `primary -> primary_container at 135deg` | Flat `var(--brand-600)` | NO |
| Border | Ghost or none | `border: 1px solid transparent` | OK (transparent) |
| Shadow | Guardian shadow | Custom blue-tinted shadow | PARTIAL |
| Font | Manrope | `var(--font-display)` = Manrope | YES |
| Radius | Spec unclear | `var(--r-md)` = 10px | OK |

### Cards (components.css:335-349)

| Aspect | Spec | Actual | Compliant? |
|--------|------|--------|-----------|
| Border | None (tonal shift) | `border: 1px solid var(--ink-200)` | **NO** |
| Shadow | Guardian blur:32, spread:-4, on_surface@6% | `--shadow-md` (slate-based) | **NO** |
| Background | Surface tier | `var(--white)` | PARTIAL |

### Inputs (components.css:217-257)

| Aspect | Spec | Actual | Compliant? |
|--------|------|--------|-----------|
| Border | Ghost border 20% opacity | `1.5px solid var(--ink-300)` at full opacity | **NO** — should be outlineVariant@20% |
| Fill | surfaceContainerLow | `var(--white)` | **NO** — should be tonal fill |
| Focus ring | Brand colored | `var(--shadow-ring)` = brand-colored | YES |

### Alerts (components.css:303-332)

| Aspect | Spec | Actual | Compliant? |
|--------|------|--------|-----------|
| Border | None (tonal) | `border: 1px solid transparent` (base) + 20% colored borders on variants | PARTIAL |
| Background | Tonal | Tonal fills | YES |

---

## 4. Mobile Responsiveness Assessment

### index.html
- **860px breakpoint:** Nav collapses to hamburger, hero goes single-column, features stack to 1-col, pricing/testimonials go single-col. **GOOD.**
- **1024px breakpoint:** Features go 2-col, footer goes 2-col. **GOOD.**
- Hero text centers on mobile which diverges from spec's asymmetric preference, but is reasonable for single-column.
- Phone mockup scales down (240x440) and uses `transform: scale(0.92)`. **GOOD.**

### login.html
- **860px:** Form gets `order: 1`, brand gets `order: 2` -- form-first pattern **WORKING CORRECTLY**.
- Mobile logo appears via `.form-mobile-logo { display: flex !important }`. **GOOD.**
- Brand features hide on mobile, brand panel compacts. **GOOD.**
- **420px:** Social grid goes single-column, extra padding reduced, back link hidden. **GOOD.**

### register.html
- **860px:** Same form-first pattern as login. Brand steps hide on mobile. **WORKING CORRECTLY.**
- **420px:** Further spacing reduction, brand sub-text hidden. **GOOD.**
- Sticky brand panel becomes `position: static` on mobile. **CORRECT.**

### Dashboard (theme.ts)
- MUI handles responsiveness via built-in breakpoints. Theme does not set explicit breakpoints but MUI components are inherently responsive. **ADEQUATE.**

---

## 5. Priority-Ordered Fix List

### P0 — Critical (Brand Identity Mismatch)

**Fix 1: Align website primary color to spec**
- File: `shield-website/tokens.css`
- Change `--brand-600: #1E4FC4` to `--brand-600: #005DAC`
- Change `--brand-700: #1538A0` to `--brand-700: #1976D2` (primary container)
- Recalculate the entire brand scale from `#005DAC` base:
  ```
  --brand-950: #001B3A
  --brand-900: #002D5E
  --brand-800: #003D72
  --brand-700: #1976D2   (primary container)
  --brand-600: #005DAC   (PRIMARY)
  --brand-500: #2196F3
  --brand-400: #42A5F5
  --brand-300: #90CAF9
  --brand-200: #BBDEFB
  --brand-100: #E3F2FD
  --brand-50:  #F7F9FB
  ```

### P1 — High (No-Line Rule Violations)

**Fix 2: Remove card borders on website**
- File: `shield-website/components.css:340`
- Change: `border: 1px solid var(--ink-200)` -> `border: none`
- Add box-shadow upgrade to compensate: use Guardian Shadow

**Fix 3: Remove feature-card borders**
- File: `shield-website/index.html:394`
- Change: `border: 1px solid var(--ink-200)` -> `border: none`

**Fix 4: Remove pricing-card borders**
- File: `shield-website/index.html:525`
- Change: `border: 1px solid var(--ink-200)` -> `border: none`

**Fix 5: Remove testimonial-card borders**
- File: `shield-website/index.html:623`
- Change: `border: 1px solid var(--ink-200)` -> `border: none`

**Fix 6: Remove "How" section top/bottom borders**
- File: `shield-website/index.html:432-433`
- Change: Remove `border-top` and `border-bottom`. Use `background: var(--white)` tonal shift (already present) as the only separator.

**Fix 7: Replace pricing-divider with whitespace**
- File: `shield-website/index.html:588-592`
- Change: `height: 1px; background: var(--ink-200)` -> `height: 16px; background: transparent`

**Fix 8: Remove auth form-box border**
- Files: `shield-website/login.html:199`, `shield-website/register.html:221`
- Change: `border: 1px solid var(--ink-200)` -> `border: none`

**Fix 9: Remove social button borders**
- File: `shield-website/login.html:310`
- Change: `border: 1.5px solid var(--ink-200)` -> `border: none; background: var(--ink-100)`

**Fix 10: Remove form divider lines**
- File: `shield-website/login.html:290-295`
- Change: Replace `height: 1px; background: var(--ink-200)` with `height: 0` or use whitespace gap only.

**Fix 11: Remove nav border-bottom**
- File: `shield-website/index.html:79`
- Change: `border-bottom: 1px solid rgba(30,79,196,0.06)` -> `border-bottom: none`

**Fix 12: Remove stat-item border-right**
- File: `shield-website/index.html:499`
- Change: `border-right: 1px solid rgba(255,255,255,0.14)` -> `border-right: none`
- Add gap between items instead.

**Fix 13: Dashboard AppBar border**
- File: `shield-dashboard/src/theme/theme.ts:316`
- Change: `borderBottom: \`1px solid ${outlineVar}\`` -> `borderBottom: 'none'`

### P2 — Medium (Gradient Buttons, Shadows)

**Fix 14: Add gradient to .btn-primary**
- File: `shield-website/components.css:137-146`
- Change:
  ```css
  .btn-primary {
    background: linear-gradient(135deg, var(--brand-600), var(--brand-700));
    /* was: background: var(--brand-600); */
  }
  .btn-primary:hover {
    background: linear-gradient(135deg, var(--brand-700), var(--brand-800));
  }
  ```

**Fix 15: Fix shadow system to Guardian Shadow**
- File: `shield-website/tokens.css:99-105`
- Change all shadows to use `on_surface` tint instead of slate:
  ```css
  --shadow-md: 0 8px 32px -4px rgba(15,31,61,0.06);
  /* Was mixing slate #0F172A, should use on_surface #0F1F3D at 6% */
  ```

**Fix 16: Fix nav glassmorphism blur**
- File: `shield-website/index.html:77`
- Change: `blur(18px)` -> `blur(20px)` and opacity to 80%:
  ```css
  background: rgba(247, 249, 251, 0.80);
  backdrop-filter: blur(20px);
  ```

### P3 — Low (Layout Asymmetry, Polish)

**Fix 17: Left-align section headers**
- File: `shield-website/components.css:80`
- Change: `text-align: center` -> `text-align: left`
- Remove: `margin-left: auto; margin-right: auto` (lines 83-84)
- This is a significant layout change and may require hero/section redesign.

**Fix 18: Fix input background fill**
- File: `shield-website/components.css:222`
- Change `.input-wrap` background: `var(--white)` -> `var(--ink-100)` (approximate surfaceContainerLow)

**Fix 19: Fix input border opacity**
- File: `shield-website/components.css:223`
- Change: `border: 1.5px solid var(--ink-300)` -> `border: 1.5px solid rgba(203,213,225,0.2)` (ghost border at 20%)

**Fix 20: Add polished sapphire overlay**
- Add to hero and primary container sections:
  ```css
  .hero::after { /* existing pseudo is used, may need wrapper */
    background: radial-gradient(ellipse at 70% -10%, rgba(0,93,172,0.15) 0%, transparent 60%);
  }
  ```

**Fix 21: Fix dashboard contained button gradient**
- File: `shield-dashboard/src/theme/theme.ts:244`
- Change: `linear-gradient(135deg, #004A8F 0%, ${p} 100%)` -> `linear-gradient(135deg, ${p} 0%, ${pCont} 100%)`

**Fix 22: Dashboard AppBar opacity**
- File: `shield-dashboard/src/theme/theme.ts:311`
- Change: `alpha('#FFFFFF', 0.88)` -> `alpha('#FFFFFF', 0.80)` (spec says 80%)

---

## 6. Summary Scores

| Page | Score | Key Issues |
|------|-------|-----------|
| index.html | 5.5/10 | 13+ border violations, wrong primary, flat buttons, centered layouts |
| login.html | 6.0/10 | Form box border, flat button, social borders, divider line |
| register.html | 6.0/10 | Same as login + phone prefix border, step number borders |
| theme.ts (dashboard) | 8.0/10 | AppBar/Table/Tab borders, button gradient direction, opacity |
| tokens.css | 5.0/10 | Wrong primary palette, wrong shadow base color |
| components.css | 5.5/10 | Card borders, flat buttons, full-opacity input borders |

**Weighted Overall: 6.2/10**

The dashboard theme is the closest to spec compliance and should be considered the reference implementation. The website needs its color palette realigned to `#005DAC` and a systematic removal of all structural 1px borders in favor of tonal surface shifts and Guardian Shadow.

---

## Appendix: Files Audited

- `/var/www/ai/FamilyShield/shield-website/tokens.css` (133 lines)
- `/var/www/ai/FamilyShield/shield-website/components.css` (426 lines)
- `/var/www/ai/FamilyShield/shield-website/index.html` (~1100 lines)
- `/var/www/ai/FamilyShield/shield-website/login.html` (735 lines)
- `/var/www/ai/FamilyShield/shield-website/register.html` (~700 lines)
- `/var/www/ai/FamilyShield/shield-dashboard/src/theme/theme.ts` (693 lines)
