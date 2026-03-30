# Shield Windows Agent — Build Instructions

## Prerequisites (Windows build machine)
- Python 3.11+ (64-bit)
- NSIS 3.x (`choco install nsis`)
- pywin32, cryptography, pyinstaller

## 1. Setup
```
cd shield-windows-agent
pip install -r requirements.txt
```

## 2. Create assets
Place these in `assets/`:
- `shield-logo.ico`        — 256×256 ICO
- `installer-banner.bmp`   — 164×314 BMP (MUI_WELCOMEFINISHPAGE_BITMAP)
- `LICENSE.txt`            — license text shown in installer

## 3. Build EXE (PyInstaller)
```
pyinstaller shield_agent.spec
```
Output: `dist/ShieldAgent/ShieldAgent.exe` (one-directory bundle)

## 4. Build Installer (NSIS)
```
makensis installer/ShieldAgentSetup.nsi
```
Output: `ShieldAgent-Setup.exe` (~8–12 MB)

## 5. Sign (optional but recommended)
```
signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 \
    /a ShieldAgent-Setup.exe
```

## Installation on child's PC (parent runs):
1. Double-click `ShieldAgent-Setup.exe`
2. Accept UAC elevation prompt
3. Enter the 6-digit pairing code from the Shield dashboard
4. Click Install
5. Agent starts automatically as a Windows service

## Pairing (manual):
```
shield-agent pair 123456
shield-agent restart
shield-agent status
```

## What the agent does:
- Installs as `ShieldAgent` SYSTEM Windows service (starts on boot)
- Runs a local DNS stub on 127.0.0.1:53
- Sets all network adapters' DNS to 127.0.0.1
- Forwards all DNS queries to `https://shield.rstglobal.in/dns/{clientId}/dns-query`
- Watches for DNS tampering every 30 seconds and restores Shield DNS
- Reports heartbeat and activity metrics to the Shield backend every 60 seconds
- Syncs filter policy (filter level, paused state) every 2 minutes

## Uninstall:
Control Panel → Programs → Shield Agent → Uninstall
(or: `shield-agent uninstall` from admin CMD)
