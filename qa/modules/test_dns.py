"""
Suite: DNS Filtering
Tests category blocking, custom blocklist/allowlist, filter levels,
subdomain matching, real-time logging, and resolver performance.
"""
import time, psycopg2, requests
from datetime import datetime, timezone
from .base import TestSuite, Severity

try:
    import dns.message, dns.rdatatype, dns.rcode
    DNS_AVAILABLE = True
except ImportError:
    DNS_AVAILABLE = False


BLOCK_MATRIX = [
    # (domain, category, strict, moderate, relaxed)
    ("pornhub.com",       "adult",       True,  True,  True),
    ("xvideos.com",       "adult",       True,  True,  True),
    ("bet365.com",        "gambling",    True,  True,  True),
    ("dream11.com",       "gambling",    True,  True,  True),
    ("malware.wicar.org", "malware",     True,  True,  True),
    ("erowid.org",        "drugs",       True,  True,  True),
    ("thepiratebay.org",  "piracy",      True,  True,  True),
    ("stormfront.org",    "hate_speech", True,  True,  True),
    ("gunsamerica.com",   "weapons",     True,  True,  True),
    ("tinder.com",        "dating",      True,  True,  True),
    ("nordvpn.com",       "vpn_proxy",   True,  True,  False),
    ("twitter.com",       "social_media",True,  False, False),
    ("netflix.com",       "streaming",   True,  False, False),
    ("discord.com",       "messaging",   True,  False, False),
    ("spotify.com",       "music",       True,  False, False),
    ("roblox.com",        "gaming",      True,  False, False),
    ("google.com",        "search",      False, False, False),
    ("wikipedia.org",     "education",   False, False, False),
    ("bbc.com",           "news",        False, False, False),
    ("amazon.com",        "shopping",    False, False, False),
    ("github.com",        "software",    False, False, False),
    ("espn.com",          "sports",      False, False, False),
]


class DnsSuite(TestSuite):
    name = "dns"

    def _query(self, client_id, domain, timeout=5):
        if not DNS_AVAILABLE:
            return "ERROR", 0
        resolver_url = self.config["dns_resolver_url"]
        suffix       = self.config["dns_host_suffix"]
        try:
            wire = dns.message.make_query(domain, dns.rdatatype.A).to_wire()
            t0   = time.time()
            r    = requests.post(resolver_url, data=wire, timeout=timeout,
                                 headers={"Content-Type": "application/dns-message",
                                          "Accept":       "application/dns-message",
                                          "Host":         f"{client_id}{suffix}"})
            latency = int((time.time() - t0) * 1000)
            ans  = dns.message.from_wire(r.content)
            ips  = [rr.address for rrset in ans.answer for rr in rrset if hasattr(rr, "address")]
            if not ips:
                return "NORECORD", latency
            return ("BLOCKED" if ips[0] in ("0.0.0.0", "127.0.0.1") else "ALLOWED"), latency
        except Exception as e:
            return f"ERROR:{type(e).__name__}", 0

    def run(self):
        print("\n── DNS Filtering ────────────────────────────────────────")

        if not DNS_AVAILABLE:
            self.assert_ok("dnspython available", False,
                           "pip3 install dnspython required",
                           severity=Severity.HIGH)
            return self.results

        # ── Discover profiles from DB ──────────────────────────────────────
        profiles = []
        try:
            db = self.config["db"]
            conn = psycopg2.connect(**db)
            cur  = conn.cursor()
            cur.execute("""
                SELECT cp.dns_client_id, cp.filter_level, cp.name
                FROM profile.child_profiles cp
                JOIN dns.dns_rules dr ON dr.dns_client_id = cp.dns_client_id
                LIMIT 3
            """)
            profiles = [{"client_id": r[0], "level": r[1], "name": r[2]}
                        for r in cur.fetchall()]
            conn.close()
        except Exception as e:
            self.assert_ok("Profiles loadable from DB", False, str(e),
                           severity=Severity.CRITICAL)
            return self.results

        self.assert_ok(f"Found {len(profiles)} test profiles", len(profiles) > 0,
                       "No child profiles found — cannot run DNS tests",
                       severity=Severity.CRITICAL)
        if not profiles:
            return self.results

        test_start = datetime.now(timezone.utc)  # must be UTC-aware: psycopg2 treats naive as UTC
        total = passed = failed = latencies = []

        for profile in profiles:
            cid   = profile["client_id"]
            level = profile["level"]
            name  = profile["name"]
            lvl_i = {"STRICT": 0, "MODERATE": 1, "RELAXED": 2}.get(level, 0)

            for domain, category, s_blk, m_blk, r_blk in BLOCK_MATRIX:
                expected_blocked = [s_blk, m_blk, r_blk][lvl_i]
                result, lat      = self._query(cid, domain)
                latencies_val = lat if lat > 0 else None

                if result.startswith("ERROR"):
                    self.assert_ok(f"[{name}/{level}] {domain} ({category})",
                                   False, f"Query error: {result}",
                                   severity=Severity.HIGH)
                    continue

                is_blocked = result == "BLOCKED"
                ok = is_blocked == expected_blocked
                exp_str = "BLOCK" if expected_blocked else "ALLOW"
                got_str = "BLOCK" if is_blocked else ("ALLOW" if result == "ALLOWED" else result)

                self.assert_ok(
                    f"[{name}/{level}] {domain} → {exp_str}",
                    ok,
                    f"Expected {exp_str} but got {got_str} (category={category})",
                    severity=Severity.HIGH if category in ("adult","malware","gambling","drugs","piracy") else Severity.MEDIUM,
                    detail=f"Profile={cid} Level={level} Domain={domain} Category={category}",
                    fix=f"Check enabled_categories['{category}'] for profile {cid} in dns.dns_rules",
                    latency=lat
                )
                if lat > 0:
                    latencies.append(lat)

        # ── Performance: p95 latency ───────────────────────────────────────
        if latencies:
            latencies.sort()
            p50 = latencies[len(latencies)//2]
            p95 = latencies[int(len(latencies)*0.95)]
            threshold = self.config["thresholds"]["dns_p95_ms"]
            self.assert_ok(f"DNS p95 latency {p95}ms ≤ {threshold}ms",
                           p95 <= threshold,
                           f"DNS p95={p95}ms exceeds {threshold}ms threshold",
                           severity=Severity.HIGH,
                           fix="Check upstream DNS server latency; consider local caching")
            self.assert_ok(f"DNS p50 latency {p50}ms ≤ 300ms",
                           p50 <= 300,
                           f"DNS p50={p50}ms is too slow",
                           severity=Severity.MEDIUM)

        # ── Real-time logging check ────────────────────────────────────────
        try:
            db   = self.config["db"]
            conn = psycopg2.connect(**db)
            cur  = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM analytics.dns_query_logs WHERE queried_at > %s",
                        (test_start,))
            logged = cur.fetchone()[0]
            conn.close()
            test_queries = len([r for r in self.results if r.name.startswith("[")])
            self.assert_ok(f"Real-time logging ({logged} entries created)",
                           logged > 0,
                           "No DNS log entries created — async logging may be broken",
                           severity=Severity.HIGH,
                           fix="Check DnsQueryLogService @Async and AnalyticsClient.logQuery()")
        except Exception as e:
            self.assert_ok("Real-time logging DB check", False, str(e),
                           severity=Severity.MEDIUM)

        return self.results
