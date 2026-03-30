"""
Shield Agent — Windows Service wrapper (via pywin32 / win32serviceutil).

Installs as "ShieldAgent" SYSTEM service that auto-starts on boot.
On non-Windows it runs as a foreground daemon for development.
"""
import logging
import os
import platform
import sys
import time
import threading

from .config import (
    APP_NAME, CONFIG_FILE, LOG_FILE,
    HEARTBEAT_INTERVAL, REPORT_INTERVAL, POLICY_SYNC_INTERVAL,
    WATCHDOG_INTERVAL, SERVICE_NAME, SERVICE_DISPLAY, SERVICE_DESC,
)
from .crypto_store  import SecureStore
from .api_client    import ShieldApiClient
from .dns_manager   import DnsTamperWatchdog, apply_shield_dns_all
from .dns_stub      import DnsStub
from .monitor       import ActivityMonitor

logger = logging.getLogger(__name__)


def setup_logging() -> None:
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    logging.basicConfig(
        level=logging.INFO,
        format=fmt,
        handlers=[
            logging.FileHandler(LOG_FILE, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )


class AgentCore:
    """
    Core agent logic shared between Windows Service and foreground runner.
    """

    def __init__(self):
        self.store    = SecureStore(CONFIG_FILE)
        self.api      = ShieldApiClient(self.store)
        self.monitor  = ActivityMonitor()
        self.dns_stub: DnsStub | None         = None
        self.watchdog: DnsTamperWatchdog | None = None
        self._stop    = threading.Event()

    def start(self) -> None:
        logger.info("%s starting…", APP_NAME)

        if not self.api.is_paired:
            logger.warning("Agent is not paired with a child profile. "
                           "Run 'shield-agent pair <CODE>' first.")
            # Keep running so the service doesn't crash — pair can happen later
        else:
            self._activate_dns()

        self.monitor.start_polling()

        # Periodic tasks
        threading.Thread(target=self._heartbeat_loop, daemon=True,
                         name="HeartbeatLoop").start()
        threading.Thread(target=self._report_loop, daemon=True,
                         name="ReportLoop").start()
        threading.Thread(target=self._policy_loop, daemon=True,
                         name="PolicyLoop").start()

        logger.info("%s running.", APP_NAME)

    def _activate_dns(self) -> None:
        client_id = self.api.dns_client_id
        if not client_id:
            return

        # Start local stub
        self.dns_stub = DnsStub(client_id)
        self.dns_stub.start()
        time.sleep(1)  # let stub bind

        # Point OS DNS to stub
        originals = apply_shield_dns_all()

        # Start tamper watchdog
        self.watchdog = DnsTamperWatchdog(interval=WATCHDOG_INTERVAL)
        self.watchdog.set_originals(originals)
        self.watchdog.start()
        logger.info("DNS filtering active (client_id=%s)", client_id)

    def stop(self) -> None:
        logger.info("%s stopping…", APP_NAME)
        self._stop.set()
        if self.watchdog:
            self.watchdog.stop()
        if self.dns_stub:
            self.dns_stub.stop()
        self.monitor.stop()

    # ── Background loops ───────────────────────────────────────────────────────
    def _heartbeat_loop(self) -> None:
        while not self._stop.wait(HEARTBEAT_INTERVAL):
            if not self.api.is_paired:
                continue
            metrics = self.monitor.get_metrics()
            ok = self.api.send_heartbeat(
                self.api.profile_id,
                self.api.device_id,
                metrics,
            )
            if not ok:
                logger.debug("Heartbeat failed — will retry")

    def _report_loop(self) -> None:
        while not self._stop.wait(REPORT_INTERVAL):
            if not self.api.is_paired:
                continue
            queries = self.monitor.drain_queries()
            if queries:
                ok = self.api.report_dns_queries(self.api.profile_id, queries)
                logger.info("Reported %d DNS queries (ok=%s)", len(queries), ok)

    def _policy_loop(self) -> None:
        while not self._stop.wait(POLICY_SYNC_INTERVAL):
            if not self.api.is_paired:
                # Re-check pairing state in case pair happened via CLI
                self.api.reload()
                if self.api.is_paired and not self.dns_stub:
                    self._activate_dns()
                continue
            status = self.api.get_dns_status(self.api.profile_id)
            if status.get("paused") and self.dns_stub:
                logger.info("DNS filtering paused by parent")
            elif not status.get("paused") and self.dns_stub:
                pass  # still active
            # Update client_id if it changed
            new_cid = self.api.dns_client_id
            if self.dns_stub and new_cid and new_cid != self.dns_stub.client_id:
                self.dns_stub.update_client_id(new_cid)


# ── Windows Service ────────────────────────────────────────────────────────────
if platform.system() == "Windows":
    try:
        import win32service
        import win32serviceutil
        import win32event
        import servicemanager

        class ShieldWindowsService(win32serviceutil.ServiceFramework):
            _svc_name_        = SERVICE_NAME
            _svc_display_name_ = SERVICE_DISPLAY
            _svc_description_  = SERVICE_DESC

            def __init__(self, args):
                win32serviceutil.ServiceFramework.__init__(self, args)
                self._hstop = win32event.CreateEvent(None, 0, 0, None)
                self._agent = AgentCore()

            def SvcStop(self):
                self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
                self._agent.stop()
                win32event.SetEvent(self._hstop)

            def SvcDoRun(self):
                servicemanager.LogMsg(
                    servicemanager.EVENTLOG_INFORMATION_TYPE,
                    servicemanager.PYS_SERVICE_STARTED,
                    (self._svc_name_, ""),
                )
                self._agent.start()
                win32event.WaitForSingleObject(self._hstop, win32event.INFINITE)

    except ImportError:
        # pywin32 not available
        ShieldWindowsService = None
else:
    ShieldWindowsService = None


# ── Entry point for foreground / dev mode ─────────────────────────────────────
def run_foreground() -> None:
    setup_logging()
    agent = AgentCore()
    agent.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        agent.stop()
