"""
Suite: Extended OWASP Security Testing
Covers gaps beyond test_security.py:
  - JWT alg:none attack
  - CORS misconfiguration
  - Content-Security-Policy header
  - Mass assignment via registration
  - Open redirect
  - Token replay (invite/reset)
  - HTTP method override
  - Host header injection
  - Path traversal on file-serving endpoints
  - Clickjacking (X-Frame-Options)
"""
import base64, json, requests, time
from .base import TestSuite, Severity


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


class OwaspExtendedSuite(TestSuite):
    name = "owasp_extended"

    def _req(self, method, path, **kwargs):
        try:
            url = f"{self.base}{path}"
            return getattr(requests, method)(url, timeout=8, **kwargs)
        except Exception:
            return None

    def run(self):
        print("\n── OWASP Extended ───────────────────────────────────────")

        # ── JWT alg:none attack ────────────────────────────────────────────
        # Forge a token with alg:none — should be rejected by all protected routes
        header  = _b64url(json.dumps({"alg": "none", "typ": "JWT"}).encode())
        payload = _b64url(json.dumps({
            "sub": "00000000-0000-0000-0000-000000000001",
            "email": "hacker@evil.com",
            "role": "GLOBAL_ADMIN",
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        }).encode())
        alg_none_token = f"{header}.{payload}."   # empty signature

        r = self._req("get", "/api/v1/tenants",
                      headers={"Authorization": f"Bearer {alg_none_token}"})
        self.assert_ok("JWT alg:none attack rejected",
                       r is not None and r.status_code in (401, 403),
                       f"Got {r.status_code if r else 'error'} — alg:none accepted!",
                       severity=Severity.CRITICAL,
                       fix="Ensure JJWT is configured with explicit allowed algorithms: JwtParserBuilder.requireSignedWith(...)")

        # ── JWT empty signature attack ────────────────────────────────────
        # Valid header/payload but truncated signature (just dots)
        # Use a real token's header/payload but strip the signature
        if self.jwt:
            parts = self.jwt.split(".")
            if len(parts) == 3:
                stripped = f"{parts[0]}.{parts[1]}."
                r = self._req("get", "/api/v1/tenants",
                              headers={"Authorization": f"Bearer {stripped}"})
                self.assert_ok("JWT stripped signature rejected",
                               r is not None and r.status_code in (401, 403),
                               f"Got {r.status_code if r else 'error'} — stripped sig accepted!",
                               severity=Severity.CRITICAL,
                               fix="JWT parser must require a valid non-empty signature")

        # ── CORS — no wildcard on authenticated endpoints ─────────────────
        r = self._req("get", "/api/v1/tenants",
                      headers={
                          "Authorization": f"Bearer {self.jwt}",
                          "Origin": "https://evil.com"
                      })
        if r:
            acao = r.headers.get("Access-Control-Allow-Origin", "")
            self.assert_ok("CORS: no wildcard on authenticated endpoint",
                           acao != "*",
                           f"Access-Control-Allow-Origin: * on authenticated endpoint!",
                           severity=Severity.HIGH,
                           fix="Configure CORS to only allow shield.rstglobal.in origin, not *")
            self.assert_ok("CORS: evil.com not reflected in ACAO",
                           "evil.com" not in acao,
                           f"Origin reflection detected: {acao}",
                           severity=Severity.HIGH,
                           fix="Use strict allowedOrigins list in Spring Security CORS config")

        # ── CORS OPTIONS preflight ─────────────────────────────────────────
        r = self._req("options", "/api/v1/auth/login",
                      headers={"Origin": "https://evil.com",
                               "Access-Control-Request-Method": "POST"})
        if r:
            acao = r.headers.get("Access-Control-Allow-Origin", "")
            self.assert_ok("CORS preflight: evil.com not allowed",
                           "evil.com" not in acao and acao != "*",
                           f"Preflight allows evil.com: {acao}",
                           severity=Severity.HIGH)

        # ── Content-Security-Policy ────────────────────────────────────────
        try:
            public = self.config.get("public_url", self.base)
            r = requests.get(f"{public}/app/", timeout=8, verify=False)
            if r:
                csp = r.headers.get("Content-Security-Policy", "")
                self.assert_ok("CSP header present on app/",
                               bool(csp),
                               "Missing Content-Security-Policy on React app",
                               severity=Severity.MEDIUM,
                               fix="Add CSP header in nginx: add_header Content-Security-Policy \"default-src 'self';...\"")
                if csp:
                    # Check script-src specifically — style-src 'unsafe-inline' is acceptable
                    # for CSS-in-JS (MUI/emotion). The risk is script injection only.
                    import re as _re
                    script_src = _re.search(r"script-src([^;]*)", csp, _re.IGNORECASE)
                    script_src_val = script_src.group(1) if script_src else ""
                    self.assert_ok("CSP: no unsafe-inline in script-src",
                                   "'unsafe-inline'" not in script_src_val,
                                   f"script-src contains unsafe-inline: {script_src_val[:80]}",
                                   severity=Severity.MEDIUM,
                                   fix="Remove 'unsafe-inline' from script-src; use nonces for any required inline scripts")
        except Exception:
            pass

        # ── X-Frame-Options / Clickjacking ────────────────────────────────
        try:
            r = requests.get(f"{self.config.get('public_url', self.base)}/app/",
                             timeout=8, verify=False)
            if r:
                xfo = r.headers.get("X-Frame-Options", "")
                csp_frame = r.headers.get("Content-Security-Policy", "")
                has_frame_protection = bool(xfo) or "frame-ancestors" in csp_frame.lower()
                self.assert_ok("Clickjacking protection (X-Frame-Options or CSP frame-ancestors)",
                               has_frame_protection,
                               "No X-Frame-Options or CSP frame-ancestors directive",
                               severity=Severity.MEDIUM,
                               fix="Add: add_header X-Frame-Options DENY in nginx config")
        except Exception:
            pass

        # ── Mass assignment — role escalation via registration ────────────
        r = self._req("post", "/api/v1/auth/register", json={
            "email": f"massassign_{int(time.time())}@evil.com",
            "password": "Test@1234!",
            "firstName": "Evil",
            "lastName": "Hacker",
            "role": "GLOBAL_ADMIN",       # extra field — should be ignored
            "isActive": True,
            "id": "00000000-0000-0000-0000-000000000001",
        })
        if r is not None and r.status_code in (200, 201):
            # If registered successfully, verify the role was NOT elevated
            try:
                body = r.json()
                assigned_role = (body.get("data", {}) or {}).get("role", "")
                self.assert_ok("Mass assignment: role not escalated via register",
                               assigned_role not in ("GLOBAL_ADMIN", "ISP_ADMIN"),
                               f"Registration returned role={assigned_role}!",
                               severity=Severity.CRITICAL,
                               fix="RegisterRequest DTO must NOT include role field; assign CUSTOMER by default in AuthService")
            except Exception:
                pass
        elif r is not None and r.status_code in (400, 409, 422):
            self.assert_ok("Mass assignment: extra fields rejected cleanly", True,
                           "Registration rejected extra fields", severity=Severity.INFO)

        # ── Open redirect ─────────────────────────────────────────────────
        redirect_payloads = [
            "?redirect=https://evil.com",
            "?next=//evil.com",
            "?returnUrl=https://evil.com/steal",
        ]
        for payload in redirect_payloads:
            r = self._req("get", f"/api/v1/auth/logout{payload}",
                          allow_redirects=False)
            if r is not None and r.status_code in (301, 302, 307, 308):
                location = r.headers.get("Location", "")
                self.assert_ok(f"Open redirect blocked: {payload[:30]}",
                               "evil.com" not in location,
                               f"Redirect to evil.com detected: {location}",
                               severity=Severity.HIGH,
                               fix="Validate redirect URLs against allowed domain whitelist before issuing 30x redirect")

        # ── HTTP method override ──────────────────────────────────────────
        # Some APIs check for X-HTTP-Method-Override to tunnel DELETE through POST
        r = self._req("post", "/api/v1/tenants",
                      headers={
                          "Authorization": f"Bearer {self.jwt}",
                          "X-HTTP-Method-Override": "DELETE",
                          "Content-Type": "application/json"
                      }, json={})
        if r:
            self.assert_ok("HTTP method override rejected or not honored",
                           r.status_code not in (200, 204),   # should be 400/404/405
                           f"X-HTTP-Method-Override:DELETE got {r.status_code} on POST /tenants",
                           severity=Severity.MEDIUM,
                           fix="Spring does not enable method override by default — verify HiddenHttpMethodFilter is disabled")

        # ── Host header injection ─────────────────────────────────────────
        r = self._req("post", "/api/v1/auth/login",
                      headers={"Host": "evil.com", "Content-Type": "application/json"},
                      json={"email": "x@x.com", "password": "wrong"})
        if r:
            body = r.text.lower()
            self.assert_ok("Host header not reflected in response",
                           "evil.com" not in body,
                           "Host header value reflected in response body!",
                           severity=Severity.MEDIUM,
                           fix="Never reflect Host header in response links; use configured base URL")

        # ── Path traversal on static endpoints ────────────────────────────
        traversal_paths = [
            "/api/v1/analytics/../../../etc/passwd",
            "/api/v1/dns/..%2F..%2Fetc%2Fpasswd",
        ]
        for path in traversal_paths:
            r = self._req("get", path,
                          headers={"Authorization": f"Bearer {self.jwt}"})
            if r:
                self.assert_ok(f"Path traversal blocked: {path[:40]}",
                               r.status_code in (400, 403, 404),
                               f"Got {r.status_code} — possible traversal",
                               severity=Severity.HIGH,
                               fix="Ensure Spring Security path normalization is enabled (no raw path matching)")

        # ── Sensitive endpoint enumeration (via public HTTPS URL) ─────────
        # Test against the public URL — these should be blocked at nginx level
        public = self.config.get("public_url", self.base)
        sensitive_paths = [
            "/actuator",
            "/actuator/env",
            "/actuator/beans",
            "/h2-console",
            "/swagger-ui.html",
        ]
        SENSITIVE_KEYWORDS = {
            "/actuator":       ["_links", "prometheus", "gateway"],
            "/actuator/env":   ["activeProfiles", "propertySources"],
            "/actuator/beans": ["applicationContext"],
            "/h2-console":     ["H2 Console", "h2-console", "Login H2"],
            "/swagger-ui.html":["swagger-ui", "SwaggerUI", "Swagger UI"],
        }
        for path in sensitive_paths:
            try:
                r = requests.get(f"{public}{path}", timeout=8, verify=False)
                status_ok = r is not None and r.status_code == 200
                # A 200 is only dangerous if it actually serves the sensitive content
                if status_ok:
                    keywords = SENSITIVE_KEYWORDS.get(path, [])
                    actually_exposed = any(kw in r.text for kw in keywords)
                else:
                    actually_exposed = False
            except Exception:
                actually_exposed = False
            self.assert_ok(f"Sensitive path not publicly accessible: {path}",
                           not actually_exposed,
                           f"{path} is publicly accessible without auth and exposes sensitive content!",
                           severity=Severity.HIGH,
                           fix=f"Block {path} in nginx: add 'location {path} {{ return 403; }}'  (before other location blocks)")

        # ── Verbose error on 500 ──────────────────────────────────────────
        r = self._req("get", "/api/v1/tenants/invalid-uuid-format",
                      headers={"Authorization": f"Bearer {self.jwt}"})
        if r is not None and r.status_code in (400, 404, 500):
            body = r.text.lower()
            leaks = any(s in body for s in
                        ["stack trace", "at com.", "hibernate", ".java:", "caused by"])
            self.assert_ok("No stack trace in error responses",
                           not leaks,
                           "Stack trace or Java internals leaked in error response",
                           severity=Severity.HIGH,
                           fix="GlobalExceptionHandler must catch all exceptions and return generic messages in production")

        # ── Timing attack on auth ─────────────────────────────────────────
        # Valid user with wrong password vs non-existent user — timing should be similar
        import time as _time
        t0 = _time.time()
        for _ in range(3):
            self._req("post", "/api/v1/auth/login",
                      json={"email": "admin@rstglobal.in", "password": "WRONGPASS"})
        valid_user_time = (_time.time() - t0) / 3

        t1 = _time.time()
        for _ in range(3):
            self._req("post", "/api/v1/auth/login",
                      json={"email": "nonexistent999@evil.com", "password": "WRONGPASS"})
        invalid_user_time = (_time.time() - t1) / 3

        # If timing differs by more than 200ms, it's a potential user enumeration vector
        timing_diff_ms = abs(valid_user_time - invalid_user_time) * 1000
        self.assert_ok(f"Auth timing consistent (diff={timing_diff_ms:.0f}ms)",
                       timing_diff_ms < 300,
                       f"Auth timing differs by {timing_diff_ms:.0f}ms — possible user enumeration",
                       severity=Severity.LOW,
                       fix="Use constant-time comparison; always run bcrypt.check() even for non-existent users")

        return self.results
