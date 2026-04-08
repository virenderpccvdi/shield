"""
Suite: Performance Testing
Concurrent DNS queries, API load test, latency percentiles, throughput.
"""
import time, concurrent.futures, statistics, requests
from .base import TestSuite, Severity

try:
    import dns.message, dns.rdatatype
    DNS_OK = True
except ImportError:
    DNS_OK = False


class PerformanceSuite(TestSuite):
    name = "performance"

    def _dns_query(self, client_id, domain):
        if not DNS_OK:
            return -1
        try:
            wire = dns.message.make_query(domain, dns.rdatatype.A).to_wire()
            t0   = time.time()
            r    = requests.post(self.config["dns_resolver_url"],
                                 data=wire, timeout=5,
                                 headers={"Content-Type": "application/dns-message",
                                          "Accept": "application/dns-message",
                                          "Host": f"{client_id}{self.config['dns_host_suffix']}"})
            return int((time.time() - t0) * 1000) if r.status_code == 200 else -1
        except:
            return -1

    def _api_query(self, path, params=None):
        try:
            t0 = time.time()
            r  = requests.get(f"{self.base}{path}",
                              headers=self._hdrs, params=params, timeout=10)
            return int((time.time() - t0) * 1000) if r.status_code == 200 else -1
        except:
            return -1

    def _percentiles(self, data):
        data = sorted(d for d in data if d >= 0)
        if not data:
            return {"p50": -1, "p95": -1, "p99": -1, "success": 0, "total": 0}
        n = len(data)
        return {
            "p50": data[n // 2],
            "p95": data[int(n * 0.95)],
            "p99": data[int(n * 0.99)] if n >= 100 else data[-1],
            "min": data[0],
            "max": data[-1],
            "mean": int(statistics.mean(data)),
            "success": n,
            "total": len(data)
        }

    def run(self):
        print("\n── Performance ──────────────────────────────────────────")
        thresh = self.config["thresholds"]

        # ── DNS: 100 concurrent queries ───────────────────────────────────
        domains = ["google.com", "bbc.com", "stackoverflow.com",
                   "github.com", "wikipedia.org", "youtube.com",
                   "amazon.com", "netflix.com", "espn.com", "byjus.com"]
        clients = ["disha-0000", "jakesmith-0000", "sangeeta-0000"]

        print("    DNS: 100 concurrent queries...", flush=True)
        latencies = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=25) as ex:
            futs = [ex.submit(self._dns_query,
                              clients[i % len(clients)],
                              domains[i % len(domains)])
                    for i in range(100)]
            latencies = [f.result() for f in concurrent.futures.as_completed(futs)]

        stats = self._percentiles(latencies)
        dns_threshold = thresh["dns_p95_ms"]
        self.assert_ok(
            f"DNS 100-req p95={stats['p95']}ms ≤ {dns_threshold}ms",
            stats["p95"] <= dns_threshold,
            f"p50={stats['p50']} p95={stats['p95']} p99={stats['p99']}ms — threshold={dns_threshold}ms",
            severity=Severity.HIGH,
            fix="Optimize upstream UDP forwarding; add Redis caching for frequent domains"
        )
        self.assert_ok(
            f"DNS success rate {stats['success']}/100",
            stats["success"] >= 95,
            f"Only {stats['success']}/100 DNS queries succeeded",
            severity=Severity.CRITICAL
        )

        # ── DNS: 200 concurrent queries (stress) ─────────────────────────
        print("    DNS: 200 concurrent queries (stress test)...", flush=True)
        latencies2 = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as ex:
            futs = [ex.submit(self._dns_query,
                              clients[i % len(clients)],
                              domains[i % len(domains)])
                    for i in range(200)]
            latencies2 = [f.result() for f in concurrent.futures.as_completed(futs)]

        stats2 = self._percentiles(latencies2)
        self.assert_ok(
            f"DNS 200-req stress p95={stats2['p95']}ms",
            stats2["p95"] <= dns_threshold * 2,
            f"p95={stats2['p95']}ms under stress exceeds 2× threshold",
            severity=Severity.MEDIUM
        )
        self.assert_ok(
            f"DNS 200-req success={stats2['success']}/200",
            stats2["success"] >= 180,
            f"Only {stats2['success']}/200 succeeded under stress",
            severity=Severity.HIGH
        )

        # ── API: concurrent gateway calls ─────────────────────────────────
        print("    API: 50 concurrent gateway calls...", flush=True)
        api_paths = [
            ("/api/v1/analytics/platform/overview", None),
            ("/api/v1/tenants", {"page": 0, "size": 5}),
            ("/api/v1/rewards/tasks", None),
            ("/api/v1/dns/categories/full", None),
        ]
        api_latencies = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
            futs = [ex.submit(self._api_query,
                              api_paths[i % len(api_paths)][0],
                              api_paths[i % len(api_paths)][1])
                    for i in range(50)]
            api_latencies = [f.result() for f in concurrent.futures.as_completed(futs)]

        api_stats = self._percentiles(api_latencies)
        api_threshold = thresh["api_p95_ms"]
        self.assert_ok(
            f"API 50-req p95={api_stats['p95']}ms ≤ {api_threshold}ms",
            api_stats["p95"] <= api_threshold,
            f"API p95={api_stats['p95']}ms exceeds {api_threshold}ms",
            severity=Severity.HIGH,
            fix="Add @Cacheable to hot endpoints; optimize DB queries with proper indexes"
        )
        self.assert_ok(
            f"API success rate {api_stats['success']}/50",
            api_stats["success"] >= 48,
            f"Only {api_stats['success']}/50 API calls succeeded",
            severity=Severity.HIGH
        )

        # ── Sequential auth throughput ────────────────────────────────────
        print("    Auth: 20 sequential logins...", flush=True)
        login_times = []
        for _ in range(20):
            t0 = time.time()
            r  = requests.post(f"{self.base}/api/v1/auth/login",
                               json={"email": self.config["roles"]["global_admin"]["email"],
                                     "password": self.config["roles"]["global_admin"]["password"]},
                               timeout=5)
            if r.status_code == 200:
                login_times.append(int((time.time() - t0) * 1000))

        if login_times:
            login_stats = self._percentiles(login_times)
            self.assert_ok(
                f"Auth p95={login_stats['p95']}ms ≤ 2000ms",
                login_stats["p95"] <= 2000,
                f"Login p95={login_stats['p95']}ms too slow",
                severity=Severity.MEDIUM
            )
            self.assert_ok(
                f"Auth mean={login_stats['mean']}ms ≤ 500ms",
                login_stats["mean"] <= 500,
                f"Login mean={login_stats['mean']}ms too slow",
                severity=Severity.LOW
            )

        # ── DB connection pool check ──────────────────────────────────────
        import psycopg2
        db_times = []
        try:
            for _ in range(10):
                t0   = time.time()
                conn = psycopg2.connect(**self.config["db"])
                cur  = conn.cursor()
                cur.execute("SELECT COUNT(*) FROM analytics.dns_query_logs LIMIT 1")
                cur.fetchone()
                conn.close()
                db_times.append(int((time.time() - t0) * 1000))

            db_stats = self._percentiles(db_times)
            self.assert_ok(
                f"DB query p95={db_stats['p95']}ms ≤ 500ms",
                db_stats["p95"] <= 500,
                f"DB query p95={db_stats['p95']}ms is slow",
                severity=Severity.MEDIUM,
                fix="Check PostgreSQL query plans; add indexes on queried_at, profile_id"
            )
        except Exception as e:
            self.assert_ok("DB connection performance", False, str(e), severity=Severity.HIGH)

        return self.results
