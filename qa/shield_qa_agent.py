#!/usr/bin/env python3
"""
Shield Autonomous QA Agent — Main Orchestrator
Runs all test suites, collects results, generates HTML report.

Usage:
  python shield_qa_agent.py                  # run all suites
  python shield_qa_agent.py --suite dns      # run single suite
  python shield_qa_agent.py --suites dns,auth,security
  python shield_qa_agent.py --no-report      # skip HTML report
"""
import argparse, json, os, sys, time, traceback
from datetime import datetime, timezone
from pathlib import Path

# ── Path setup ────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

# ── Load .env from project root ───────────────────────────────────────────────
_env_file = ROOT.parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            _k = _k.strip()
            _v = _v.strip().strip('"').strip("'")
            if _k and _k not in os.environ:
                os.environ[_k] = _v

from modules import SUITES
from modules.base import TestResult, Severity
from report_generator import generate_report

# ── Colour output ─────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def banner():
    print(f"""
{BOLD}{CYAN}╔══════════════════════════════════════════════════════════════╗
║          Shield Platform — Autonomous QA Agent v1.0          ║
║          End-to-End Enterprise Testing Framework             ║
╚══════════════════════════════════════════════════════════════╝{RESET}
""")

def load_config():
    cfg_path = ROOT / "config.json"
    with open(cfg_path) as f:
        return json.load(f)

def get_jwt(config, session):
    """Obtain JWT via admin login."""
    base  = config["base_url"]
    creds = config["roles"]["global_admin"]
    try:
        r = session.post(
            f"{base}/api/v1/auth/login",
            json={"email": creds["email"], "password": creds["password"]},
            timeout=10
        )
        if r.status_code == 200:
            data = r.json().get("data", {})
            token = data.get("accessToken") or data.get("token") or ""
            if token:
                print(f"  {GREEN}✓{RESET} JWT obtained (admin login succeeded)")
                return token
        print(f"  {RED}✗{RESET} JWT login failed: {r.status_code} — {r.text[:200]}")
    except Exception as e:
        print(f"  {RED}✗{RESET} JWT login error: {e}")
    return ""

def run_suite(suite_cls, config, session, jwt):
    """Run a single suite, return list of TestResult."""
    name = suite_cls.name
    print(f"\n{BOLD}{BLUE}▶ Suite: {name.upper()}{RESET}")
    t0 = time.time()
    try:
        suite   = suite_cls(config, session, jwt)
        results = suite.run()
        elapsed = time.time() - t0
        passed  = sum(1 for r in results if r.passed)
        total   = len(results)
        colour  = GREEN if passed == total else (YELLOW if passed >= total * 0.8 else RED)
        print(f"  {colour}{passed}/{total} passed{RESET}  ({elapsed:.1f}s)")
        return results
    except Exception as e:
        elapsed = time.time() - t0
        print(f"  {RED}✗ Suite crashed:{RESET} {e}")
        traceback.print_exc()
        # Return a synthetic failure result
        return [TestResult(
            name=f"{name}: suite crashed",
            suite=name,
            passed=False,
            severity=Severity.CRITICAL,
            message=str(e),
            detail=traceback.format_exc(),
        )]

def print_summary(all_results, elapsed):
    total  = len(all_results)
    passed = sum(1 for r in all_results if r.passed)
    failed = total - passed
    pct    = round(passed / total * 100, 1) if total else 0

    # Severity breakdown
    sev = {s.value: 0 for s in Severity}
    for r in all_results:
        if not r.passed:
            sev[r.severity.value] += 1

    colour = GREEN if pct >= 95 else (YELLOW if pct >= 80 else RED)
    verdict = ("✅ ALL SYSTEMS GO" if pct >= 95 else
               "⚠  PARTIAL FAILURES" if pct >= 80 else
               "🚨 CRITICAL FAILURES")

    print(f"""
{BOLD}{'─'*62}
  RESULTS SUMMARY
{'─'*62}{RESET}
  Total tests : {BOLD}{total}{RESET}
  Passed      : {GREEN}{passed}{RESET}
  Failed      : {RED}{failed}{RESET}
  Pass rate   : {colour}{BOLD}{pct}%{RESET}
  Duration    : {elapsed:.1f}s

  Severity breakdown (failures):
    CRITICAL : {RED}{sev['CRITICAL']}{RESET}
    HIGH     : {YELLOW}{sev['HIGH']}{RESET}
    MEDIUM   : {sev['MEDIUM']}
    LOW      : {sev['LOW']}
    INFO     : {sev['INFO']}

  {colour}{BOLD}{verdict}{RESET}
{BOLD}{'─'*62}{RESET}""")

    # Print individual failures
    failures = [r for r in all_results if not r.passed]
    if failures:
        print(f"\n{BOLD}{RED}  Failed Tests:{RESET}")
        for r in sorted(failures, key=lambda x: list(Severity).index(x.severity)):
            icon = "🔴" if r.severity == Severity.CRITICAL else \
                   "🟠" if r.severity == Severity.HIGH else \
                   "🟡" if r.severity == Severity.MEDIUM else "🟢"
            print(f"  {icon} [{r.suite}] {r.name}")
            print(f"     {RED}{r.message}{RESET}")
            if r.fix:
                print(f"     {CYAN}💡 {r.fix}{RESET}")

