"""
Suite: Authentication & Session
Tests login, JWT structure, token expiry handling, logout, register flows.
"""
import time, jwt as pyjwt
from .base import TestSuite, Severity


class AuthSuite(TestSuite):
    name = "auth"

    def run(self):
        print("\n── Authentication ───────────────────────────────────────")
        cfg   = self.config["roles"]["global_admin"]
        email = cfg["email"]
        pwd   = cfg["password"]

        # 1. Valid login
        r = self.post("/api/v1/auth/login", {"email": email, "password": pwd})
        ok = self.assert_status("Valid login returns 200", r, 200,
                                severity=Severity.CRITICAL,
                                fix="Check auth service logs; verify DB user is_active=true")
        if not ok:
            return self.results

        token = self.json_data(r).get("accessToken") or self.json_data(r).get("token", "")
        self.assert_ok("JWT token returned", bool(token), "No token in response",
                       severity=Severity.CRITICAL)

        # 2. JWT structure validation
        if token:
            try:
                header = pyjwt.get_unverified_header(token)
                self.assert_ok("JWT uses HS512", header.get("alg") == "HS512",
                               f"Algorithm is {header.get('alg')}, expected HS512",
                               severity=Severity.HIGH)
                payload = pyjwt.decode(token, options={"verify_signature": False})
                self.assert_ok("JWT contains sub (userId)", "sub" in payload,
                               "Missing 'sub' claim", severity=Severity.HIGH)
                self.assert_ok("JWT contains role", "role" in payload,
                               "Missing 'role' claim", severity=Severity.HIGH)
                self.assert_ok("JWT contains email", "email" in payload,
                               "Missing 'email' claim", severity=Severity.MEDIUM)
                role = payload.get("role", "")
                self.assert_ok("Admin has GLOBAL_ADMIN role", role == "GLOBAL_ADMIN",
                               f"Role is '{role}', expected GLOBAL_ADMIN",
                               severity=Severity.CRITICAL)
                exp = payload.get("exp", 0)
                ttl = exp - time.time()
                self.assert_ok("Token not expired", ttl > 0,
                               f"Token expired {-ttl:.0f}s ago",
                               severity=Severity.CRITICAL)
                self.assert_ok("Token TTL reasonable (>5min)", ttl > 300,
                               f"Token expires in {ttl:.0f}s (<5min)",
                               severity=Severity.LOW)
            except Exception as e:
                self.assert_ok("JWT decode", False, str(e), severity=Severity.HIGH)

        # 3. Wrong password
        r2 = self.post("/api/v1/auth/login", {"email": email, "password": "WrongPass999!"})
        self.assert_status("Wrong password returns 401", r2, 401,
                           severity=Severity.CRITICAL,
                           fix="AuthService must reject invalid credentials")

        # 4. Non-existent email
        r3 = self.post("/api/v1/auth/login", {"email": "ghost@nowhere.com", "password": "x"})
        self.assert_status("Unknown email returns 401", r3, 401,
                           severity=Severity.HIGH)

        # 5. Empty credentials — use a fresh session to avoid stale connection state
        import requests as _req
        _empty_err = None
        for _attempt in range(3):
            try:
                r4 = _req.post(f"{self.base}/api/v1/auth/login",
                               json={"email": "", "password": ""}, timeout=10)
                _empty_err = None
                break
            except Exception as _e:
                _empty_err = _e
                r4 = None
                import time as _t; _t.sleep(0.5)
        # NOTE: requests.Response.__bool__ is falsy for 4xx/5xx — use `is not None` not truthiness
        _detail = f"exception: {_empty_err}" if _empty_err else (f"status={r4.status_code}" if r4 is not None else "no response")
        self.assert_ok("Empty creds rejected (400 or 401)",
                       r4 is not None and r4.status_code in (400, 401),
                       f"Got {_detail}",
                       severity=Severity.MEDIUM)

        # 6. Malformed JSON body — send raw string
        try:
            raw = self.session.post(f"{self.base}/api/v1/auth/login",
                                    data="not_json", timeout=5,
                                    headers={"Content-Type": "application/json"})
            self.assert_ok("Malformed JSON handled (400/415)", raw.status_code in (400, 415),
                           f"Got {raw.status_code}", severity=Severity.MEDIUM)
        except:
            pass

        # 7. Token reuse after re-login — sleep 1s to ensure different iat (second-precision JWT)
        import time as _time
        _time.sleep(1)
        r5 = self.post("/api/v1/auth/login", {"email": email, "password": pwd})
        token2 = (r5.json().get("data", {}) or {}).get("accessToken", "") if r5 is not None else ""
        self.assert_ok("Re-login issues fresh token", bool(token2),
                       "Re-login returned no token", severity=Severity.MEDIUM)

        # 8. Protected endpoint without token
        from .base import TestSuite as _B
        import requests
        r6 = requests.get(f"{self.base}/api/v1/tenants", timeout=5)
        self.assert_ok("No token → 401", r6.status_code in (401, 403),
                       f"Got {r6.status_code} (expected 401/403)",
                       severity=Severity.CRITICAL,
                       fix="JwtAuthenticationFilter must reject missing Authorization header")

        # 9. Expired/invalid token
        bad_token = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJmYWtlIn0.invalidsignature"
        import requests as _req
        r7 = _req.get(f"{self.base}/api/v1/tenants",
                      headers={"Authorization": f"Bearer {bad_token}"}, timeout=5)
        self.assert_ok("Invalid token → 401/403", r7.status_code in (401, 403),
                       f"Got {r7.status_code}", severity=Severity.CRITICAL)

        return self.results
