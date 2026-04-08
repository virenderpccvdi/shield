from .test_health       import HealthSuite
from .test_auth         import AuthSuite
from .test_rbac         import RbacSuite
from .test_dns          import DnsSuite
from .test_analytics    import AnalyticsSuite
from .test_ai           import AiSuite
from .test_billing      import BillingSuite
from .test_dashboard    import DashboardSuite
from .test_db           import DatabaseSuite
from .test_performance  import PerformanceSuite
from .test_security     import SecuritySuite
from .test_workflows    import WorkflowSuite

# Advanced suites (Phase 2+)
from .test_owasp_extended   import OwaspExtendedSuite
from .test_ai_gap_analysis  import AiGapAnalysisSuite
from .test_playwright_ui    import PlaywrightUISuite
from .test_k6_performance   import K6PerformanceSuite
from .test_reporting_analytics import ReportingAnalyticsSuite

SUITES = {
    # ── Core suites (always run) ─────────────────────────────────
    "health":           HealthSuite,
    "auth":             AuthSuite,
    "rbac":             RbacSuite,
    "dns":              DnsSuite,
    "analytics":        AnalyticsSuite,
    "ai_insights":      AiSuite,
    "billing":          BillingSuite,
    "dashboard":        DashboardSuite,
    "db":               DatabaseSuite,
    "workflows":        WorkflowSuite,
    "performance":      PerformanceSuite,
    "security":         SecuritySuite,

    # ── Advanced suites ──────────────────────────────────────────
    "owasp_extended":   OwaspExtendedSuite,
    "playwright_ui":    PlaywrightUISuite,
    "k6_performance":   K6PerformanceSuite,
    "ai_gap_analysis":  AiGapAnalysisSuite,
    "reporting_analytics": ReportingAnalyticsSuite,
}
