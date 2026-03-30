"""Shield Windows Agent — Configuration"""
import os
import sys

APP_NAME        = "Shield Agent"
APP_VERSION     = "1.0.0"
APP_BUILD       = 10
AGENT_PLATFORM  = "windows"

# Backend
GATEWAY_URL     = "https://shield.rstglobal.in"
DNS_DOMAIN      = "dns.shield.rstglobal.in"
WS_URL          = "wss://shield.rstglobal.in/ws"

# Registry / file paths (Windows)
REG_ROOT        = r"SOFTWARE\RSTGlobal\ShieldAgent"
SERVICE_NAME    = "ShieldAgent"
SERVICE_DISPLAY = "Shield Parental Control Agent"
SERVICE_DESC    = "Shield DNS filtering, monitoring, and reporting agent for child devices."

# Encrypted config file
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

CONFIG_DIR  = os.path.join(os.environ.get("ProgramData", "C:\\ProgramData"), "RSTGlobal", "ShieldAgent")
CONFIG_FILE = os.path.join(CONFIG_DIR, "agent.dat")
LOG_FILE    = os.path.join(CONFIG_DIR, "agent.log")
LOCK_FILE   = os.path.join(CONFIG_DIR, "agent.lock")

# DNS
DNS_PRIMARY   = "127.0.0.1"   # loopback stub resolver; overridden during pairing
DNS_FALLBACK  = "8.8.8.8"

# Heartbeat / reporting intervals (seconds)
HEARTBEAT_INTERVAL  = 60
REPORT_INTERVAL     = 300
POLICY_SYNC_INTERVAL = 120

# Tamper protection
WATCHDOG_INTERVAL   = 30   # seconds
MAX_DNS_RESTORE_TRIES = 3
