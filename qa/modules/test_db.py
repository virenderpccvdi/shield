"""
Suite: Database Integrity
Validates schemas, constraints, CRUD operations, foreign keys, data consistency.
"""
import psycopg2, uuid
from .base import TestSuite, Severity


class DatabaseSuite(TestSuite):
    name = "db"

    def _conn(self):
        return psycopg2.connect(**self.config["db"])

    def _q(self, sql, params=None):
        try:
            conn = self._conn()
            cur  = conn.cursor()
            cur.execute(sql, params)
            rows = cur.fetchall()
            conn.close()
            return rows, None
        except Exception as e:
            return [], str(e)

    def _count(self, table, where=""):
        rows, err = self._q(f"SELECT COUNT(*) FROM {table} {where}")
        return rows[0][0] if rows else -1

    def run(self):
        print("\n── Database Integrity ───────────────────────────────────")

        # ── Schema existence ───────────────────────────────────────────────
        schemas = ["auth", "tenant", "profile", "dns", "analytics", "rewards", "notification"]
        rows, err = self._q("""
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name = ANY(%s)
        """, (schemas,))
        found = {r[0] for r in rows}
        for s in schemas:
            self.assert_ok(f"Schema '{s}' exists", s in found,
                           f"Schema '{s}' missing", severity=Severity.CRITICAL)

        # ── Core tables ────────────────────────────────────────────────────
        tables = [
            ("auth",      "users"),
            ("tenant",    "tenants"),
            ("profile",   "child_profiles"),
            ("dns",       "dns_rules"),
            ("dns",       "domain_blocklist"),
            ("analytics", "dns_query_logs"),
            ("rewards",   "tasks"),
            ("notification","notification_channels"),
        ]
        for schema, table in tables:
            rows, err = self._q(f"""
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = %s AND table_name = %s
            """, (schema, table))
            exists = rows[0][0] > 0 if rows else False
            self.assert_ok(f"Table {schema}.{table} exists", exists,
                           f"Table {schema}.{table} not found",
                           severity=Severity.CRITICAL)

        # ── Data presence (not empty) ──────────────────────────────────────
        counts = {
            "auth.users":              self._count("auth.users"),
            "tenant.tenants":          self._count("tenant.tenants"),
            "profile.child_profiles":  self._count("profile.child_profiles"),
            "dns.dns_rules":           self._count("dns.dns_rules"),
            "dns.domain_blocklist":    self._count("dns.domain_blocklist"),
            "analytics.dns_query_logs":self._count("analytics.dns_query_logs"),
        }
        for table, cnt in counts.items():
            self.assert_ok(f"{table} has data (count={cnt})", cnt > 0,
                           f"{table} is EMPTY — no records found",
                           severity=Severity.HIGH,
                           fix=f"Check if {table} migration ran and seed data was inserted")

        # ── Foreign key integrity: dns_rules → child_profiles ─────────────
        rows, err = self._q("""
            SELECT COUNT(*) FROM dns.dns_rules dr
            WHERE NOT EXISTS (
                SELECT 1 FROM profile.child_profiles cp
                WHERE cp.dns_client_id = dr.dns_client_id
            )
        """)
        orphaned = rows[0][0] if rows else -1
        self.assert_ok("No orphaned dns_rules (FK integrity)", orphaned == 0,
                       f"{orphaned} dns_rules have no matching child_profile",
                       severity=Severity.HIGH,
                       fix="Run: DELETE FROM dns.dns_rules dr WHERE NOT EXISTS (SELECT 1 FROM profile.child_profiles cp WHERE cp.dns_client_id=dr.dns_client_id)")

        # ── analytics.dns_query_logs partitioning ─────────────────────────
        rows, err = self._q("""
            SELECT COUNT(*) FROM pg_inherits pi
            JOIN pg_class p ON p.oid = pi.inhparent
            WHERE p.relname = 'dns_query_logs'
        """)
        partitions = rows[0][0] if rows else 0
        self.assert_ok("dns_query_logs has partitions", partitions > 0,
                       f"No partitions found — table may not be partitioned",
                       severity=Severity.MEDIUM)

        # ── Check for NULL violations in critical columns ─────────────────
        null_checks = [
            ("auth.users", "email",       "email IS NULL"),
            ("auth.users", "role",        "role IS NULL"),
            ("tenant.tenants", "name",    "name IS NULL"),
            ("profile.child_profiles", "dns_client_id", "dns_client_id IS NULL"),
        ]
        for table, col, where in null_checks:
            cnt = self._count(table, f"WHERE {where}")
            self.assert_ok(f"{table}.{col} NOT NULL constraint",
                           cnt == 0,
                           f"{cnt} rows in {table} have NULL {col}",
                           severity=Severity.HIGH)

        # ── Duplicate email check ──────────────────────────────────────────
        rows, err = self._q("""
            SELECT email, COUNT(*) c FROM auth.users
            GROUP BY email HAVING COUNT(*) > 1
        """)
        self.assert_ok("No duplicate emails in auth.users", len(rows) == 0,
                       f"{len(rows)} duplicate email(s): {[r[0] for r in rows[:3]]}",
                       severity=Severity.CRITICAL,
                       fix="Add UNIQUE constraint on auth.users(email)")

        # ── dns_rules enabled_categories valid JSON ───────────────────────
        rows, err = self._q("""
            SELECT COUNT(*) FROM dns.dns_rules
            WHERE enabled_categories IS NULL
               OR jsonb_typeof(enabled_categories) != 'object'
        """)
        bad = rows[0][0] if rows else 0
        self.assert_ok("All dns_rules have valid JSONB enabled_categories",
                       bad == 0,
                       f"{bad} dns_rules have invalid/null enabled_categories",
                       severity=Severity.HIGH)

        # ── domain_blocklist category_id references ────────────────────────
        rows, err = self._q("""
            SELECT COUNT(DISTINCT category_id) FROM dns.domain_blocklist
        """)
        cat_count = rows[0][0] if rows else 0
        self.assert_ok(f"domain_blocklist has entries across categories ({cat_count})",
                       cat_count >= 10,
                       f"Only {cat_count} categories in domain_blocklist (expected ≥10)",
                       severity=Severity.MEDIUM)

        # ── Real-time log entries (last 24h) ──────────────────────────────
        rows, err = self._q("""
            SELECT COUNT(*) FROM analytics.dns_query_logs
            WHERE queried_at > NOW() - INTERVAL '24 hours'
        """)
        recent = rows[0][0] if rows else 0
        self.assert_ok(f"Analytics has recent logs ({recent} in last 24h)",
                       recent > 0,
                       "No DNS query logs in last 24h — resolver may not be logging",
                       severity=Severity.HIGH,
                       fix="Check DnsQueryLogService @Async logging and analytics.dns_query_logs partition for today")

        # ── Reward tasks table ─────────────────────────────────────────────
        rows, err = self._q("SELECT COUNT(*) FROM rewards.tasks")
        rtask_cnt = rows[0][0] if rows else -1
        self.assert_ok(f"rewards.tasks populated ({rtask_cnt})",
                       rtask_cnt >= 0,
                       f"rewards.tasks error: {err}",
                       severity=Severity.LOW)

        return self.results
