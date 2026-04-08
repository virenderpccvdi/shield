"""
Shield QA — HTML Report Generator
Produces a rich, self-contained HTML report with charts, bug tables,
coverage metrics, performance graphs, executive summary, and
AI gap analysis findings.
"""
import json, os, glob
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from modules.base import TestResult, Severity


# ── Colour palette ─────────────────────────────────────────────────────────────
COLOURS = {
    "CRITICAL": "#dc2626",
    "HIGH":     "#ea580c",
    "MEDIUM":   "#d97706",
    "LOW":      "#65a30d",
    "INFO":     "#6b7280",
    "pass":     "#16a34a",
    "fail":     "#dc2626",
    "bg":       "#0f172a",
    "card":     "#1e293b",
    "border":   "#334155",
    "text":     "#f1f5f9",
    "muted":    "#94a3b8",
}


def _load_previous_pass_rate(current_output_path: str) -> Optional[float]:
    """Load the pass rate from the most recent previous JSON results file."""
    try:
        reports_dir = Path(current_output_path).parent
        json_files  = sorted(reports_dir.glob("qa_results_*.json"),
                             key=lambda p: p.stat().st_mtime, reverse=True)
        if not json_files:
            return None
        with open(json_files[0]) as f:
            data = json.load(f)
        meta = data.get("meta", {})
        results = data.get("results", [])
        if not results:
            return None
        passed = sum(1 for r in results if r.get("passed"))
        total  = len(results)
        return round(passed / total * 100, 1) if total > 0 else None
    except Exception:
        return None


def _section(title: str, content: str, icon: str = "") -> str:
    return f"""
<div style="margin-bottom:32px">
  <h2 style="color:#f1f5f9;margin-bottom:16px">{icon} {title}</h2>
  {content}
</div>"""


