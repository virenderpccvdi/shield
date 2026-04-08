"""
Suite: Playwright UI Testing (React Dashboard)
Runs shield_ui_tests.mjs via Node.js and converts results to TestResult objects.

Prerequisites:
  npm install -g @playwright/test
  npx playwright install chromium
  (or: npm install playwright && npx playwright install chromium)

Falls back gracefully if Playwright/Node is not available.
"""
import json, os, subprocess, sys
from pathlib import Path
from .base import TestSuite, Severity, TestResult


PLAYWRIGHT_SCRIPT = Path(__file__).parent.parent / "playwright" / "shield_ui_tests.mjs"
CONFIG_PATH       = Path(__file__).parent.parent / "config.json"


def _find_node():
    for candidate in ["node", "/usr/bin/node", "/usr/local/bin/node"]:
        try:
            r = subprocess.run([candidate, "--version"], capture_output=True, timeout=5)
            if r.returncode == 0:
                return candidate
        except Exception:
            pass
    return None


def _playwright_installed():
    """Check if playwright is importable via node."""
    node = _find_node()
    if not node:
        return False
    try:
        r = subprocess.run(
            [node, "-e", "require('@playwright/test'); process.exit(0)"],
            capture_output=True, timeout=10
        )
        if r.returncode == 0:
            return True
        # Try npx resolution
        r2 = subprocess.run(
            ["npx", "--yes", "playwright", "--version"],
            capture_output=True, timeout=30
        )
        return r2.returncode == 0
    except Exception:
        return False


class PlaywrightUISuite(TestSuite):
    name = "playwright_ui"

    def _install_playwright(self):
        """Attempt to install Playwright if missing."""
        print("    Installing Playwright (first run)...", flush=True)
        try:
            r = subprocess.run(
                ["npx", "--yes", "playwright", "install", "chromium", "--with-deps"],
                capture_output=True, text=True, timeout=120
            )
            return r.returncode == 0
        except Exception as e:
            return False

    def run(self):
        print("\n── Playwright UI ────────────────────────────────────────")

        node = _find_node()
        if not node:
            self.assert_ok("Node.js available for Playwright",
                           False,
                           "Node.js not found — skipping UI tests",
                           severity=Severity.INFO,
                           fix="Install Node.js: apt install nodejs npm")
            return self.results

        if not PLAYWRIGHT_SCRIPT.exists():
            self.assert_ok("Playwright test script exists",
                           False,
                           f"Script not found: {PLAYWRIGHT_SCRIPT}",
                           severity=Severity.INFO)
            return self.results

        # Check if playwright package is available; install if not
        if not _playwright_installed():
            installed = self._install_playwright()
            if not installed:
                self.assert_ok("Playwright installed",
                               False,
                               "Could not install Playwright — run: npx playwright install chromium",
                               severity=Severity.INFO,
                               fix="cd /var/www/ai/FamilyShield/qa && npx playwright install chromium")
                return self.results

        # Run the test script
        print("    Launching headless Chrome...", flush=True)
        try:
            env = {**os.environ, "NODE_PATH": "/usr/lib/node_modules"}
            r = subprocess.run(
                [node, str(PLAYWRIGHT_SCRIPT),
                 "--config", str(CONFIG_PATH)],
                capture_output=True, text=True, timeout=180,
                env=env
            )

            # Parse JSON output from stdout
            stdout = r.stdout.strip()
            if not stdout:
                self.assert_ok("Playwright tests produced output",
                               False,
                               f"No output. stderr: {r.stderr[:500]}",
                               severity=Severity.HIGH,
                               fix="Check Node.js/Playwright installation; run: node qa/playwright/shield_ui_tests.mjs manually")
                return self.results

            # Find the JSON array in stdout (may have some leading text)
            json_start = stdout.find("[")
            if json_start == -1:
                self.assert_ok("Playwright output is valid JSON",
                               False,
                               f"Non-JSON output: {stdout[:300]}",
                               severity=Severity.HIGH)
                return self.results

            ui_results = json.loads(stdout[json_start:])

        except subprocess.TimeoutExpired:
            self.assert_ok("Playwright tests completed in time",
                           False,
                           "Playwright timed out after 180s",
                           severity=Severity.HIGH,
                           fix="Increase timeout or reduce number of UI tests")
            return self.results
        except json.JSONDecodeError as e:
            self.assert_ok("Playwright output parseable",
                           False,
                           f"JSON parse error: {e}",
                           severity=Severity.HIGH)
            return self.results
        except Exception as e:
            self.assert_ok("Playwright runner launched",
                           False,
                           f"Failed to run Playwright: {e}",
                           severity=Severity.HIGH)
            return self.results

        # Convert UI results to TestResult objects
        passed_count = 0
        for ui in ui_results:
            name      = ui.get("name", "Unknown test")
            passed    = ui.get("passed", False)
            message   = ui.get("message", "")
            latency   = ui.get("latency_ms", 0)
            steps     = ui.get("steps", [])

            if passed:
                passed_count += 1

            # Assign severity based on test name content
            sev = Severity.HIGH
            if "load time" in name.lower() or "performance" in name.lower():
                sev = Severity.MEDIUM
            elif "404" in name or "renders" in name:
                sev = Severity.HIGH
            elif "login" in name.lower() and "invalid" in name.lower():
                sev = Severity.HIGH
            elif "protected" in name.lower() or "auth" in name.lower():
                sev = Severity.CRITICAL

            result = TestResult(
                name=name,
                suite=self.name,
                passed=passed,
                severity=sev,
                message=message if not passed else f"{name} — OK",
                latency_ms=latency,
                steps=steps,
                fix="Check browser console and screenshot in qa/screenshots/" if not passed else "",
            )
            self.results.append(result)
            icon = "✓" if passed else "✗"
            sev_tag = f" [{sev.value}]" if not passed else ""
            print(f"  {icon}{sev_tag} {name}: {result.message[:80]}", flush=True)

        total = len(ui_results)
        print(f"  {passed_count}/{total} UI tests passed", flush=True)

        return self.results
