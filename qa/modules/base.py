"""
Shield QA — Base test infrastructure
Provides TestSuite base class, TestResult, and shared utilities.
"""
import json, time, traceback, requests
from datetime import datetime
from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH     = "HIGH"
    MEDIUM   = "MEDIUM"
    LOW      = "LOW"
    INFO     = "INFO"


@dataclass
class TestResult:
    name:       str
    suite:      str
    passed:     bool
    severity:   Severity = Severity.HIGH
    message:    str = ""
    detail:     str = ""
    latency_ms: int = 0
    timestamp:  str = field(default_factory=lambda: datetime.now().isoformat())
    steps:      List[str] = field(default_factory=list)
    fix:        str = ""

    def to_dict(self):
        return {
            "name": self.name, "suite": self.suite,
            "passed": self.passed, "severity": self.severity.value,
            "message": self.message, "detail": self.detail,
            "latency_ms": self.latency_ms, "timestamp": self.timestamp,
            "steps": self.steps, "fix": self.fix
        }


class TestSuite:
    """Base class for all QA test suites."""

    name = "base"

    def __init__(self, config: dict, session: requests.Session, jwt: str = ""):
        self.config  = config
        self.session = session
        self.jwt     = jwt
        self.base    = config["base_url"]
        self.results: List[TestResult] = []
        self._hdrs   = {"Authorization": f"Bearer {jwt}", "Content-Type": "application/json"}

    # ── Assertion helpers ──────────────────────────────────────────────────────

    def assert_ok(self, name: str, condition: bool, msg: str,
                  severity=Severity.HIGH, detail="", fix="", latency=0,
                  steps: List[str] = None):
        r = TestResult(
            name=name, suite=self.name, passed=condition,
            severity=severity, message=msg if not condition else f"{name} — OK",
            detail=detail if not condition else "",
            latency_ms=latency, steps=steps or [], fix=fix
        )
        self.results.append(r)
        status = "✓" if condition else "✗"
        sev    = "" if condition else f" [{severity.value}]"
        print(f"  {status}{sev} {name}: {r.message}", flush=True)
        return condition

    def assert_status(self, name: str, r, expected=200, severity=Severity.HIGH,
                      fix="", steps=None):
        ok  = r is not None and r.status_code == expected
        msg = (f"HTTP {r.status_code if r else 'NO_RESPONSE'} "
               f"(expected {expected})") if not ok else f"HTTP {expected}"
        lat = int(r.elapsed.total_seconds() * 1000) if r else 0
        return self.assert_ok(name, ok, msg, severity,
                              detail=r.text[:500] if r else "", fix=fix,
                              latency=lat, steps=steps)

    # ── HTTP helpers ───────────────────────────────────────────────────────────

    def get(self, path, params=None, headers=None, timeout=10):
        for attempt in range(2):
            try:
                h = {**self._hdrs, **(headers or {})}
                return self.session.get(f"{self.base}{path}", headers=h,
                                        params=params, timeout=timeout)
            except Exception:
                if attempt == 0:
                    import time; time.sleep(0.5)
        return None

    def post(self, path, body=None, headers=None, timeout=10):
        for attempt in range(2):
            try:
                h = {**self._hdrs, **(headers or {})}
                return self.session.post(f"{self.base}{path}", headers=h,
                                         json=body, timeout=timeout)
            except Exception:
                if attempt == 0:
                    import time; time.sleep(0.5)  # brief pause before retry
        return None

    def direct(self, port, path, params=None, timeout=10):
        """Hit a service directly (bypass gateway)."""
        try:
            h = {**self._hdrs}
            url = f"http://localhost:{port}{path}"
            return self.session.get(url, headers=h, params=params, timeout=timeout)
        except Exception:
            return None

    def json_data(self, r):
        if r is None:
            return {}
        try:
            d = r.json()
            return d.get("data", d)
        except:
            return {}

    # ── To be implemented by subclass ─────────────────────────────────────────

    def run(self) -> List[TestResult]:
        raise NotImplementedError
