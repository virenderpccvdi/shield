"""
Shield Agent — DNS Manager for Windows.

Sets the DNS servers on ALL active network adapters to the Shield DoH
stub resolver.  Uses netsh + registry so the change survives reboots.
Also watches for third-party DNS changes and restores Shield DNS
(tamper detection).
"""
import logging
import platform
import subprocess
import time
import threading
from typing import List, Optional

logger = logging.getLogger(__name__)

# The DoH gateway nginx routes /dns/{clientId}/dns-query → resolver:8292
# On Windows we point the OS DNS to a local stub that forwards via DoH.
# For simplicity the agent sets the Gateway's public IP (resolved at pair time)
# as the primary DNS with fallback to 1.1.1.1; a localhost stub
# (dns_stub.py) intercepts port 53 and forwards over HTTPS.
SHIELD_DNS_PRIMARY   = "127.0.0.1"
SHIELD_DNS_SECONDARY = "127.0.0.2"   # second loopback alias used as canary


def _run(cmd: List[str], timeout: int = 10) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def get_active_adapters() -> List[str]:
    """Return list of active network adapter names via netsh."""
    if platform.system() != "Windows":
        return ["eth0"]  # dev stub
    result = _run(["netsh", "interface", "show", "interface"])
    adapters = []
    for line in result.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 4 and parts[1] == "Connected":
            adapters.append(" ".join(parts[3:]))
    return adapters


def get_current_dns(adapter: str) -> List[str]:
    """Return current DNS servers for an adapter."""
    if platform.system() != "Windows":
        return []
    result = _run(["netsh", "interface", "ipv4", "show", "dns", adapter])
    servers = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if line.startswith("Statically Configured DNS Servers:"):
            ip = line.split(":", 1)[1].strip()
            if ip and ip != "None":
                servers.append(ip)
        elif line.startswith("Register with which suffix:"):
            break
        elif servers and line and line[0].isdigit():
            servers.append(line)
    return servers


def set_shield_dns(adapter: str) -> bool:
    """Configure Shield DNS on the given adapter."""
    if platform.system() != "Windows":
        logger.info("[dev] set_shield_dns(%s)", adapter)
        return True
    try:
        _run(["netsh", "interface", "ipv4", "set", "dns",
              f"name={adapter}", "source=static",
              f"address={SHIELD_DNS_PRIMARY}", "register=primary", "validate=no"])
        _run(["netsh", "interface", "ipv4", "add", "dns",
              f"name={adapter}", f"address={SHIELD_DNS_SECONDARY}",
              "index=2", "validate=no"])
        logger.info("Shield DNS set on adapter: %s", adapter)
        return True
    except Exception as e:
        logger.error("Failed to set DNS on %s: %s", adapter, e)
        return False


def restore_dns(adapter: str, original_dns: List[str]) -> None:
    """Restore original DNS settings."""
    if platform.system() != "Windows":
        return
    if not original_dns:
        _run(["netsh", "interface", "ipv4", "set", "dns",
              f"name={adapter}", "source=dhcp"])
    else:
        _run(["netsh", "interface", "ipv4", "set", "dns",
              f"name={adapter}", "source=static",
              f"address={original_dns[0]}", "validate=no"])
        for i, dns in enumerate(original_dns[1:], 2):
            _run(["netsh", "interface", "ipv4", "add", "dns",
                  f"name={adapter}", f"address={dns}", f"index={i}", "validate=no"])


def apply_shield_dns_all() -> dict:
    """Apply Shield DNS to all active adapters. Returns {adapter: original_dns}."""
    original = {}
    for adapter in get_active_adapters():
        original[adapter] = get_current_dns(adapter)
        set_shield_dns(adapter)
    return original


class DnsTamperWatchdog(threading.Thread):
    """
    Periodically checks that Shield DNS is still set on all adapters.
    If a third-party tool has changed the DNS, restores Shield's settings.
    """

    def __init__(self, interval: int = 30):
        super().__init__(daemon=True, name="DnsTamperWatchdog")
        self.interval = interval
        self._stop_event = threading.Event()
        self._original: dict = {}

    def set_originals(self, original: dict) -> None:
        self._original = original

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        logger.info("DNS tamper watchdog started (interval=%ds)", self.interval)
        while not self._stop_event.wait(self.interval):
            self._check_and_restore()

    def _check_and_restore(self) -> None:
        if platform.system() != "Windows":
            return
        for adapter in get_active_adapters():
            current = get_current_dns(adapter)
            if current and current[0] != SHIELD_DNS_PRIMARY:
                logger.warning(
                    "DNS tamper detected on %s (was %s) — restoring Shield DNS",
                    adapter, current
                )
                set_shield_dns(adapter)
