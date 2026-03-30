"""
Shield Agent — Encrypted credential store.
Uses Windows DPAPI (via pywin32) to encrypt the config blob so only
the local SYSTEM account can decrypt it.  Falls back to Fernet
(with a machine-derived key) when running outside Windows.
"""
import os
import json
import base64
import hashlib
import platform
import logging

logger = logging.getLogger(__name__)

# ── DPAPI wrapper ──────────────────────────────────────────────────────────────
def _dpapi_encrypt(data: bytes) -> bytes:
    import win32crypt
    return win32crypt.CryptProtectData(data, "ShieldAgentConfig", None, None, None,
                                        0x04)  # CRYPTPROTECT_LOCAL_MACHINE


def _dpapi_decrypt(blob: bytes) -> bytes:
    import win32crypt
    _, decrypted = win32crypt.CryptUnprotectData(blob, None, None, None, 0)
    return decrypted


# ── Fernet fallback (non-Windows / dev) ───────────────────────────────────────
def _machine_key() -> bytes:
    """Derive a 32-byte key from stable machine identifiers."""
    seed = platform.node() + platform.machine() + "ShieldAgentSalt2026"
    return hashlib.sha256(seed.encode()).digest()


def _fernet_encrypt(data: bytes) -> bytes:
    from cryptography.fernet import Fernet
    key = base64.urlsafe_b64encode(_machine_key())
    return Fernet(key).encrypt(data)


def _fernet_decrypt(blob: bytes) -> bytes:
    from cryptography.fernet import Fernet
    key = base64.urlsafe_b64encode(_machine_key())
    return Fernet(key).decrypt(blob)


# ── Public API ─────────────────────────────────────────────────────────────────
def encrypt(data: bytes) -> bytes:
    if platform.system() == "Windows":
        try:
            return _dpapi_encrypt(data)
        except Exception as e:
            logger.warning("DPAPI encrypt failed, using fallback: %s", e)
    return _fernet_encrypt(data)


def decrypt(blob: bytes) -> bytes:
    if platform.system() == "Windows":
        try:
            return _dpapi_decrypt(blob)
        except Exception as e:
            logger.warning("DPAPI decrypt failed, using fallback: %s", e)
    return _fernet_decrypt(blob)


class SecureStore:
    """Persist and retrieve agent credentials / profile config securely."""

    def __init__(self, path: str):
        self.path = path
        os.makedirs(os.path.dirname(path), exist_ok=True)

    def save(self, data: dict) -> None:
        raw = json.dumps(data).encode()
        blob = encrypt(raw)
        tmp = self.path + ".tmp"
        with open(tmp, "wb") as f:
            f.write(blob)
        os.replace(tmp, self.path)
        logger.debug("Config saved to %s", self.path)

    def load(self) -> dict:
        if not os.path.exists(self.path):
            return {}
        with open(self.path, "rb") as f:
            blob = f.read()
        try:
            raw = decrypt(blob)
            return json.loads(raw.decode())
        except Exception as e:
            logger.error("Failed to decrypt config: %s", e)
            return {}

    def wipe(self) -> None:
        """Securely overwrite then delete the config file."""
        if os.path.exists(self.path):
            size = os.path.getsize(self.path)
            with open(self.path, "r+b") as f:
                f.write(os.urandom(size))
            os.remove(self.path)
