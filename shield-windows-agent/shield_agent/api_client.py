"""
Shield Agent — Backend API client.
All calls go through the Shield gateway (HTTPS).
JWT token is stored in SecureStore and refreshed automatically.
"""
import json
import logging
import time
import urllib.request
import urllib.error
import urllib.parse
import ssl
from typing import Any, Optional

from .config import GATEWAY_URL

logger = logging.getLogger(__name__)

_ssl_ctx = ssl.create_default_context()


def _request(
    method: str,
    path: str,
    body: Optional[dict] = None,
    token: Optional[str] = None,
    timeout: int = 10,
) -> tuple[int, Any]:
    """Low-level HTTP request. Returns (status_code, parsed_body)."""
    url  = f"{GATEWAY_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "ShieldWindowsAgent/1.0")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_ssl_ctx) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            body_err = json.loads(raw)
        except Exception:
            body_err = {"error": raw.decode(errors="replace")}
        return e.code, body_err
    except Exception as e:
        logger.debug("API request failed %s %s: %s", method, path, e)
        return -1, {"error": str(e)}


class ShieldApiClient:
    """Stateful API client with auto token refresh."""

    def __init__(self, store):
        """
        store: SecureStore instance for persisting tokens/config.
        """
        self._store     = store
        self._cfg: dict = store.load()
        self._token: Optional[str] = self._cfg.get("access_token")
        self._token_exp: float     = self._cfg.get("token_exp", 0.0)

    # ── Authentication ─────────────────────────────────────────────────────────
    def login(self, email: str, password: str) -> bool:
        """Obtain JWT via the auth service."""
        status, body = _request("POST", "/api/v1/auth/login",
                                 {"email": email, "password": password})
        if status == 200:
            data = body.get("data", body)
            self._token     = data.get("accessToken") or data.get("access_token")
            self._token_exp = time.time() + 3600 * 23  # refresh before 24h
            self._cfg.update({
                "access_token": self._token,
                "token_exp":    self._token_exp,
                "email":        email,
            })
            self._store.save(self._cfg)
            logger.info("Login successful for %s", email)
            return True
        logger.error("Login failed: %d %s", status, body)
        return False

    def _ensure_token(self) -> bool:
        if self._token and time.time() < self._token_exp:
            return True
        email    = self._cfg.get("email")
        password = self._cfg.get("password_hint")
        if not email:
            logger.error("No stored credentials for token refresh")
            return False
        # Re-login
        return self.login(email, password or "")

    # ── Device pairing ─────────────────────────────────────────────────────────
    def pair_device(self, pairing_code: str, device_name: str) -> Optional[dict]:
        """
        Pair this Windows device with a child profile using the 6-digit
        pairing code displayed in the parent app / dashboard.
        Returns profile info dict on success.
        """
        if not self._ensure_token():
            return None
        status, body = _request(
            "POST",
            "/api/v1/profile/devices/pair",
            {"pairingCode": pairing_code, "deviceName": device_name,
             "platform": "windows", "agentVersion": "1.0.0"},
            token=self._token,
        )
        if status == 200:
            data = body.get("data", body)
            logger.info("Device paired: %s", data)
            self._cfg.update({
                "profile_id":   data.get("profileId"),
                "dns_client_id": data.get("dnsClientId"),
                "child_name":   data.get("name"),
                "device_id":    data.get("deviceId"),
            })
            self._store.save(self._cfg)
            return data
        logger.error("Pairing failed: %d %s", status, body)
        return None

    # ── Policy / rules ──────────────────────────────────────────────────────────
    def get_dns_status(self, profile_id: str) -> dict:
        if not self._ensure_token():
            return {}
        status, body = _request(
            "GET",
            f"/api/v1/dns/{profile_id}/status",
            token=self._token,
        )
        return body.get("data", {}) if status == 200 else {}

    def get_dns_rules(self, profile_id: str) -> dict:
        if not self._ensure_token():
            return {}
        status, body = _request(
            "GET",
            f"/api/v1/dns/rules/{profile_id}",
            token=self._token,
        )
        return body.get("data", {}) if status == 200 else {}

    def get_budget_status(self, profile_id: str) -> dict:
        if not self._ensure_token():
            return {}
        status, body = _request(
            "GET",
            f"/api/v1/dns/budgets/{profile_id}/status",
            token=self._token,
        )
        return body.get("data", {}) if status == 200 else {}

    # ── Heartbeat / reporting ──────────────────────────────────────────────────
    def send_heartbeat(self, profile_id: str, device_id: str, metrics: dict) -> bool:
        if not self._ensure_token():
            return False
        payload = {
            "profileId":   profile_id,
            "deviceId":    device_id,
            "platform":    "windows",
            "agentVersion": "1.0.0",
            **metrics,
        }
        status, _ = _request(
            "POST",
            f"/api/v1/profile/devices/{device_id}/heartbeat",
            payload,
            token=self._token,
        )
        return status in (200, 201, 204)

    def report_dns_queries(self, profile_id: str, queries: list) -> bool:
        """Batch-report DNS query events to backend for analytics."""
        if not queries or not self._ensure_token():
            return False
        status, _ = _request(
            "POST",
            f"/api/v1/dns/internal/batch-log",
            {"profileId": profile_id, "queries": queries},
            token=self._token,
        )
        return status in (200, 201, 204)

    # ── Getters ────────────────────────────────────────────────────────────────
    @property
    def profile_id(self) -> Optional[str]:
        return self._cfg.get("profile_id")

    @property
    def dns_client_id(self) -> Optional[str]:
        return self._cfg.get("dns_client_id")

    @property
    def device_id(self) -> Optional[str]:
        return self._cfg.get("device_id")

    @property
    def child_name(self) -> Optional[str]:
        return self._cfg.get("child_name", "Child")

    @property
    def is_paired(self) -> bool:
        return bool(self._cfg.get("profile_id") and self._cfg.get("dns_client_id"))

    def reload(self) -> None:
        self._cfg       = self._store.load()
        self._token     = self._cfg.get("access_token")
        self._token_exp = self._cfg.get("token_exp", 0.0)
