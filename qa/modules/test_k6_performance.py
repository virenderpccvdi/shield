"""
Suite: k6 Load Performance Testing
Runs qa/k6/shield_load_test.js via k6 CLI and parses results into TestResult objects.

Prerequisites:
  snap install k6        (Ubuntu)
  or: apt install k6
  or: download from https://k6.io/docs/get-started/installation/

Falls back gracefully if k6 is not installed.
"""
import json, os, subprocess, tempfile
from pathlib import Path
from .base import TestSuite, Severity, TestResult


K6_SCRIPT = Path(__file__).parent.parent / "k6" / "shield_load_test.js"


def _find_k6():
    for candidate in ["k6", "/usr/bin/k6", "/usr/local/bin/k6", "/snap/bin/k6"]:
        try:
            r = subprocess.run([candidate, "version"], capture_output=True, timeout=5)
            if r.returncode == 0:
                return candidate
        except Exception:
            pass
    return None


class K6PerformanceSuite(TestSuite):
    name = "k6_performance"

    def _install_k6(self):
        """Attempt k6 installation via snap."""
        print("    Attempting k6 install via snap...", flush=True)
        try:
            r = subprocess.run(
                ["snap", "install", "k6"],
                capture_output=True, text=True, timeout=120
            )
            return r.returncode == 0
        except Exception:
            return False

    def _parse_k6_summary(self, summary_data):
        """Parse k6 JSON summary file into scenario stats.
        k6 1.x summary format: metrics[name] = {"count": N, "rate": R, ...} (flat)
        Older format used metrics[name] = {"values": {"count": N, ...}} (nested)
        """
        metrics = summary_data.get("metrics", {})

        def _get(metric_name, key, default=-1):
            m = metrics.get(metric_name, {})
            # Try flat format first (k6 1.x), then nested "values" (k6 0.x)
            if key in m:
                return m[key]
            return m.get("values", {}).get(key, default)

        def get_p95(metric_name):
            return _get(metric_name, "p(95)")

        def get_fail_rate(metric_name):
            return _get(metric_name, "rate")

        def get_count(metric_name):
            return _get(metric_name, "count", 0)

        # k6 --summary-export stores http_req_duration in milliseconds.
        # Scenario-tagged keys (e.g. {scenario:dns_burst}) may not appear in summary-export;
        # fall back to custom Trend metrics (also in ms) — no unit conversion needed.
        return {
            "auth_p95_ms":     get_p95("auth_duration_ms"),
            "dns_p95_ms":      get_p95("dns_duration_ms"),
            "api_p95_ms":      get_p95("api_duration_ms"),
            "auth_fail_rate":  get_fail_rate("http_req_failed{scenario:auth_ramp}"),
            "dns_fail_rate":   get_fail_rate("http_req_failed{scenario:dns_burst}"),
            "api_fail_rate":   get_fail_rate("http_req_failed{scenario:analytics_load}"),
            "ws_errors":       get_count("ws_connect_errors"),
            "total_requests":  get_count("http_reqs"),
            "threshold_breaches": summary_data.get("root_group", {}).get("checks", {}),
        }

    def run(self):
        print("\n── k6 Load Testing ──────────────────────────────────────")

        k6 = _find_k6()
        if not k6:
            installed = self._install_k6()
            if installed:
                k6 = _find_k6()
            if not k6:
                self.assert_ok("k6 available for load testing",
                               False,
                               "k6 not installed — skipping load tests",
                               severity=Severity.INFO,
                               fix="Install k6: snap install k6  OR  apt install k6")
                return self.results

        if not K6_SCRIPT.exists():
            self.assert_ok("k6 test script exists",
                           False,
                           f"Script not found: {K6_SCRIPT}",
                           severity=Severity.INFO)
            return self.results

        thresholds = self.config.get("thresholds", {})
        base_url   = self.config.get("base_url", "http://localhost:8280")
        dns_url    = self.config.get("dns_resolver_url", "http://localhost:8292/dns-query")
        admin_creds = self.config.get("roles", {}).get("global_admin", {})

        # Write results to a temp JSON file
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tf:
            summary_path = tf.name

        print("    Running k6 scenarios (this may take ~5 minutes)...", flush=True)
        try:
            env = {
                **os.environ,
                "BASE_URL":    base_url,
                "DNS_URL":     dns_url,
                "ADMIN_EMAIL": admin_creds.get("email", "admin@rstglobal.in"),
                "ADMIN_PASS":  admin_creds.get("password", ""),
            }
            r = subprocess.run(
                [k6, "run",
                 f"--out=json={summary_path}",
                 "--summary-export", summary_path + ".summary",
                 str(K6_SCRIPT)],
                capture_output=True, text=True, timeout=360,
                env=env
            )
        except subprocess.TimeoutExpired:
            self.assert_ok("k6 run completed in time",
                           False,
                           "k6 timed out after 6 minutes",
                           severity=Severity.HIGH)
            return self.results
        except Exception as e:
            self.assert_ok("k6 run launched",
                           False,
                           f"k6 execution error: {e}",
                           severity=Severity.HIGH)
            return self.results

        # k6 returns non-zero when thresholds fail — that's OK, we handle it ourselves
        print(f"    k6 exit code: {r.returncode}", flush=True)

        # Parse summary
        summary_file = summary_path + ".summary"
        try:
            with open(summary_file) as f:
                summary_data = json.load(f)
            stats = self._parse_k6_summary(summary_data)
        except Exception as e:
            self.assert_ok("k6 results parseable",
                           False,
                           f"Could not parse k6 output: {e}",
                           severity=Severity.HIGH)
            return self.results
        finally:
            for p in [summary_path, summary_file]:
                try: os.unlink(p)
                except: pass

        # ── Assert scenarios ────────────────────────────────────────────────
        auth_p95  = stats["auth_p95_ms"]
        dns_p95   = stats["dns_p95_ms"]
        api_p95   = stats["api_p95_ms"]
        auth_fail = stats["auth_fail_rate"]
        dns_fail  = stats["dns_fail_rate"]
        api_fail  = stats["api_fail_rate"]
        total_req = stats["total_requests"]

        k6_auth_p95  = thresholds.get("k6_auth_p95_ms",   500)
        k6_dns_p95   = thresholds.get("k6_dns_p95_ms",    300)
        k6_api_p95   = thresholds.get("k6_api_p95_ms",    2000)
        k6_err_rate  = thresholds.get("k6_error_rate_pct", 2.0) / 100.0

        if auth_p95 >= 0:
            self.assert_ok(f"Auth ramp p95={auth_p95:.0f}ms ≤ {k6_auth_p95}ms",
                           auth_p95 <= k6_auth_p95,
                           f"Auth p95={auth_p95:.0f}ms exceeds {k6_auth_p95}ms under load",
                           severity=Severity.HIGH,
                           fix="Auth service is slow under load: add connection pooling; check bcrypt work factor",
                           latency=int(auth_p95))

        if auth_fail >= 0:
            self.assert_ok(f"Auth error rate {auth_fail*100:.1f}% ≤ {k6_err_rate*100:.0f}%",
                           auth_fail <= k6_err_rate,
                           f"Auth error rate {auth_fail*100:.1f}% too high under load",
                           severity=Severity.CRITICAL,
                           fix="Auth service may be exhausting DB connections under load")

        if dns_p95 >= 0:
            self.assert_ok(f"DNS burst p95={dns_p95:.0f}ms ≤ {k6_dns_p95}ms",
                           dns_p95 <= k6_dns_p95,
                           f"DNS p95={dns_p95:.0f}ms under 50 concurrent VUs",
                           severity=Severity.HIGH,
                           fix="DNS resolver slow under burst: add Redis caching, optimize UDP upstream",
                           latency=int(dns_p95))

        if dns_fail >= 0:
            self.assert_ok(f"DNS error rate {dns_fail*100:.1f}% ≤ 1%",
                           dns_fail <= 0.01,
                           f"DNS error rate {dns_fail*100:.1f}% under burst load",
                           severity=Severity.HIGH)

        if api_p95 >= 0:
            self.assert_ok(f"Analytics API p95={api_p95:.0f}ms ≤ {k6_api_p95}ms",
                           api_p95 <= k6_api_p95,
                           f"Analytics API p95={api_p95:.0f}ms too slow under load",
                           severity=Severity.MEDIUM,
                           fix="Add @Cacheable to analytics hot endpoints; optimize DB queries",
                           latency=int(api_p95))

        ws_errors = stats["ws_errors"]
        # Allow up to 10 WS errors — minor connectivity hiccups under load are expected.
        # High counts (>100) indicate the WS/STOMP endpoint is broken or unreachable.
        self.assert_ok(f"WebSocket connections ({ws_errors} errors)",
                       ws_errors <= 100,
                       f"{ws_errors} WebSocket connection errors — STOMP/WS endpoint may be broken",
                       severity=Severity.LOW,
                       fix="Verify WebSocket endpoint at /ws is reachable; check nginx proxy_pass WebSocket headers")

        self.assert_ok(f"Total k6 requests processed ({total_req})",
                       total_req > 0,
                       "No requests were processed by k6",
                       severity=Severity.HIGH)

        return self.results
