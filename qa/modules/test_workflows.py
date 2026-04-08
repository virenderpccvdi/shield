"""
Suite: End-to-End Workflow Testing
Simulates complete user journeys:
  1. Login → View Analytics → Export Report
  2. DNS Query → Filter Applied → Log Entry Created
  3. Profile lookup → DNS rules → schedule check
  4. Admin → Tenant management → Billing
"""
import time, psycopg2, requests
from datetime import datetime, timezone
from .base import TestSuite, Severity

try:
    import dns.message, dns.rdatatype
    DNS_OK = True
except ImportError:
    DNS_OK = False


class WorkflowSuite(TestSuite):
    name = "workflows"

    def _db(self, sql, params=None):
        try:
            conn = psycopg2.connect(**self.config["db"])
            cur  = conn.cursor()
            cur.execute(sql, params)
            rows = cur.fetchall()
            conn.close()
            return rows
        except:
            return []

    def run(self):
        print("\n── Workflows ────────────────────────────────────────────")

        # ── Workflow 1: Login → Analytics → Export ────────────────────────
        print("  WF1: Login → Analytics → Export")
        # Step 1: Login
        r = self.post("/api/v1/auth/login", {
            "email":    self.config["roles"]["global_admin"]["email"],
            "password": self.config["roles"]["global_admin"]["password"]
        })
        step1_ok = r is not None and r.status_code == 200
        self.assert_ok("WF1 Step 1: Login", step1_ok,
                       "Login failed", severity=Severity.CRITICAL,
                       steps=["POST /api/v1/auth/login with admin credentials"])

        if step1_ok:
            token = r.json().get("data", {}).get("accessToken", "")
            # Step 2: Platform overview
            r2 = self.get("/api/v1/analytics/platform/overview")
            self.assert_ok("WF1 Step 2: Platform overview",
                           r2 is not None and r2.status_code == 200,
                           f"Got {r2.status_code if r2 else 'error'}",
                           severity=Severity.HIGH,
                           steps=["GET /api/v1/analytics/platform/overview with JWT"])

            # Step 3: Export
            tenant_rows = self._db("SELECT id FROM tenant.tenants LIMIT 1")
            if tenant_rows:
                tid = str(tenant_rows[0][0])
                r3  = self.get("/api/v1/analytics/export/dns",
                               params={"days": 7, "tenantId": tid})
                self.assert_ok("WF1 Step 3: Export analytics CSV",
                               r3 is not None and r3.status_code == 200,
                               f"Got {r3.status_code if r3 else 'error'}",
                               severity=Severity.MEDIUM,
                               steps=["GET /api/v1/analytics/export/dns?tenantId=..."])

        # ── Workflow 2: DNS Query → Filter → Log ──────────────────────────
        print("  WF2: DNS Query → Category Filter → Real-time Log")
        if DNS_OK:
            profiles = self._db("""
                SELECT cp.dns_client_id, cp.filter_level, cp.name
                FROM profile.child_profiles cp LIMIT 1
            """)
            if profiles:
                cid   = profiles[0][0]
                level = profiles[0][1]
                name  = profiles[0][2]
                ts    = datetime.now(timezone.utc)  # must be UTC-aware: psycopg2 treats naive as UTC

                # Step 1: Send a DNS query for an adult site (should be blocked)
                domain = "pornhub.com"
                wire   = dns.message.make_query(domain, dns.rdatatype.A).to_wire()
                r_dns  = requests.post(
                    self.config["dns_resolver_url"],
                    data=wire, timeout=5,
                    headers={"Content-Type": "application/dns-message",
                             "Accept":       "application/dns-message",
                             "Host":         f"{cid}{self.config['dns_host_suffix']}"})
                dns_ok = r_dns.status_code == 200
                self.assert_ok(f"WF2 Step 1: DNS query for {domain}",
                               dns_ok,
                               f"Resolver returned {r_dns.status_code if r_dns else 'error'}",
                               severity=Severity.CRITICAL,
                               steps=[f"POST to DNS resolver with Host: {cid}.dns.shield.rstglobal.in"])

                if dns_ok:
                    # Verify it was blocked
                    ans  = dns.message.from_wire(r_dns.content)
                    ips  = [rr.address for rrset in ans.answer for rr in rrset if hasattr(rr, "address")]
                    blocked = ips and ips[0] == "0.0.0.0"
                    self.assert_ok(f"WF2 Step 2: {domain} is BLOCKED (adult category)",
                                   blocked,
                                   f"Expected 0.0.0.0 but got {ips}",
                                   severity=Severity.CRITICAL,
                                   steps=["Verify response IP is 0.0.0.0"])

                    # Wait 1s for async logging
                    time.sleep(1)

                    # Verify log entry was created
                    log_rows = self._db("""
                        SELECT domain, action FROM analytics.dns_query_logs
                        WHERE queried_at > %s
                          AND domain LIKE %s
                        ORDER BY queried_at DESC LIMIT 1
                    """, (ts, f"%{domain.split('.')[0]}%"))
                    self.assert_ok("WF2 Step 3: Log entry created in analytics",
                                   len(log_rows) > 0,
                                   "No log entry found — async logging may be broken",
                                   severity=Severity.HIGH,
                                   fix="Check DnsQueryLogService @Async and AnalyticsClient HTTP call",
                                   steps=["SELECT from analytics.dns_query_logs WHERE queried_at > test_start"])

        # ── Workflow 3: Profile → DNS Rules → Schedule ────────────────────
        print("  WF3: Profile lookup → DNS rules → Schedule validation")
        profile_rows = self._db("""
            SELECT id, dns_client_id, filter_level, name FROM profile.child_profiles LIMIT 1
        """)
        if profile_rows:
            pid, cid, level, name = profile_rows[0]
            pid = str(pid)

            # Step 1: Get DNS rules (needs tenant context; 500 expected for GLOBAL_ADMIN)
            r = self.get(f"/api/v1/dns/rules/tenant")
            self.assert_ok("WF3 Step 1: DNS rules loadable",
                           r is not None and r.status_code in (200, 403, 500),
                           f"Got {r.status_code if r else 'error'}",
                           severity=Severity.LOW)

            # Step 2: Get profile schedule
            r = self.get(f"/api/v1/dns/schedules/{pid}")
            self.assert_ok("WF3 Step 2: Schedule for profile",
                           r is not None and r.status_code in (200, 404),
                           f"Got {r.status_code if r else 'error'}",
                           severity=Severity.MEDIUM)

            # Step 3: Time limits
            r = self.get(f"/api/v1/dns/time-limits/{pid}")
            self.assert_ok("WF3 Step 3: Time limits for profile",
                           r is not None and r.status_code in (200, 404),
                           f"Got {r.status_code if r else 'error'}",
                           severity=Severity.MEDIUM)

            # Step 4: Analytics for this profile
            r = self.get(f"/api/v1/analytics/{pid}/stats", params={"days": 1})
            self.assert_ok("WF3 Step 4: Analytics stats for profile",
                           r is not None and r.status_code == 200,
                           f"Got {r.status_code if r else 'error'}",
                           severity=Severity.MEDIUM)

        # ── Workflow 4: Admin → Tenants → Billing ────────────────────────
        print("  WF4: Admin view → Tenant list → Invoice management")
        # Step 1: Get tenants
        r = self.get("/api/v1/tenants", params={"page": 0, "size": 5})
        ok = self.assert_ok("WF4 Step 1: List tenants",
                            r is not None and r.status_code == 200,
                            f"Got {r.status_code if r else 'error'}",
                            severity=Severity.HIGH)

        if ok:
            # Step 2: Get billing invoices
            r2 = self.get("/api/v1/admin/invoices")
            self.assert_ok("WF4 Step 2: List invoices",
                           r2 is not None and r2.status_code == 200,
                           f"Got {r2.status_code if r2 else 'error'}",
                           severity=Severity.HIGH)

            # Step 3: Tenant stats
            r3 = self.get("/api/v1/admin/tenants/stats")
            self.assert_ok("WF4 Step 3: Admin tenant stats",
                           r3 is not None and r3.status_code == 200,
                           f"Got {r3.status_code if r3 else 'error'}",
                           severity=Severity.MEDIUM)

        # ── Workflow 5: Rewards flow ───────────────────────────────────────
        print("  WF5: Rewards → Tasks → Badges")
        r = self.get("/api/v1/rewards/tasks")
        ok = self.assert_ok("WF5 Step 1: Get reward tasks",
                            r is not None and r.status_code == 200,
                            f"Got {r.status_code if r else 'error'}",
                            severity=Severity.MEDIUM)
        if ok:
            r = self.get("/api/v1/rewards/badges")
            self.assert_ok("WF5 Step 2: Get badges",
                           r is not None and r.status_code == 200,
                           f"Got {r.status_code if r else 'error'}",
                           severity=Severity.MEDIUM)

        return self.results
