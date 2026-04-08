"""
Suite: Service Health
Tests actuator/health for all 12 Shield microservices.
"""
import requests
from .base import TestSuite, Severity


class HealthSuite(TestSuite):
    name = "health"

    def run(self):
        print("\n── Service Health ───────────────────────────────────────")
        svcs = self.config["services"]

        for svc_name, svc in svcs.items():
            port = svc["port"]
            system_name = svc["name"]
            url = f"http://localhost:{port}/actuator/health"
            try:
                r = requests.get(url, timeout=5)
                status = r.json().get("status", "UNKNOWN") if r.status_code == 200 else f"HTTP_{r.status_code}"
                ok = status == "UP"
                lat = int(r.elapsed.total_seconds() * 1000)
                self.assert_ok(
                    f"{svc_name} ({port})", ok,
                    f"status={status}" if not ok else f"UP ({lat}ms)",
                    severity=Severity.CRITICAL if not ok else Severity.INFO,
                    fix=f"systemctl restart {system_name}" if not ok else ""
                )
            except Exception as e:
                self.assert_ok(
                    f"{svc_name} ({port})", False,
                    f"Connection refused / unreachable",
                    severity=Severity.CRITICAL,
                    fix=f"systemctl start {system_name}"
                )

        return self.results
