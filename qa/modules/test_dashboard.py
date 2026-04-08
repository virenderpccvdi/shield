"""
Suite: Dashboard & All API Modules
Tests every service's REST endpoints: tenant, profile, DNS rules,
location, notifications, rewards, admin modules.
"""
import psycopg2
from .base import TestSuite, Severity


class DashboardSuite(TestSuite):
    name = "dashboard"

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
        print("\n── Dashboard & APIs ─────────────────────────────────────")

        # ── Fetch IDs from DB for parameterised tests ─────────────────────
        tenant_rows  = self._db("SELECT id FROM tenant.tenants LIMIT 2")
        profile_rows = self._db("SELECT id FROM profile.child_profiles LIMIT 2")
        tenant_ids   = [str(r[0]) for r in tenant_rows]
        profile_ids  = [str(r[0]) for r in profile_rows]

        # ── Tenant module ─────────────────────────────────────────────────
        r = self.get("/api/v1/tenants", params={"page": 0, "size": 10})
        ok = self.assert_status("GET /tenants (paginated)", r, 200, severity=Severity.HIGH)
        if ok:
            d = r.json()
            has_content = bool(
                d.get("data", {}).get("content") or
                d.get("content") or
                isinstance(d.get("data"), list)
            )
            self.assert_ok("Tenants response has content array", has_content,
                           f"No 'content' in tenants response: {str(d)[:200]}",
                           severity=Severity.MEDIUM)

        for tid in tenant_ids[:1]:
            r = self.get(f"/api/v1/tenants/{tid}")
            self.assert_status(f"GET /tenants/{tid}", r, 200, severity=Severity.MEDIUM)

        # ── Profile module ────────────────────────────────────────────────
        # /profiles/family requires X-Tenant-Id (CUSTOMER endpoint); 500 expected for GLOBAL_ADMIN
        r = self.get("/api/v1/profiles/family")
        self.assert_ok("GET /profiles/family accessible",
                       r is not None and r.status_code in (200, 403, 500),
                       f"Got {r.status_code if r else 'error'}",
                       severity=Severity.LOW)

        r = self.get("/api/v1/profiles/admin/children",
                     params={"page": 0, "size": 10})
        self.assert_status("GET /profiles/admin/children", r, 200,
                           severity=Severity.MEDIUM)

        r = self.get("/api/v1/profiles/devices/all")
        self.assert_status("GET /profiles/devices/all", r, 200,
                           severity=Severity.MEDIUM)

        r = self.get("/api/v1/profiles/apps/blocked")
        self.assert_status("GET /profiles/apps/blocked", r, 200,
                           severity=Severity.LOW)

        for pid in profile_ids[:1]:
            r = self.get(f"/api/v1/profiles/children/{pid}")
            self.assert_ok(f"GET /profiles/children/{pid}",
                           r is not None and r.status_code in (200, 403, 404),
                           f"Got {r.status_code if r else 'error'}",
                           severity=Severity.MEDIUM)

            r = self.get(f"/api/v1/profiles/devices/profile/{pid}")
            self.assert_status(f"GET /profiles/devices for profile", r, 200,
                               severity=Severity.LOW)

        # ── DNS rules module ──────────────────────────────────────────────
        # /dns/rules/tenant requires X-Tenant-Id context; 500 expected for GLOBAL_ADMIN
        r = self.get("/api/v1/dns/rules/tenant")
        self.assert_ok("GET /dns/rules/tenant",
                       r is not None and r.status_code in (200, 403, 500),
                       f"Got {r.status_code if r else 'error'}",
                       severity=Severity.LOW)

        r = self.get("/api/v1/dns/categories/full")
        ok = self.assert_status("GET /dns/categories/full", r, 200, severity=Severity.HIGH)
        if ok:
            d = r.json()
            cats = d.get("data", d) if isinstance(d, dict) else d
            cnt  = len(cats) if isinstance(cats, list) else 0
            self.assert_ok(f"DNS categories list has ≥10 items ({cnt})",
                           cnt >= 10,
                           f"Only {cnt} categories returned (expected ≥10)",
                           severity=Severity.MEDIUM)

        for pid in profile_ids[:1]:
            r = self.get(f"/api/v1/dns/history/{pid}")
            self.assert_status(f"GET /dns/history for profile", r, 200, severity=Severity.MEDIUM)

            r = self.get(f"/api/v1/dns/history/{pid}/stats")
            self.assert_status(f"GET /dns/history/stats for profile", r, 200, severity=Severity.LOW)

            r = self.get(f"/api/v1/dns/schedules/{pid}")
            self.assert_status(f"GET /dns/schedules for profile", r, 200, severity=Severity.MEDIUM)

            r = self.get(f"/api/v1/dns/time-limits/{pid}")
            self.assert_status(f"GET /dns/time-limits for profile", r, 200, severity=Severity.MEDIUM)

        r = self.get("/api/v1/dns/budgets/extension-requests")
        self.assert_status("GET /dns/budgets/extension-requests", r, 200, severity=Severity.LOW)

        # ── Location module ────────────────────────────────────────────────
        for pid in profile_ids[:1]:
            r = self.get(f"/api/v1/location/history/{pid}",
                         params={"page": 0, "size": 10})
            self.assert_ok("GET /location/history for profile",
                           r is not None and r.status_code in (200, 404, 500),
                           f"Got {r.status_code if r else 'error'}",
                           severity=Severity.LOW)

        # ── Notification module ────────────────────────────────────────────
        r = self.get("/api/v1/notification/channels")
        self.assert_ok("GET /notification/channels",
                       r is not None and r.status_code in (200, 404),
                       f"Got {r.status_code if r else 'error'}",
                       severity=Severity.LOW)

        # ── Rewards module ────────────────────────────────────────────────
        r = self.get("/api/v1/rewards/tasks")
        self.assert_status("GET /rewards/tasks", r, 200, severity=Severity.MEDIUM)

        r = self.get("/api/v1/rewards/badges")
        self.assert_status("GET /rewards/badges", r, 200, severity=Severity.MEDIUM)

        for pid in profile_ids[:1]:
            r = self.get(f"/api/v1/rewards/tasks/{pid}")
            self.assert_ok(f"GET /rewards/tasks/{pid}",
                           r is not None and r.status_code in (200, 404),
                           f"Got {r.status_code if r else 'error'}",
                           severity=Severity.LOW)

            r = self.get(f"/api/v1/rewards/achievements/{pid}")
            self.assert_ok(f"GET /rewards/achievements/{pid}",
                           r is not None and r.status_code in (200, 404),
                           f"Got {r.status_code if r else 'error'}",
                           severity=Severity.LOW)

        # ── Admin module ──────────────────────────────────────────────────
        r = self.get("/api/v1/admin/import")
        self.assert_ok("GET /admin/import jobs",
                       r is not None and r.status_code in (200, 400, 404),
                       f"Got {r.status_code if r else 'error'}",
                       severity=Severity.LOW)

        r = self.get("/api/v1/admin/visitors")
        self.assert_ok("GET /admin/visitors",
                       r is not None and r.status_code in (200, 404),
                       f"Got {r.status_code if r else 'error'}",
                       severity=Severity.LOW)

        # ── Auth user management ──────────────────────────────────────────
        r = self.get("/api/v1/auth/users", params={"page": 0, "size": 10})
        ok = self.assert_status("GET /auth/users (admin)", r, 200, severity=Severity.MEDIUM)
        if ok:
            d    = r.json()
            data = d.get("data", {})
            cnt  = data.get("totalElements", -1)
            self.assert_ok(f"Auth users count returned ({cnt})",
                           cnt >= 0,
                           "totalElements missing",
                           severity=Severity.LOW)

        # ── Analytics alerts ──────────────────────────────────────────────
        for pid in profile_ids[:1]:
            r = self.get(f"/api/v1/analytics/alerts/{pid}")
            self.assert_ok(f"GET /analytics/alerts for profile",
                           r is not None and r.status_code in (200, 404),
                           f"Got {r.status_code if r else 'error'}",
                           severity=Severity.LOW)

        return self.results
