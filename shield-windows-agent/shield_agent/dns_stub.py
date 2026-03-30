"""
Shield Agent — Local DNS Stub Resolver (UDP port 53 on 127.0.0.1).

Listens for DNS queries from the OS, forwards them as DoH (RFC 8484)
POST requests to https://shield.rstglobal.in/dns/{clientId}/dns-query,
and returns the response.  Blocked domains receive 0.0.0.0 from the
Shield resolver (the stub passes this through transparently).

The stub runs as a daemon thread inside the agent process so no
external dependency (like dnscrypt-proxy) is needed.
"""
import socket
import struct
import threading
import logging
import urllib.request
import urllib.error
import ssl
import time

logger = logging.getLogger(__name__)

DOH_BASE    = "https://shield.rstglobal.in/dns"
LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 53
MAX_PACKET  = 512
TIMEOUT     = 5


class DnsStub(threading.Thread):
    """UDP DNS stub that forwards to Shield DoH gateway."""

    def __init__(self, client_id: str):
        super().__init__(daemon=True, name="DnsStub")
        self.client_id  = client_id
        self.doh_url    = f"{DOH_BASE}/{client_id}/dns-query"
        self._stop      = threading.Event()
        self._sock: socket.socket | None = None
        self._ssl_ctx   = ssl.create_default_context()

    def update_client_id(self, client_id: str) -> None:
        self.client_id = client_id
        self.doh_url   = f"{DOH_BASE}/{client_id}/dns-query"
        logger.info("DNS stub client_id updated: %s", client_id)

    def stop(self) -> None:
        self._stop.set()
        if self._sock:
            try:
                self._sock.close()
            except Exception:
                pass

    def run(self) -> None:
        retries = 0
        while not self._stop.is_set() and retries < 10:
            try:
                self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                self._sock.bind((LISTEN_HOST, LISTEN_PORT))
                self._sock.settimeout(1.0)
                logger.info("DNS stub listening on %s:%d → %s",
                            LISTEN_HOST, LISTEN_PORT, self.doh_url)
                retries = 0
                self._serve()
            except PermissionError:
                logger.error("Cannot bind port 53 — need administrator privileges")
                break
            except OSError as e:
                retries += 1
                logger.error("DNS stub socket error (retry %d/10): %s", retries, e)
                time.sleep(5)

    def _serve(self) -> None:
        while not self._stop.is_set():
            try:
                data, addr = self._sock.recvfrom(MAX_PACKET)
            except socket.timeout:
                continue
            except OSError:
                break
            threading.Thread(
                target=self._handle,
                args=(data, addr),
                daemon=True,
            ).start()

    def _handle(self, query: bytes, addr: tuple) -> None:
        try:
            response = self._forward(query)
            if response:
                self._sock.sendto(response, addr)
        except Exception as e:
            logger.debug("DNS stub handle error for %s: %s", addr, e)
            # Send SERVFAIL
            if len(query) >= 2:
                txid = query[:2]
                self._sock.sendto(txid + b'\x80\x02' + b'\x00' * 8, addr)

    def _forward(self, query: bytes) -> bytes | None:
        req = urllib.request.Request(
            self.doh_url,
            data=query,
            method="POST",
        )
        req.add_header("Content-Type", "application/dns-message")
        req.add_header("Accept", "application/dns-message")
        req.add_header("User-Agent", "ShieldAgent/1.0")
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=self._ssl_ctx) as resp:
            return resp.read()
