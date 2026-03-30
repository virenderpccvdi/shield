"""
Shield Agent — Activity monitor.
Tracks:
  - Active window / app name (for app-usage reporting)
  - Internet connectivity state
  - Screen-on time
  - DNS query intercept log (populated by DnsStub)

All data is queued and flushed to the backend by the main agent loop.
"""
import collections
import platform
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Deque, Optional

logger = logging.getLogger(__name__)

MAX_QUEUE = 2000


class QueryRecord:
    __slots__ = ("domain", "action", "category", "ts")

    def __init__(self, domain: str, action: str, category: str = ""):
        self.domain   = domain
        self.action   = action
        self.category = category
        self.ts       = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return {
            "domain":   self.domain,
            "action":   self.action,
            "category": self.category,
            "queriedAt": self.ts,
        }


class ActivityMonitor:
    """Thread-safe activity monitor."""

    def __init__(self):
        self._lock: threading.Lock = threading.Lock()
        self._query_queue: Deque[QueryRecord] = collections.deque(maxlen=MAX_QUEUE)
        self._screen_start: Optional[float]   = time.monotonic()
        self._screen_minutes: float            = 0.0
        self._active_app: str                  = ""
        self._app_usage: dict[str, float]      = {}  # app → minutes
        self._running = False

    # ── DNS query tracking (called by DnsStub) ─────────────────────────────────
    def record_query(self, domain: str, action: str, category: str = "") -> None:
        with self._lock:
            self._query_queue.append(QueryRecord(domain, action, category))

    def drain_queries(self) -> list:
        with self._lock:
            items = [q.to_dict() for q in self._query_queue]
            self._query_queue.clear()
            return items

    # ── Active window tracking ─────────────────────────────────────────────────
    def _poll_active_window(self) -> None:
        """Windows-only: get foreground window process name."""
        if platform.system() != "Windows":
            return
        try:
            import ctypes
            import ctypes.wintypes as wt
            user32   = ctypes.windll.user32
            psapi    = ctypes.windll.psapi
            kernel32 = ctypes.windll.kernel32
            hwnd = user32.GetForegroundWindow()
            if not hwnd:
                return
            pid = wt.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            h = kernel32.OpenProcess(0x0410, False, pid)
            buf = ctypes.create_unicode_buffer(260)
            psapi.GetModuleFileNameExW(h, None, buf, 260)
            kernel32.CloseHandle(h)
            name = buf.value.split("\\")[-1].lower().replace(".exe", "")
            with self._lock:
                if name and name != self._active_app:
                    self._active_app = name
                if name:
                    self._app_usage[name] = self._app_usage.get(name, 0) + (5 / 60)
        except Exception:
            pass

    def get_app_usage_snapshot(self) -> dict:
        with self._lock:
            return dict(self._app_usage)

    def reset_app_usage(self) -> dict:
        with self._lock:
            snap = dict(self._app_usage)
            self._app_usage.clear()
            return snap

    # ── Screen time ────────────────────────────────────────────────────────────
    def get_screen_minutes(self) -> float:
        with self._lock:
            elapsed = 0.0
            if self._screen_start is not None:
                elapsed = (time.monotonic() - self._screen_start) / 60
            return round(self._screen_minutes + elapsed, 1)

    # ── Metrics snapshot (for heartbeat) ──────────────────────────────────────
    def get_metrics(self) -> dict:
        return {
            "screenMinutes": self.get_screen_minutes(),
            "activeApp":     self._active_app,
            "queryCount":    len(self._query_queue),
        }

    # ── Background polling ─────────────────────────────────────────────────────
    def start_polling(self) -> None:
        if self._running:
            return
        self._running = True
        t = threading.Thread(target=self._poll_loop, daemon=True, name="ActivityMonitor")
        t.start()

    def _poll_loop(self) -> None:
        while self._running:
            self._poll_active_window()
            time.sleep(5)

    def stop(self) -> None:
        self._running = False
