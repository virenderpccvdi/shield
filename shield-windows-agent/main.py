"""
Shield Agent — CLI entry point.

Usage:
  shield-agent install      Install and start the Windows service
  shield-agent uninstall    Stop and remove the Windows service
  shield-agent start        Start the service
  shield-agent stop         Stop the service
  shield-agent pair <CODE>  Pair with a child profile (6-digit code)
  shield-agent status       Show agent status
  shield-agent run          Run in foreground (dev/debug)
"""
import sys
import os
import platform
import argparse
import logging

# Ensure package is on path when run as frozen exe
if getattr(sys, 'frozen', False):
    sys.path.insert(0, os.path.dirname(sys.executable))

from shield_agent.config      import SERVICE_NAME, CONFIG_FILE, APP_VERSION
from shield_agent.crypto_store import SecureStore
from shield_agent.api_client   import ShieldApiClient
from shield_agent.service      import setup_logging, run_foreground, ShieldWindowsService


def cmd_pair(code: str) -> None:
    """Pair this device with a child profile using a 6-digit code."""
    setup_logging()
    logger = logging.getLogger(__name__)

    store = SecureStore(CONFIG_FILE)
    cfg   = store.load()

    email    = cfg.get("email") or input("Parent account email: ").strip()
    password = input("Parent account password: ").strip()

    api = ShieldApiClient(store)
    if not api.login(email, password):
        print("[ERROR] Login failed. Check your email and password.")
        sys.exit(1)

    import socket
    device_name = socket.gethostname()
    print(f"Pairing device '{device_name}' with code {code}…")

    result = api.pair_device(code, device_name)
    if result:
        # Save password hint (not the full password — just for token refresh via re-login)
        # We store email only; password is NOT persisted for security.
        print(f"\n[OK] Paired successfully!")
        print(f"     Child profile : {result.get('name')}")
        print(f"     Profile ID    : {result.get('profileId')}")
        print(f"     DNS client ID : {result.get('dnsClientId')}")
        print(f"\n     Restart the Shield service to activate DNS filtering.")
        print(f"     > shield-agent restart")
    else:
        print("[ERROR] Pairing failed. Check the code and try again.")
        sys.exit(1)


def cmd_status() -> None:
    store = SecureStore(CONFIG_FILE)
    api   = ShieldApiClient(store)
    print(f"Shield Agent v{APP_VERSION}")
    print(f"Paired    : {api.is_paired}")
    if api.is_paired:
        print(f"Child     : {api.child_name}")
        print(f"Profile   : {api.profile_id}")
        print(f"DNS client: {api.dns_client_id}")
        status = api.get_dns_status(api.profile_id)
        print(f"DNS paused: {status.get('paused', False)}")
        print(f"Filter    : {status.get('filterLevel', 'N/A')}")


def cmd_service(action: str) -> None:
    if platform.system() != "Windows":
        print("Service management is only available on Windows.")
        return
    if ShieldWindowsService is None:
        print("pywin32 not available — cannot manage service.")
        return
    import win32serviceutil
    sys.argv = [sys.argv[0], action]
    win32serviceutil.HandleCommandLine(ShieldWindowsService)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="shield-agent",
        description="Shield Parental Control Agent",
    )
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("install",   help="Install Windows service")
    sub.add_parser("uninstall", help="Uninstall Windows service")
    sub.add_parser("start",     help="Start Windows service")
    sub.add_parser("stop",      help="Stop Windows service")
    sub.add_parser("restart",   help="Restart Windows service")
    sub.add_parser("status",    help="Show agent status")
    sub.add_parser("run",       help="Run in foreground")
    pair_p = sub.add_parser("pair", help="Pair with child profile")
    pair_p.add_argument("code", help="6-digit pairing code")

    args = parser.parse_args()

    if args.command == "pair":
        cmd_pair(args.code)
    elif args.command == "status":
        cmd_status()
    elif args.command == "run":
        run_foreground()
    elif args.command in ("install", "uninstall", "start", "stop", "restart"):
        cmd_service(args.command)
    else:
        parser.print_help()


if __name__ == "__main__":
    # Windows service dispatch
    if len(sys.argv) == 1 and platform.system() == "Windows" and ShieldWindowsService:
        import servicemanager
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(ShieldWindowsService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        main()
