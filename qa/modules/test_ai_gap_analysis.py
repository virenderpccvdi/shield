"""
Suite: AI-Powered Gap Analysis
Uses Claude API to analyze QA results and identify:
  - Product gaps not covered by existing tests
  - UX flows likely broken or confusing
  - Security blindspots
  - Missing feature coverage
  - Architecture concerns

Returns findings as TestResult objects (passed=True, severity varies).
Uses stdlib urllib — no pip deps required.
"""
import json, os, urllib.request, urllib.error
from pathlib import Path
from .base import TestSuite, Severity, TestResult


SYSTEM_PROMPT = """You are a senior QA architect + product manager reviewing Shield, a family DNS filtering SaaS.

Platform:
- Backend: Java Spring Boot 4.x microservices (12 services)
- Frontend: React 19 + MUI v7 dashboard (90+ pages)
- Mobile: Flutter 3.41 app (25+ screens)
- AI service: FastAPI + scikit-learn + Claude API
- DNS: DoH resolver with category-based blocking
- Roles: GLOBAL_ADMIN, ISP_ADMIN, CUSTOMER (parent)

Core user journeys:
1. ISP sets up Shield → creates tenants (customers)
2. Parent (CUSTOMER) registers → adds child profiles → sets DNS filter level
3. Child's devices use DNS-over-HTTPS with profile-specific subdomain
4. DNS queries are filtered in real-time, logged to analytics
5. Parent views dashboard: DNS history, blocked sites, time limits, schedule
6. Rewards: child earns points for good behavior, redeemable for screen time
7. Geofencing: alerts when child leaves safe zones
8. AI Insights: anomaly detection, usage patterns, recommendations

You will receive a JSON summary of the latest automated test results.
Analyze these results and identify:
1. Product gaps (features important to real users but not tested)
2. UX flows likely broken or confusing
3. Security blindspots beyond what's already tested
4. Performance or reliability risks not covered
5. Missing business logic validations

For EACH finding output exactly this JSON format (one per line, no wrapper array):
{"finding": "concise description", "severity": "CRITICAL|HIGH|MEDIUM|LOW", "category": "PRODUCT|UX|SECURITY|PERFORMANCE|COVERAGE|RELIABILITY", "recommendation": "specific actionable fix with technical detail", "affected_area": "which service/page/flow is affected"}

Output ONLY the JSON lines, no other text."""


