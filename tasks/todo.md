# Shield — Task Board

> Format: [ ] pending | [x] done | [~] in progress | [!] blocked

---

## Active Sprint

*(empty — add tasks here when starting a new session)*

---

## Backlog / Known Issues

- [ ] Schedule screen: verify end-to-end after grid format fix (load + save + AdGuard sync)
- [ ] Mobile: FCM push notifications need `google-services.json` from Firebase Console
- [ ] Mobile: biometric lock screen (currently shows "coming soon")
- [ ] Mobile: notification/alert switches in SettingsScreen are hardcoded to `true`
- [ ] Dashboard: APK version shown in release notes inline button was `v2.0.0` (fixed to v2.1.3)
- [ ] iOS app: not yet developed (website says "Coming Soon")
- [ ] shield-ai: DeepSeek fallback not tested end-to-end
- [ ] Comprehensive QA audit (pending from previous session)

---

## Completed

- [x] Phase 1–6: All 13 microservices running
- [x] React dashboard 30+ pages deployed
- [x] Flutter app v2.1.3 — 25+ screens, APK deployed
- [x] Windows Agent (Go + Python) source + binary
- [x] Stripe billing, webhooks, invoices
- [x] AdGuard Home + DNS filtering
- [x] Geofence breach, time budget enforcement, weekly digest
- [x] MFA (TOTP), family invite, QR device pairing
- [x] Login 21px overflow fix (v2.1.3)
- [x] Logout navigation fix (v2.1.3)
- [x] Schedule screen grid format bridge (v2.1.3)
- [x] filter_level constraint fix — V16 migration (RELAXED/LIGHT/etc now allowed)
