Shield Agent for Windows v1.0.0
================================
This installer is built on Windows using PyInstaller + NSIS.
Source code: /var/www/ai/FamilyShield/shield-windows-agent/

To build:
  1. pip install -r requirements.txt
  2. pyinstaller shield_agent.spec
  3. makensis installer/ShieldAgentSetup.nsi

Output: ShieldAgent-Setup.exe (~10 MB)