def _executive_summary_html(all_results, run_meta, pct, sev_counts, previous_pct, output_path):
    """Generate the executive summary section."""
    # Weighted platform health score
    suite_weights = {
        "security": 0.25, "owasp_extended": 0.15,
        "auth": 0.10, "rbac": 0.10,
        "dns": 0.15, "performance": 0.10, "k6_performance": 0.05,
        "health": 0.05, "db": 0.05,
    }
    suite_results = {}
    for r in all_results:
        s = suite_results.setdefault(r.suite, {"passed": 0, "total": 0})
        s["total"] += 1
        if r.passed:
            s["passed"] += 1

    weighted_score = 0.0
    total_weight   = 0.0
    for suite, weight in suite_weights.items():
        if suite in suite_results:
            sr  = suite_results[suite]
            pct_s = sr["passed"] / sr["total"] if sr["total"] > 0 else 1.0
            weighted_score += pct_s * weight
            total_weight   += weight
    if total_weight > 0:
        health_score = round(weighted_score / total_weight * 100, 1)
    else:
        health_score = pct

    # Trend
    if previous_pct is not None:
        delta = round(pct - previous_pct, 1)
        trend_sign  = "+" if delta >= 0 else ""
        trend_color = COLOURS["pass"] if delta >= 0 else COLOURS["CRITICAL"]
        trend_html  = f'<span style="color:{trend_color};font-size:14px">{trend_sign}{delta}% vs last run</span>'
    else:
        trend_html = '<span style="color:#94a3b8;font-size:14px">First run</span>'

    # Health score badge
    hs_color = COLOURS["pass"] if health_score >= 95 else \
               COLOURS["MEDIUM"] if health_score >= 80 else COLOURS["CRITICAL"]

    # Top 3 action items (highest severity failures)
    failures = [r for r in all_results if not r.passed]
    sev_order = {Severity.CRITICAL: 0, Severity.HIGH: 1, Severity.MEDIUM: 2,
                 Severity.LOW: 3, Severity.INFO: 4}
    top_failures = sorted(failures, key=lambda r: sev_order.get(r.severity, 99))[:3]

    action_items_html = ""
    for i, r in enumerate(top_failures, 1):
        sev_c = COLOURS.get(r.severity.value, COLOURS["INFO"])
        fix   = f'<div style="font-size:11px;color:#38bdf8;margin-top:2px">💡 {r.fix}</div>' if r.fix else ""
        action_items_html += f"""
        <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid {COLOURS['border']}">
          <div style="min-width:24px;font-weight:700;color:{sev_c}">{i}</div>
          <div>
            <div style="font-weight:600;color:{COLOURS['text']}">{r.name}</div>
            <div style="font-size:12px;color:#f87171">{r.message}</div>
            {fix}
          </div>
          <div style="margin-left:auto">{_sev_badge(r.severity.value)}</div>
        </div>"""

    if not action_items_html:
        action_items_html = f'<div style="padding:16px;text-align:center;color:{COLOURS["pass"]}">🎉 No action items — all tests pass!</div>'

    # AI gap findings summary
    ai_results = [r for r in all_results if r.suite == "ai_gap_analysis"]
    ai_html = ""
    if ai_results:
        # Filter to non-"completed" info results
        gap_findings = [r for r in ai_results if "Gap #" in r.name]
        critical_gaps = sum(1 for r in gap_findings if r.severity == Severity.CRITICAL)
        high_gaps     = sum(1 for r in gap_findings if r.severity == Severity.HIGH)
        medium_gaps   = sum(1 for r in gap_findings if r.severity == Severity.MEDIUM)
        low_gaps      = sum(1 for r in gap_findings if r.severity in (Severity.LOW, Severity.INFO))
        ai_html = f"""
        <div style="margin-top:16px;padding:16px;background:#1a2744;border-radius:8px;border:1px solid #2d3f6b">
          <div style="font-weight:600;color:#60a5fa;margin-bottom:8px">🤖 AI Gap Analysis: {len(gap_findings)} gaps identified</div>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <span style="color:{COLOURS['CRITICAL']}">● {critical_gaps} Critical</span>
            <span style="color:{COLOURS['HIGH']}">● {high_gaps} High</span>
            <span style="color:{COLOURS['MEDIUM']}">● {medium_gaps} Medium</span>
            <span style="color:{COLOURS['muted']}">● {low_gaps} Low/Info</span>
          </div>
        </div>"""

    suites_run = run_meta.get("suites_run", [])
    coverage_pct = round(len(suites_run) / max(len(suite_results), 1) * 100)

    return f"""
<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;margin-bottom:32px">
  <h2 style="color:#f1f5f9;font-size:20px;margin-bottom:20px">📋 Executive Summary</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:24px">
    <div style="text-align:center;padding:16px;background:#0f172a;border-radius:8px">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;margin-bottom:8px">Platform Health Score</div>
      <div style="font-size:48px;font-weight:700;color:{hs_color}">{health_score}%</div>
      <div>{trend_html}</div>
    </div>
    <div style="text-align:center;padding:16px;background:#0f172a;border-radius:8px">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;margin-bottom:8px">Test Coverage</div>
      <div style="font-size:48px;font-weight:700;color:#60a5fa">{len(suites_run)}</div>
      <div style="font-size:12px;color:#94a3b8">suites executed</div>
    </div>
    <div style="text-align:center;padding:16px;background:#0f172a;border-radius:8px">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;margin-bottom:8px">Critical Bugs</div>
      <div style="font-size:48px;font-weight:700;color:{COLOURS['CRITICAL'] if sev_counts['CRITICAL'] else COLOURS['pass']}">{sev_counts['CRITICAL']}</div>
      <div style="font-size:12px;color:#94a3b8">blocking issues</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
    <div>
      <div style="font-size:13px;font-weight:600;color:#94a3b8;margin-bottom:12px;text-transform:uppercase">Top Action Items</div>
      {action_items_html}
    </div>
    <div>
      <div style="font-size:13px;font-weight:600;color:#94a3b8;margin-bottom:12px;text-transform:uppercase">Severity Breakdown</div>
      {"".join(f'''<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid {COLOURS['border']}">
        <span style="color:{COLOURS.get(s.value,COLOURS['INFO'])}">{s.value}</span>
        <span style="font-weight:700;color:{COLOURS['text']}">{sev_counts[s.value]}</span>
      </div>''' for s in Severity)}
      {ai_html}
    </div>
  </div>
</div>"""


