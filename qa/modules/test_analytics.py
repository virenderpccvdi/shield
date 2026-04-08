"""
Suite: Analytics & Reporting
Validates analytics endpoints, data accuracy vs DB, charts data,
category breakdowns, top domains, PDF/CSV export.
"""
import psycopg2
from .base import TestSuite, Severity


class AnalyticsSuite(TestSuite):
    name = "analytics"

    def _profiles(self):
        try:
            conn = psycopg2.connect(**self.config["db"])
            cur  = conn.cursor()
            cur.execute("SELECT id, name FROM profile.child_profiles LIMIT 3")
            rows = cur.fetchall()
            conn.close()
            return [{"id": str(r[0]), "name": r[1]} for r in rows]
        except:
            return []

    def _db_count(self, sql, params=None):
        try:
            conn = psycopg2.connect(**self.config["db"])
            cur  = conn.cursor()
            cur.execute(sql, params)
            val  = cur.fetchone()[0]
            conn.close()
            return val
        except:
            return -1

    def run(self):
        print("\n── Analytics ────────────────────────────────────────────")
        profiles = self._profiles()
        self.assert_ok("Profiles available for analytics tests", len(profiles) > 0,
                       "No profiles in DB", severity=Severity.HIGH)

        # ── Platform overview ─────────────────────────────────────────────
        r = self.get("/api/v1/analytics/platform/overview")
        ok = self.assert_status("GET /analytics/platform/overview", r, 200,
                                severity=Severity.HIGH)
        if ok:
            d   = r.json()
            has = any(v for k, v in d.items() if isinstance(v, (int, float)) and v > 0
                      and k not in ("success",))
            # Also check raw if data is nested
            if not has and isinstance(d, dict):
                has = d.get("totalQueries", 0) > 0 or d.get("blockedQueries", 0) > 0

            db_total = self._db_count(
                "SELECT COUNT(*) FROM analytics.dns_query_logs WHERE queried_at > NOW()-INTERVAL '24h'")
            self.assert_ok("Platform overview has real data",
                           has or db_total == 0,
                           f"Overview returned zeros but DB has {db_total} recent entries",
                           severity=Severity.MEDIUM,
                           detail=str(d)[:300])

        # ── Platform daily 30-day trend ───────────────────────────────────
        r = self.get("/api/v1/analytics/platform/daily", params={"days": 30})
        self.assert_status("GET /analytics/platform/daily?days=30", r, 200,
                           severity=Severity.MEDIUM)

        # ── Platform categories ───────────────────────────────────────────
        r = self.get("/api/v1/analytics/platform/categories")
        self.assert_status("GET /analytics/platform/categories", r, 200,
                           severity=Severity.MEDIUM)

        # ── Platform top-tenants ─────────────────────────────────────────
        r = self.get("/api/v1/analytics/platform/top-tenants")
        self.assert_status("GET /analytics/platform/top-tenants", r, 200,
                           severity=Severity.LOW)

        # ── Per-profile analytics ─────────────────────────────────────────
        for p in profiles[:2]:
            pid  = p["id"]
            name = p["name"]

            # Stats
            r = self.get(f"/api/v1/analytics/{pid}/stats", params={"days": 7})
            ok = self.assert_status(f"GET /analytics/{name}/stats", r, 200,
                                    severity=Severity.HIGH)
            if ok:
                d = r.json()
                total   = d.get("totalQueries",   d.get("data", {}).get("totalQueries", -1))
                blocked = d.get("blockedQueries",  d.get("data", {}).get("blockedQueries", -1))
                self.assert_ok(f"{name}: stats has totalQueries field",
                               isinstance(total, (int, float)),
                               f"totalQueries missing or wrong type: {total}",
                               severity=Severity.MEDIUM)
                if isinstance(total, (int, float)) and isinstance(blocked, (int, float)) and total > 0:
                    rate = blocked / total * 100
                    self.assert_ok(f"{name}: block rate reasonable ({rate:.1f}%)",
                                   0 <= rate <= 100,
                                   f"Block rate {rate:.1f}% out of range",
                                   severity=Severity.LOW)

            # Top domains
            r = self.get(f"/api/v1/analytics/{pid}/top-domains",
                         params={"days": 7, "limit": 10})
            ok = self.assert_status(f"GET /analytics/{name}/top-domains", r, 200,
                                    severity=Severity.MEDIUM)
            if ok:
                data = r.json()
                if isinstance(data, list):
                    for item in data[:3]:
                        self.assert_ok(f"{name}: top-domain has 'domain' field",
                                       "domain" in item,
                                       f"Missing 'domain' in: {item}",
                                       severity=Severity.MEDIUM)

            # Categories breakdown
            r = self.get(f"/api/v1/analytics/{pid}/categories", params={"days": 7})
            self.assert_status(f"GET /analytics/{name}/categories", r, 200,
                               severity=Severity.MEDIUM)

            # Daily trend
            r = self.get(f"/api/v1/analytics/{pid}/daily", params={"days": 30})
            self.assert_status(f"GET /analytics/{name}/daily", r, 200,
                               severity=Severity.LOW)

            # Hourly (last 24h)
            r = self.get(f"/api/v1/analytics/{pid}/hourly")
            self.assert_status(f"GET /analytics/{name}/hourly", r, 200,
                               severity=Severity.LOW)

            # Social alerts
            r = self.get(f"/api/v1/analytics/{pid}/social-alerts")
            self.assert_status(f"GET /analytics/{name}/social-alerts", r, 200,
                               severity=Severity.LOW)

        # ── DB cross-validation ───────────────────────────────────────────
        db_total_7d = self._db_count("""
            SELECT COUNT(*) FROM analytics.dns_query_logs
            WHERE queried_at > NOW() - INTERVAL '7 days'
        """)
        self.assert_ok(f"DB has 7-day logs ({db_total_7d} entries)",
                       db_total_7d >= 0,
                       f"DB query error",
                       severity=Severity.INFO)

        db_blocked = self._db_count("""
            SELECT COUNT(*) FROM analytics.dns_query_logs
            WHERE action = 'BLOCKED' AND queried_at > NOW() - INTERVAL '7 days'
        """)
        if db_total_7d and db_total_7d > 0:
            block_rate = db_blocked / db_total_7d * 100
            self.assert_ok(f"DB block rate sanity check ({block_rate:.1f}%)",
                           0 <= block_rate <= 100,
                           f"Block rate {block_rate:.1f}% is invalid",
                           severity=Severity.MEDIUM)

        # ── CSV Export ────────────────────────────────────────────────────
        tenant_id = None
        try:
            conn = psycopg2.connect(**self.config["db"])
            cur  = conn.cursor()
            cur.execute("SELECT id FROM tenant.tenants LIMIT 1")
            row = cur.fetchone()
            conn.close()
            tenant_id = str(row[0]) if row else None
        except:
            pass

        if tenant_id:
            r = self.get("/api/v1/analytics/export/dns",
                         params={"days": 7, "tenantId": tenant_id})
            ok = self.assert_status("GET /analytics/export/dns (CSV)", r, 200,
                                    severity=Severity.MEDIUM)
            if ok:
                ct = r.headers.get("Content-Type", "")
                is_csv = "csv" in ct or "text" in ct or "# DNS" in r.text[:20]
                self.assert_ok("Export returns CSV content", is_csv,
                               f"Content-Type: {ct}",
                               severity=Severity.LOW)

        # ── PDF Report ────────────────────────────────────────────────────
        if profiles:
            pid = profiles[0]["id"]
            r   = self.get(f"/api/v1/analytics/{pid}/report/pdf")
            ok  = self.assert_status(f"GET /analytics/report/pdf for profile", r, 200,
                                     severity=Severity.MEDIUM)
            if ok:
                self.assert_ok("PDF report has content", len(r.content) > 100,
                               f"PDF response is too small ({len(r.content)} bytes)",
                               severity=Severity.LOW)

        # ── Tenant analytics ──────────────────────────────────────────────
        if tenant_id:
            for path_suffix in ["overview", "daily", "categories", "top-domains", "hourly"]:
                r = self.get(f"/api/v1/analytics/tenant/{tenant_id}/{path_suffix}")
                self.assert_status(f"GET /analytics/tenant/{path_suffix}", r, 200,
                                   severity=Severity.LOW)

        return self.results