class AiGapAnalysisSuite(TestSuite):
    name = "ai_gap_analysis"

    def _get_api_key(self):
        # Try config, then env
        key = self.config.get("ai_gap_analysis", {}).get("anthropic_api_key", "")
        if not key or key.startswith("${"):
            key = os.environ.get("ANTHROPIC_API_KEY", "")
        return key

    def _load_latest_results(self):
        reports_dir = Path(self.config.get("reports_dir",
                           "/var/www/ai/FamilyShield/qa/reports"))
        json_files = sorted(reports_dir.glob("qa_results_*.json"),
                            key=lambda p: p.stat().st_mtime, reverse=True)
        if not json_files:
            return None
        try:
            with open(json_files[0]) as f:
                return json.load(f)
        except Exception:
            return None

    def _build_summary(self, results_data):
        if not results_data:
            return "No previous test results available."

        meta = results_data.get("meta", {})
        results = results_data.get("results", [])

        total   = len(results)
        passed  = sum(1 for r in results if r.get("passed"))
        failed  = total - passed
        pct     = round(passed / total * 100, 1) if total else 0

        # Group failures by suite
        failures_by_suite = {}
        for r in results:
            if not r.get("passed"):
                suite = r.get("suite", "unknown")
                failures_by_suite.setdefault(suite, []).append({
                    "name": r.get("name"),
                    "severity": r.get("severity"),
                    "message": r.get("message"),
                    "fix": r.get("fix", ""),
                })

        # Suites that passed 100%
        suite_stats = {}
        for r in results:
            s = r.get("suite")
            suite_stats.setdefault(s, {"passed": 0, "total": 0})
            suite_stats[s]["total"] += 1
            if r.get("passed"):
                suite_stats[s]["passed"] += 1

        summary = {
            "overall": {"total": total, "passed": passed, "failed": failed,
                        "pass_rate_pct": pct},
            "run_meta": {
                "version": meta.get("version"),
                "suites_run": meta.get("suites_run", []),
                "elapsed_seconds": meta.get("elapsed_seconds"),
            },
            "suite_breakdown": {
                s: f"{v['passed']}/{v['total']} ({round(v['passed']/v['total']*100)}%)"
                for s, v in suite_stats.items()
            },
            "failures": failures_by_suite,
            "known_gaps": [
                "No Playwright UI tests (browser-level testing not covered)",
                "No WebSocket/STOMP connection tests",
                "No Flutter mobile integration tests",
                "No geofence alert end-to-end test",
                "No screen time extension approval flow test",
                "No co-parent invite acceptance test",
                "No subscription downgrade side-effect test",
                "No DNS filter change propagation timing test",
                "No Windows agent registration/heartbeat test",
                "No ISP bulk customer import test",
                "No AI chat conversation test",
                "No cache invalidation test after filter level change",
                "No concurrent parent+child session isolation test",
            ],
        }
        return json.dumps(summary, indent=2)

    def _call_claude(self, prompt, api_key):
        model = self.config.get("ai_gap_analysis", {}).get(
            "model", "claude-sonnet-4-6")
        max_tokens = self.config.get("ai_gap_analysis", {}).get("max_tokens", 4096)

        payload = json.dumps({
            "model": model,
            "max_tokens": max_tokens,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": prompt}],
        }).encode()

        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode())
            return body["content"][0]["text"]

    def _parse_findings(self, text):
        findings = []
        for line in text.strip().splitlines():
            line = line.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                f = json.loads(line)
                if "finding" in f:
                    findings.append(f)
            except json.JSONDecodeError:
                pass
        return findings

    def _sev(self, s):
        return {
            "CRITICAL": Severity.CRITICAL,
            "HIGH":     Severity.HIGH,
            "MEDIUM":   Severity.MEDIUM,
            "LOW":      Severity.LOW,
        }.get(s.upper() if s else "", Severity.MEDIUM)

    def run(self):
        print("\n── AI Gap Analysis ──────────────────────────────────────")

        api_key = self._get_api_key()
        if not api_key:
            self.assert_ok("AI gap analysis: API key configured",
                           False,
                           "ANTHROPIC_API_KEY not set — skipping AI analysis",
                           severity=Severity.INFO,
                           fix="Set ANTHROPIC_API_KEY in /var/www/ai/FamilyShield/.env")
            return self.results

        # Load latest test results for context
        results_data = self._load_latest_results()
        summary = self._build_summary(results_data)

        prompt = f"""Here are the latest automated test results for the Shield platform:

{summary}

Based on this, identify the most important product gaps, UX issues, and coverage blindspots.
Focus on: (1) real user impact, (2) gaps that are hard to find without product knowledge,
(3) security risks specific to a family safety product with child users.

Provide 8-12 specific, actionable findings."""

        print("    Calling Claude API for gap analysis...", flush=True)
        try:
            response_text = self._call_claude(prompt, api_key)
            findings = self._parse_findings(response_text)

            if not findings:
                self.assert_ok("AI gap analysis: received findings", False,
                               "Claude returned no parseable findings",
                               severity=Severity.INFO)
                return self.results

            print(f"    {len(findings)} gaps identified", flush=True)

            for i, f in enumerate(findings, 1):
                finding     = f.get("finding", "Unknown finding")
                sev         = self._sev(f.get("severity", "MEDIUM"))
                category    = f.get("category", "COVERAGE")
                rec         = f.get("recommendation", "")
                affected    = f.get("affected_area", "")
                name        = f"Gap #{i} [{category}]: {finding[:60]}"
                detail      = f"Affected: {affected}" if affected else ""

                # Gap findings are passed=True (informational intelligence, not failures)
                r = TestResult(
                    name=name,
                    suite=self.name,
                    passed=True,
                    severity=sev,
                    message=f"[{category}] {finding}",
                    detail=detail,
                    fix=rec,
                )
                self.results.append(r)
                icon = "🔴" if sev == Severity.CRITICAL else \
                       "🟠" if sev == Severity.HIGH else \
                       "🟡" if sev == Severity.MEDIUM else "🟢"
                print(f"  {icon} {name}", flush=True)

            self.assert_ok(f"AI gap analysis completed ({len(findings)} findings)",
                           True, f"Identified {len(findings)} product/coverage gaps",
                           severity=Severity.INFO)

        except urllib.error.HTTPError as e:
            err_body = e.read().decode() if e.fp else ""
            self.assert_ok("AI gap analysis: Claude API call",
                           False,
                           f"Claude API HTTP {e.code}: {err_body[:200]}",
                           severity=Severity.INFO,
                           fix="Check ANTHROPIC_API_KEY validity and rate limits")
        except Exception as e:
            self.assert_ok("AI gap analysis: Claude API call",
                           False,
                           f"API error: {e}",
                           severity=Severity.INFO)

        return self.results