def _prioritization_matrix_html(all_results):
    """Generate the issue prioritization matrix."""
    failures = [r for r in all_results if not r.passed]
    if not failures:
        return ""

    # Classify by impact (severity) and likelihood (suite)
    high_likelihood_suites = {"security", "owasp_extended", "auth", "health"}
    cells = {
        ("HIGH",   "HIGH"):   [],
        ("HIGH",   "LOW"):    [],
        ("LOW",    "HIGH"):   [],
        ("LOW",    "LOW"):    [],
    }
    for r in failures:
        impact     = "HIGH" if r.severity in (Severity.CRITICAL, Severity.HIGH) else "LOW"
        likelihood = "HIGH" if r.suite in high_likelihood_suites else "LOW"
        cells[(impact, likelihood)].append(r)

    def cell_html(items, bg, label, icon):
        if not items:
            return f'<td style="background:{bg};padding:16px;vertical-align:top;border-radius:4px"><div style="color:#94a3b8;font-size:12px">{icon} {label}</div><div style="font-size:11px;color:#94a3b8;margin-top:4px">None</div></td>'
        items_html = "".join(
            f'<div style="font-size:11px;margin:2px 0;color:{COLOURS["text"]}">{r.name[:45]}</div>'
            for r in items[:5]
        )
        more = f'<div style="font-size:10px;color:#94a3b8">+{len(items)-5} more</div>' if len(items) > 5 else ""
        return f'<td style="background:{bg};padding:16px;vertical-align:top;border-radius:4px"><div style="color:#fff;font-size:12px;font-weight:600;margin-bottom:6px">{icon} {label}</div>{items_html}{more}</td>'

    return f"""
<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:32px">
  <h3 style="color:#f1f5f9;margin-bottom:16px;font-size:15px">🎯 Issue Prioritization Matrix</h3>
  <div style="overflow-x:auto">
  <table style="width:100%;border-collapse:separate;border-spacing:4px">
    <tr>
      <th style="width:120px;color:#94a3b8;font-size:11px;text-align:right;padding-right:8px"></th>
      <th style="color:#94a3b8;font-size:11px;text-align:center;padding:4px">High Likelihood</th>
      <th style="color:#94a3b8;font-size:11px;text-align:center;padding:4px">Low Likelihood</th>
    </tr>
    <tr>
      <td style="color:#94a3b8;font-size:11px;text-align:right;padding-right:8px;vertical-align:middle">High Impact</td>
      {cell_html(cells[("HIGH","HIGH")], "rgba(220,38,38,0.2)", "Block Deploy", "🔴")}
      {cell_html(cells[("HIGH","LOW")],  "rgba(234,88,12,0.2)", "Fix This Sprint", "🟠")}
    </tr>
    <tr>
      <td style="color:#94a3b8;font-size:11px;text-align:right;padding-right:8px;vertical-align:middle">Low Impact</td>
      {cell_html(cells[("LOW","HIGH")],  "rgba(217,119,6,0.2)", "Fix Next Sprint", "🟡")}
      {cell_html(cells[("LOW","LOW")],   "rgba(101,163,13,0.1)", "Backlog", "🟢")}
    </tr>
  </table>
  </div>
</div>"""


def _ai_findings_html(all_results):
    """Render AI gap analysis findings section."""
    gap_results = [r for r in all_results if r.suite == "ai_gap_analysis" and "Gap #" in r.name]
    if not gap_results:
        return ""

    rows = ""
    for r in gap_results:
        sev_c = COLOURS.get(r.severity.value, COLOURS["INFO"])
        category = r.message.split("]")[0].lstrip("[") if r.message.startswith("[") else ""
        finding  = r.message.split("] ", 1)[1] if "] " in r.message else r.message
        fix_html = f'<div style="font-size:11px;color:#38bdf8;margin-top:3px">💡 {r.fix}</div>' if r.fix else ""
        rows += f"""
        <tr style="border-bottom:1px solid {COLOURS['border']}">
          <td style="padding:8px">{_sev_badge(r.severity.value)}</td>
          <td style="padding:8px;color:#60a5fa;font-size:12px">{category}</td>
          <td style="padding:8px;color:{COLOURS['text']}">{finding}{fix_html}</td>
        </tr>"""

    return f"""
<div style="background:{COLOURS['card']};border:1px solid {COLOURS['border']};border-radius:12px;overflow:hidden;margin-bottom:32px">
  <div style="padding:16px 20px;border-bottom:1px solid {COLOURS['border']};display:flex;justify-content:space-between;align-items:center">
    <h3 style="color:{COLOURS['text']};font-size:15px">🤖 AI Gap Analysis — {len(gap_results)} Findings</h3>
    <span style="font-size:12px;color:{COLOURS['muted']}">Powered by Claude</span>
  </div>
  <table>
    <tr>
      <th style="width:100px">Severity</th>
      <th style="width:120px">Category</th>
      <th>Finding & Recommendation</th>
    </tr>
    {rows}
  </table>
</div>"""


