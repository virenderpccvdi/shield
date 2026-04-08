"""
Suite: Role-Based Access Control
Tests permission boundaries across GLOBAL_ADMIN, ISP_ADMIN, CUSTOMER roles.
Validates no data leakage and correct 403 responses.
"""
import psycopg2, requests
from .base import TestSuite, Severity


class RbacSuite(TestSuite):
    name = "rbac"

    def _get_token(self, email, password):
        try:
            r = requests.post(f"{self.base}/api/v1/auth/login",
                              json={"email": email, "password": password}, timeout=8)
            d = r.json().get("data", {})
            return d.get("accessToken") or d.get("token", "")
        except:
            return ""

    def _hdrs_for(self, token):
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def run(self):
        print("\n── RBAC ─────────────────────────────────────────────────")

        # ── Admin token (already held in self.jwt) ─────────────────────────
        admin_token = self.jwt
        admin_hdrs  = self._hdrs_for(admin_token)

        # ── Endpoints that ONLY GLOBAL_ADMIN can access ────────────────────
        admin_only = [
            ("GET /api/v1/tenants",                 "/api/v1/tenants"),
            ("GET /api/v1/admin/invoices",          "/api/v1/admin/invoices"),
            ("GET /api/v1/admin/tenants/stats",     "/api/v1/admin/tenants/stats"),
        ]
        for label, path in admin_only:
            r = requests.get(f"{self.base}{path}", headers=admin_hdrs, timeout=8)
            self.assert_ok(f"GLOBAL_ADMIN can access {label}",
                           r is not None and r.status_code == 200,
                           f"Got {r.status_code if r else 'no response'}",
                           severity=Severity.CRITICAL)

        # ── Endpoints that require CUSTOMER role (not accessible to admin) ─
        customer_restricted = [
            ("GET /api/v1/profiles/children",     "/api/v1/profiles/children"),
            ("GET /api/v1/rewards/bank/{id}",     None),   # skip — needs profileId
        ]
        r_children = requests.get(f"{self.base}/api/v1/profiles/children",
                                  headers=admin_hdrs, timeout=8)
        self.assert_ok("GLOBAL_ADMIN forbidden on CUSTOMER-only /profiles/children",
                       r_children.status_code == 403,
                       f"Got {r_children.status_code} (expected 403 — CUSTOMER role required)",
                       severity=Severity.HIGH,
                       fix="This is correct RBAC — GLOBAL_ADMIN should not see child profiles")

        # ── No token → all protected endpoints return 401 ─────────────────
        for label, path in admin_only:
            r = requests.get(f"{self.base}{path}", timeout=8)
            self.assert_ok(f"No-auth 401 on {label}",
                           r is not None and r.status_code in (401, 403),
                           f"Got {r.status_code if r else 'timeout'} — should be 401/403",
                           severity=Severity.CRITICAL,
                           fix="JwtAuthenticationFilter must block unauthenticated requests")

        # ── Tampered JWT role claim ────────────────────────────────────────
        # Craft a JWT with CUSTOMER role but correct structure (invalid signature)
        import base64, json as _json
        header  = base64.urlsafe_b64encode(b'{"alg":"HS512"}').rstrip(b'=').decode()
        payload = base64.urlsafe_b64encode(
            _json.dumps({"sub":"fake","role":"CUSTOMER","email":"x@x.com"}).encode()
        ).rstrip(b'=').decode()
        fake_jwt = f"{header}.{payload}.fakesignature"
        r_fake = requests.get(f"{self.base}/api/v1/tenants",
                              headers={"Authorization": f"Bearer {fake_jwt}"}, timeout=8)
        self.assert_ok("Tampered JWT rejected (401/403)",
                       r_fake.status_code in (401, 403),
                       f"Got {r_fake.status_code} — tampered JWT was accepted!",
                       severity=Severity.CRITICAL,
                       fix="CRITICAL: JWT signature verification must be enforced")

        # ── SQL injection in auth params ───────────────────────────────────
        sqli_payloads = [
            "admin@rstglobal.in' OR '1'='1",
            "'; DROP TABLE auth.users; --",
            "admin@rstglobal.in'--",
        ]
        for payload in sqli_payloads:
            r_sqli = requests.post(f"{self.base}/api/v1/auth/login",
                                   json={"email": payload, "password": "x"}, timeout=8)
            ok = r_sqli is None or r_sqli.status_code in (400, 401, 403)
            self.assert_ok(f"SQL injection rejected: {payload[:30]}...",
                           ok,
                           f"Got {r_sqli.status_code if r_sqli else 'error'} — injection may have succeeded",
                           severity=Severity.CRITICAL,
                           fix="Use parameterized queries — never string-concatenate SQL")

        # ── XSS in inputs ─────────────────────────────────────────────────
        xss_payload = "<script>alert('xss')</script>"
        r_xss = requests.post(f"{self.base}/api/v1/auth/login",
                              json={"email": xss_payload, "password": "x"}, timeout=8)
        ok_xss = r_xss is None or r_xss.status_code in (400, 401)
        resp_text = r_xss.text if r_xss else ""
        self.assert_ok("XSS payload not reflected unescaped",
                       ok_xss and xss_payload not in resp_text,
                       f"Status {r_xss.status_code if r_xss else 'err'} — XSS may be reflected",
                       severity=Severity.HIGH)

        # ── DB: Verify user roles are consistent ───────────────────────────
        try:
            db = self.config["db"]
            conn = psycopg2.connect(**db)
            cur  = conn.cursor()
            cur.execute("SELECT role, COUNT(*) FROM auth.users GROUP BY role ORDER BY role")
            rows = cur.fetchall()
            conn.close()
            role_summary = {r[0]: r[1] for r in rows}
            self.assert_ok("DB: auth.users has GLOBAL_ADMIN",
                           "GLOBAL_ADMIN" in role_summary,
                           f"No GLOBAL_ADMIN found in DB. Roles: {role_summary}",
                           severity=Severity.CRITICAL)
            self.assert_ok("DB: user roles are valid values",
                           all(r[0] in ("GLOBAL_ADMIN","ISP_ADMIN","CUSTOMER") for r in rows),
                           f"Unknown roles detected: {role_summary}",
                           severity=Severity.HIGH)
        except Exception as e:
            self.assert_ok("DB: role validation", False, str(e), severity=Severity.HIGH)

        return self.results
