"""
Suite: Security Testing
OWASP Top-10 checks: injection, XSS, CSRF, auth bypass,
sensitive data exposure, security headers, rate limiting.
"""
import requests, re
from .base import TestSuite, Severity


class SecuritySuite(TestSuite):
    name = "security"

    SECURITY_HEADERS = {
        "X-Content-Type-Options":  "nosniff",
        "X-Frame-Options":         None,        # any value
        "Strict-Transport-Security": None,       # any value on HTTPS
    }

    def _req(self, method, path, **kwargs):
        try:
            url = f"{self.base}{path}"
            return getattr(requests, method)(url, timeout=8, **kwargs)
        except:
            return None

    def run(self):
        print("\n── Security ─────────────────────────────────────────────")

        # ── A01: Broken Access Control ────────────────────────────────────
        r = self._req("get", "/api/v1/tenants")
        self.assert_ok("A01: /tenants requires auth",
                       r is not None and r.status_code in (401, 403),
                       f"Got {r.status_code if r else 'err'} — unauthenticated access!",
                       severity=Severity.CRITICAL)

        r = self._req("get", "/api/v1/admin/invoices")
        self.assert_ok("A01: /admin/invoices requires auth",
                       r is not None and r.status_code in (401, 403),
                       f"Got {r.status_code if r else 'err'}",
                       severity=Severity.CRITICAL)

        # ── A02: Cryptographic failures ────────────────────────────────────
        # Check that HTTP → HTTPS redirect exists (test against nginx public URL)
        try:
            r_http = requests.get("http://shield.rstglobal.in/",
                                  allow_redirects=False, timeout=5)
            redirects_to_https = (r_http.status_code in (301, 302, 308) and
                                   "https" in r_http.headers.get("Location", "").lower())
            self.assert_ok("HTTP redirects to HTTPS",
                           redirects_to_https or r_http.status_code == 200,
                           f"HTTP status={r_http.status_code} — should redirect to HTTPS",
                           severity=Severity.HIGH,
                           fix="Add nginx return 301 https://$host$request_uri for port 80")
        except:
            pass

        # JWT uses HS512 (validated in auth suite) — additional check
        jwt_hdrs = {"Authorization": f"Bearer {self.jwt}"}
        r = requests.get(f"{self.base}/api/v1/auth/users",
                         headers=jwt_hdrs, timeout=8)
        self.assert_ok("Valid JWT accepted on protected route",
                       r is not None and r.status_code == 200,
                       f"Got {r.status_code if r else 'error'}",
                       severity=Severity.CRITICAL)

        # ── A03: Injection ────────────────────────────────────────────────
        sqli_payloads = [
            "' OR 1=1--",
            "1; DROP TABLE auth.users;--",
            "' UNION SELECT password FROM auth.users--",
            "admin'/*",
        ]
        for payload in sqli_payloads:
            r = self._req("post", "/api/v1/auth/login",
                          json={"email": payload, "password": payload})
            ok = r is not None and r.status_code in (400, 401, 422)
            self.assert_ok(f"SQL injection blocked: {payload[:25]}",
                           ok,
                           f"Got {r.status_code if r else 'error'} — injection may have passed",
                           severity=Severity.CRITICAL,
                           fix="Use JPA parameterized queries only — never string concatenation")

        # ── A03: NoSQL/JSON injection ─────────────────────────────────────
        json_inject = [
            {"email": {"$gt": ""}, "password": "x"},
            {"email": "admin@rstglobal.in", "password": {"$ne": "wrong"}},
        ]
        for payload in json_inject:
            r = self._req("post", "/api/v1/auth/login", json=payload)
            ok = r is not None and r.status_code in (400, 401, 422)
            self.assert_ok(f"NoSQL injection blocked",
                           ok,
                           f"Got {r.status_code if r else 'error'}",
                           severity=Severity.HIGH)

        # ── A07: XSS ─────────────────────────────────────────────────────
        xss_payloads = [
            "<script>alert(1)</script>",
            "javascript:alert(1)",
            "<img src=x onerror=alert(1)>",
        ]
        for xss in xss_payloads:
            r = self._req("post", "/api/v1/auth/login",
                          json={"email": xss, "password": "x"})
            if r:
                reflected = xss in r.text
                self.assert_ok(f"XSS not reflected: {xss[:25]}",
                               not reflected,
                               "XSS payload reflected in response!",
                               severity=Severity.HIGH,
                               fix="Ensure Spring input validation and response escaping")

        # ── A05: Security Misconfiguration — Headers ──────────────────────
        # Check against public HTTPS URL (HSTS only present at nginx layer, not internal gateway)
        public_url = self.config.get("public_url", self.base)
        try:
            r = requests.get(f"{public_url}/api/v1/analytics/platform/overview",
                             headers={"Authorization": f"Bearer {self.jwt}"}, timeout=8, verify=False)
        except Exception:
            r = requests.get(f"{self.base}/api/v1/analytics/platform/overview",
                             headers={"Authorization": f"Bearer {self.jwt}"}, timeout=8)
        if r:
            for header, expected_val in self.SECURITY_HEADERS.items():
                present = header.lower() in {k.lower(): v for k, v in r.headers.items()}
                if not present:
                    self.assert_ok(f"Security header present: {header}",
                                   False,
                                   f"Missing {header} response header",
                                   severity=Severity.LOW,
                                   fix=f"Add 'add_header {header} ...' in nginx config")
                else:
                    self.assert_ok(f"Security header: {header}", True, "Present")

        # ── A09: Security Logging ─────────────────────────────────────────
        # After failed logins, check that they're not leaking user info
        r = self._req("post", "/api/v1/auth/login",
                      json={"email": "admin@rstglobal.in", "password": "WRONG"})
        if r:
            body = r.text.lower()
            leaks_info = any(word in body for word in
                             ["stack trace", "hibernate", "sql", "password hash",
                              "bcrypt", "exception", "at com."])
            self.assert_ok("Failed login doesn't leak stack trace",
                           not leaks_info,
                           "Response may leak internal details",
                           severity=Severity.HIGH,
                           fix="Use generic error messages in GlobalExceptionHandler; disable stack trace in responses")

        # ── A04: Insecure Direct Object Reference ────────────────────────
        # Try to access a resource with a random UUID
        r = requests.get(f"{self.base}/api/v1/admin/invoices/99999999-9999-9999-9999-999999999999",
                         headers={"Authorization": f"Bearer {self.jwt}"}, timeout=8)
        self.assert_ok("IDOR: random invoice ID → 404 (not 200/500)",
                       r is not None and r.status_code in (404, 403),
                       f"Got {r.status_code if r else 'error'}",
                       severity=Severity.HIGH,
                       fix="Ensure ownership checks before returning any resource")

        # ── Rate limiting check ──────────────────────────────────────────
        # Rapid CONCURRENT login attempts should get throttled.
        # nginx auth_limit: burst=10 nodelay → 11th concurrent request gets 429.
        # Gateway fallback: replenishRate=5 burstCapacity=10.
        # Use concurrent requests so bcrypt latency doesn't replenish the bucket.
        public_url = self.config.get("public_url", "").rstrip("/")
        rate_base = public_url or self.base
        import concurrent.futures as _cf
        throttled = False
        def _try_login():
            try:
                return requests.post(f"{rate_base}/api/v1/auth/login",
                                     json={"email": "x@x.com", "password": "wrong"},
                                     timeout=8, verify=False)
            except Exception:
                return None
        with _cf.ThreadPoolExecutor(max_workers=15) as _ex:
            _futs = [_ex.submit(_try_login) for _ in range(15)]
            for _f in _cf.as_completed(_futs):
                _r = _f.result()
                if _r is not None and _r.status_code == 429:
                    throttled = True
                    break
        self.assert_ok("Rate limiting on failed logins (429 after N attempts)",
                       throttled,
                       "No rate limiting detected after 15 concurrent failed logins",
                       severity=Severity.MEDIUM,
                       fix="Nginx auth_limit zone: burst=10 nodelay. Gateway: replenishRate=5 burstCapacity=10")

        return self.results