def _badge(text, colour):
    return (f'<span style="background:{colour};color:#fff;padding:2px 8px;'
            f'border-radius:12px;font-size:11px;font-weight:600">{text}</span>')


def _sev_badge(sev):
    return _badge(sev, COLOURS.get(sev, COLOURS["INFO"]))


def generate_report(
        all_results: List[TestResult],
        run_meta: Dict[str, Any],
        output_path: str) -> str:

    # ── Aggregate ─────────────────────────────────────────────────────────────
    total   = len(all_results)
    passed  = sum(1 for r in all_results if r.passed)
    failed  = total - passed
    pct     = round(passed / total * 100, 1) if total > 0 else 0
    bugs    = [r for r in all_results if not r.passed]

    suites  = {}
    for r in all_results:
        s = suites.setdefault(r.suite, {"passed": 0, "failed": 0, "tests": []})
        s["tests"].append(r)
        if r.passed:
            s["passed"] += 1
        else:
            s["failed"] += 1

    sev_counts = {s.value: 0 for s in Severity}
    for r in bugs:
        sev_counts[r.severity.value] += 1

    status_colour = (COLOURS["pass"] if pct >= 95 else
                     COLOURS["MEDIUM"] if pct >= 80 else
                     COLOURS["CRITICAL"])
    verdict = ("✅ SYSTEM FULLY TESTED AND WORKING" if pct >= 95 else
               "⚠ PARTIAL FAILURES — ACTION REQUIRED" if pct >= 80 else
               "🚨 CRITICAL FAILURES DETECTED")

    elapsed = run_meta.get("elapsed_seconds", 0)

    # ── Previous run trend ────────────────────────────────────────────────────
    previous_pct = _load_previous_pass_rate(output_path)

    # ── Executive summary ─────────────────────────────────────────────────────
    exec_summary_html = _executive_summary_html(
        all_results, run_meta, pct, sev_counts, previous_pct, output_path)

    # ── Prioritization matrix ─────────────────────────────────────────────────
    priority_matrix_html = _prioritization_matrix_html(all_results)

    # ── AI findings section ───────────────────────────────────────────────────
    ai_findings_section = _ai_findings_html(all_results)

    # ── Suite rows ────────────────────────────────────────────────────────────
    suite_rows = ""
    for sname, data in suites.items():
        sp   = data["passed"]
        sf   = data["failed"]
        st   = sp + sf
        spct = round(sp / st * 100) if st > 0 else 100
        bar_colour = COLOURS["pass"] if spct == 100 else (COLOURS["MEDIUM"] if spct >= 80 else COLOURS["CRITICAL"])
        suite_rows += f"""
        <tr>
          <td style="padding:10px 16px;font-weight:600;color:{COLOURS['text']}">{sname}</td>
          <td style="padding:10px 16px;text-align:center;color:{COLOURS['pass']}">{sp}</td>
          <td style="padding:10px 16px;text-align:center;color:{COLOURS['fail'] if sf else COLOURS['muted']}">{sf}</td>
          <td style="padding:10px 16px">
            <div style="background:{COLOURS['border']};border-radius:4px;height:8px;width:120px">
              <div style="background:{bar_colour};height:8px;border-radius:4px;width:{spct}%"></div>
            </div>
            <span style="font-size:11px;color:{COLOURS['muted']}">{spct}%</span>
          </td>
        </tr>"""

    # ── Bug rows ──────────────────────────────────────────────────────────────
    bug_rows = ""
    for i, r in enumerate(bugs, 1):
        steps_html = ""
        if r.steps:
            steps_html = "<ol style='margin:4px 0;padding-left:16px;color:#94a3b8;font-size:12px'>"
            for s in r.steps:
                steps_html += f"<li>{s}</li>"
            steps_html += "</ol>"
        fix_html = (f'<div style="margin-top:4px;font-size:11px;color:#38bdf8">'
                    f'💡 Fix: {r.fix}</div>') if r.fix else ""
        detail_html = (f'<div style="margin-top:4px;font-size:11px;color:{COLOURS["muted"]};'
                       f'word-break:break-all">{r.detail[:200]}</div>') if r.detail else ""

        bug_rows += f"""
        <tr style="border-bottom:1px solid {COLOURS['border']}">
          <td style="padding:10px 8px;text-align:center;color:{COLOURS['muted']}">{i}</td>
          <td style="padding:10px 8px">{_sev_badge(r.severity.value)}</td>
          <td style="padding:10px 8px;color:{COLOURS['muted']}">{r.suite}</td>
          <td style="padding:10px 8px">
            <div style="font-weight:600;color:{COLOURS['text']}">{r.name}</div>
            <div style="color:#f87171;font-size:12px;margin-top:2px">{r.message}</div>
            {detail_html}{steps_html}{fix_html}
          </td>
          <td style="padding:10px 8px;text-align:center;color:{COLOURS['muted']};font-size:12px">
            {r.latency_ms}ms
          </td>
        </tr>"""

    if not bug_rows:
        bug_rows = f"""
        <tr><td colspan="5" style="padding:30px;text-align:center;color:{COLOURS['pass']};font-size:18px">
          ✅ No bugs found — all tests passed!
        </td></tr>"""

    # ── Chart data (JSON for inline Chart.js) ────────────────────────────────
    suite_labels  = json.dumps(list(suites.keys()))
    suite_pass    = json.dumps([v["passed"] for v in suites.values()])
    suite_fail    = json.dumps([v["failed"] for v in suites.values()])
    sev_labels    = json.dumps(list(sev_counts.keys()))
    sev_values    = json.dumps(list(sev_counts.values()))
    sev_colours   = json.dumps([COLOURS.get(s, "#888") for s in sev_counts.keys()])

    # ── KPI cards ─────────────────────────────────────────────────────────────
    kpi_cards = [
        ("Total Tests",  total,   COLOURS["text"]),
        ("Passed",       passed,  COLOURS["pass"]),
        ("Failed",       failed,  COLOURS["fail"] if failed else COLOURS["muted"]),
        ("Pass Rate",    f"{pct}%", status_colour),
        ("Duration",     f"{elapsed:.0f}s", COLOURS["muted"]),
        ("Critical Bugs",sev_counts["CRITICAL"], COLOURS["CRITICAL"] if sev_counts["CRITICAL"] else COLOURS["muted"]),
    ]
    kpi_html = ""
    for label, value, colour in kpi_cards:
        kpi_html += f"""
        <div style="background:{COLOURS['card']};border:1px solid {COLOURS['border']};
                    border-radius:12px;padding:20px 24px;min-width:140px;flex:1">
          <div style="font-size:13px;color:{COLOURS['muted']};margin-bottom:4px">{label}</div>
          <div style="font-size:32px;font-weight:700;color:{colour}">{value}</div>
        </div>"""

    # ── Performance section ───────────────────────────────────────────────────
    perf_html = ""
    perf_results = [r for r in all_results if r.suite == "performance" and r.latency_ms > 0]
    if perf_results:
        perf_html = "<h2 style='color:#f1f5f9;margin:32px 0 16px'>⚡ Performance Metrics</h2>"
        perf_html += f"""<div style="background:{COLOURS['card']};border:1px solid {COLOURS['border']};
                         border-radius:12px;padding:20px">
        <table style="width:100%;border-collapse:collapse">
        <tr style="color:{COLOURS['muted']};font-size:12px;text-transform:uppercase">
          <th style="text-align:left;padding:8px">Test</th>
          <th style="text-align:right;padding:8px">Latency</th>
          <th style="text-align:right;padding:8px">Status</th>
        </tr>"""
        for r in perf_results:
            c = COLOURS["pass"] if r.passed else COLOURS["fail"]
            perf_html += f"""<tr style="border-top:1px solid {COLOURS['border']}">
              <td style="padding:8px;color:{COLOURS['text']}">{r.name}</td>
              <td style="padding:8px;text-align:right;color:{COLOURS['muted']}">{r.latency_ms}ms</td>
              <td style="padding:8px;text-align:right;color:{c}">{'✓' if r.passed else '✗'}</td>
            </tr>"""
        perf_html += "</table></div>"

    # ── Full HTML ─────────────────────────────────────────────────────────────
    timestamp = run_meta.get("started_at", datetime.now().isoformat())
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shield QA Report — {timestamp[:10]}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  * {{ box-sizing:border-box; margin:0; padding:0 }}
  body {{ font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:{COLOURS['bg']};color:{COLOURS['text']};padding:32px }}
  table {{ width:100%;border-collapse:collapse }}
  th {{ text-align:left;padding:10px 16px;color:{COLOURS['muted']};
        font-size:11px;text-transform:uppercase;letter-spacing:.5px;
        border-bottom:1px solid {COLOURS['border']} }}
  a {{ color:#38bdf8;text-decoration:none }}
  @media print {{ body {{ background:#fff;color:#000 }} }}
</style>
</head>
<body>

<!-- Executive Summary -->
{exec_summary_html}

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px">
  <div>
    <h1 style="font-size:28px;font-weight:700">🛡 Shield Platform — QA Report</h1>
    <div style="color:{COLOURS['muted']};margin-top:4px">Generated: {timestamp} | Version: {run_meta.get('version','2.1.4')}</div>
  </div>
  <div style="background:{status_colour};color:#fff;padding:12px 24px;border-radius:8px;font-weight:700;font-size:16px">
    {verdict}
  </div>
</div>

<!-- KPI Cards -->
<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:32px">
  {kpi_html}
</div>

<!-- Charts Row -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px">
  <div style="background:{COLOURS['card']};border:1px solid {COLOURS['border']};
              border-radius:12px;padding:20px">
    <h3 style="margin-bottom:16px;color:{COLOURS['muted']};font-size:13px;text-transform:uppercase">
      Results by Test Suite
    </h3>
    <canvas id="suiteChart" height="220"></canvas>
  </div>
  <div style="background:{COLOURS['card']};border:1px solid {COLOURS['border']};
              border-radius:12px;padding:20px">
    <h3 style="margin-bottom:16px;color:{COLOURS['muted']};font-size:13px;text-transform:uppercase">
      Bug Severity Distribution
    </h3>
    <canvas id="sevChart" height="220"></canvas>
  </div>
</div>

<!-- Suite Summary Table -->
<h2 style="color:{COLOURS['text']};margin-bottom:16px">📋 Test Suite Summary</h2>
<div style="background:{COLOURS['card']};border:1px solid {COLOURS['border']};
            border-radius:12px;overflow:hidden;margin-bottom:32px">
  <table>
    <tr>
      <th>Suite</th><th>Passed</th><th>Failed</th><th>Coverage</th>
    </tr>
    {suite_rows}
  </table>
</div>

<!-- Bug Report -->
<h2 style="color:{COLOURS['text']};margin-bottom:16px">🐛 Bug Report ({len(bugs)} issues)</h2>
<div style="background:{COLOURS['card']};border:1px solid {COLOURS['border']};
            border-radius:12px;overflow:hidden;margin-bottom:32px">
  <table>
    <tr>
      <th style="width:40px">#</th>
      <th style="width:100px">Severity</th>
      <th style="width:120px">Suite</th>
      <th>Issue</th>
      <th style="width:80px">Latency</th>
    </tr>
    {bug_rows}
  </table>
</div>

{perf_html}

{priority_matrix_html}

{ai_findings_section}

<!-- Footer -->
<div style="margin-top:40px;padding-top:20px;border-top:1px solid {COLOURS['border']};
            color:{COLOURS['muted']};font-size:12px;display:flex;justify-content:space-between">
  <span>Shield QA Agent v1.0 | {timestamp}</span>
  <span>Total run time: {elapsed:.1f}s</span>
</div>

<script>
const grid = {{ color: 'rgba(255,255,255,0.08)' }};
const tick  = {{ color: '#94a3b8' }};

new Chart(document.getElementById('suiteChart'), {{
  type: 'bar',
  data: {{
    labels: {suite_labels},
    datasets: [
      {{ label:'Passed', data:{suite_pass}, backgroundColor:'{COLOURS["pass"]}', borderRadius:4 }},
      {{ label:'Failed', data:{suite_fail}, backgroundColor:'{COLOURS["fail"]}', borderRadius:4 }}
    ]
  }},
  options: {{
    responsive:true, plugins:{{ legend:{{ labels:{{ color:'#94a3b8' }} }} }},
    scales: {{
      x:{{ grid, ticks:{{ ...tick, maxRotation:30 }} }},
      y:{{ grid, ticks:tick, stacked:false }}
    }}
  }}
}});

new Chart(document.getElementById('sevChart'), {{
  type: 'doughnut',
  data: {{
    labels: {sev_labels},
    datasets: [{{ data:{sev_values}, backgroundColor:{sev_colours}, borderWidth:0 }}]
  }},
  options: {{
    responsive:true, cutout:'65%',
    plugins:{{ legend:{{ position:'right', labels:{{ color:'#94a3b8', boxWidth:12 }} }} }}
  }}
}});
</script>

</body>
</html>"""

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        f.write(html)

    return output_path