def save_json(all_results, run_meta, output_dir):
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    ts   = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = os.path.join(output_dir, f"qa_results_{ts}.json")
    data = {
        "meta": run_meta,
        "results": [
            {
                "suite":      r.suite,
                "name":       r.name,
                "passed":     r.passed,
                "severity":   r.severity.value,
                "message":    r.message,
                "detail":     r.detail or "",
                "latency_ms": r.latency_ms,
                "steps":      r.steps or [],
                "fix":        r.fix or "",
            }
            for r in all_results
        ]
    }
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    return path


def main():
    banner()

    parser = argparse.ArgumentParser(description="Shield Autonomous QA Agent")
    parser.add_argument("--suite",    help="Run a single suite by name")
    parser.add_argument("--suites",   help="Comma-separated list of suites to run")
    parser.add_argument("--no-report", action="store_true", help="Skip HTML report")
    parser.add_argument("--output-dir", default=str(ROOT / "reports"), help="Report output directory")
    args = parser.parse_args()

    # ── Load config ───────────────────────────────────────────────────────────
    print(f"  Loading config...")
    config = load_config()
    print(f"  {GREEN}✓{RESET} Config loaded — target: {config['base_url']}")

    # ── HTTP Session ──────────────────────────────────────────────────────────
    import requests
    session = requests.Session()
    session.headers.update({"User-Agent": "Shield-QA/1.0"})

    # ── Auth ──────────────────────────────────────────────────────────────────
    print(f"  Obtaining JWT...")
    jwt = get_jwt(config, session)

    # ── Select suites ─────────────────────────────────────────────────────────
    suite_order = config.get("test_suites", list(SUITES.keys()))

    if args.suite:
        names = [args.suite.strip()]
    elif args.suites:
        names = [s.strip() for s in args.suites.split(",")]
    else:
        names = suite_order

    # Filter to known suites
    unknown = [n for n in names if n not in SUITES]
    if unknown:
        print(f"\n  {RED}Unknown suites: {unknown}{RESET}")
        print(f"  Available: {list(SUITES.keys())}")
        sys.exit(1)

    suites_to_run = [(n, SUITES[n]) for n in names if n in SUITES]
    print(f"\n  Running {len(suites_to_run)} suite(s): {[n for n,_ in suites_to_run]}")

    # ── Run suites ────────────────────────────────────────────────────────────
    started_at  = datetime.now(timezone.utc).isoformat()
    t_start     = time.time()
    all_results = []

    for suite_name, suite_cls in suites_to_run:
        results = run_suite(suite_cls, config, session, jwt)
        all_results.extend(results)

    elapsed = time.time() - t_start

    # ── Summary ───────────────────────────────────────────────────────────────
    print_summary(all_results, elapsed)

    # ── Save JSON ─────────────────────────────────────────────────────────────
    run_meta = {
        "started_at":       started_at,
        "elapsed_seconds":  elapsed,
        "version":          config.get("version", "2.1.4"),
        "base_url":         config["base_url"],
        "suites_run":       [n for n, _ in suites_to_run],
        "total":            len(all_results),
        "passed":           sum(1 for r in all_results if r.passed),
    }
    json_path = save_json(all_results, run_meta, args.output_dir)
    print(f"\n  {GREEN}✓{RESET} JSON results saved: {json_path}")

    # ── HTML report ───────────────────────────────────────────────────────────
    if not args.no_report:
        ts          = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        report_path = os.path.join(args.output_dir, f"qa_report_{ts}.html")
        generate_report(all_results, run_meta, report_path)
        print(f"  {GREEN}✓{RESET} HTML report:  {report_path}")

        # Also write a stable "latest" symlink / copy
        latest_path = os.path.join(args.output_dir, "qa_report_latest.html")
        import shutil
        shutil.copy2(report_path, latest_path)
        print(f"  {GREEN}✓{RESET} Latest report: {latest_path}")

    # ── Exit code ─────────────────────────────────────────────────────────────
    total  = len(all_results)
    passed = sum(1 for r in all_results if r.passed)
    pct    = passed / total * 100 if total else 0

    if pct < 80:
        sys.exit(2)   # critical failure
    elif pct < 100:
        sys.exit(1)   # partial failure
    sys.exit(0)       # all pass


if __name__ == "__main__":
    main()
