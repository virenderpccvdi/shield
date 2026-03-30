; Shield Agent — NSIS Installer Script
; Requires: NSIS 3.x, ShieldAgent directory from PyInstaller dist/
; Output:   ShieldAgent-Setup.exe
;
; Features:
;  - Requires admin rights (UAC elevation)
;  - Installs to Program Files\RSTGlobal\ShieldAgent
;  - Installs and starts Windows service (SYSTEM account)
;  - Adds to Windows startup via service (no separate registry entry needed)
;  - Uninstaller stops service, removes files
;  - Launch pairing wizard after install

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

;---------------------------------------------------------------------------
; General
;---------------------------------------------------------------------------
Name              "Shield Agent 1.0.0"
OutFile           "..\ShieldAgent-Setup.exe"
InstallDir        "$PROGRAMFILES64\RSTGlobal\ShieldAgent"
InstallDirRegKey  HKLM "Software\RSTGlobal\ShieldAgent" "InstallPath"
RequestExecutionLevel admin
SetCompressor     /SOLID lzma

;---------------------------------------------------------------------------
; Version info
;---------------------------------------------------------------------------
VIProductVersion  "1.0.0.0"
VIAddVersionKey   "ProductName"     "Shield Agent"
VIAddVersionKey   "CompanyName"     "RST Global"
VIAddVersionKey   "FileDescription" "Shield Parental Control Agent Installer"
VIAddVersionKey   "FileVersion"     "1.0.0"
VIAddVersionKey   "LegalCopyright"  "Copyright 2026 RST Global"

;---------------------------------------------------------------------------
; MUI Interface
;---------------------------------------------------------------------------
!define MUI_ICON              "..\assets\shield-logo.ico"
!define MUI_UNICON            "..\assets\shield-logo.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "..\assets\installer-banner.bmp"
!define MUI_ABORTWARNING

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
Page custom PairingPage PairingPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

;---------------------------------------------------------------------------
; Pairing page variables
;---------------------------------------------------------------------------
Var PairingCode
Var hPairingDlg
Var hCodeEdit
Var hCodeLabel
Var hHintLabel

Function PairingPage
    nsDialogs::Create 1018
    Pop $hPairingDlg
    ${If} $hPairingDlg == error
        Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 24u "Connect to Child Profile"
    Pop $0
    CreateFont $1 "$(^Font)" 11 700
    SendMessage $0 ${WM_SETFONT} $1 1

    ${NSD_CreateLabel} 0 30u 100% 20u \
        "Enter the 6-digit pairing code shown in the Shield parent app or dashboard."
    Pop $hHintLabel

    ${NSD_CreateLabel} 0 60u 40u 14u "Pairing Code:"
    Pop $hCodeLabel

    ${NSD_CreateText} 45u 58u 80u 16u $PairingCode
    Pop $hCodeEdit
    SendMessage $hCodeEdit ${EM_SETLIMITTEXT} 6 0

    ${NSD_CreateLabel} 0 82u 100% 30u \
        "You can also skip this step and pair later by running:$\r$\n  shield-agent pair <CODE>  (from an admin command prompt)"
    Pop $0

    nsDialogs::Show
FunctionEnd

Function PairingPageLeave
    ${NSD_GetText} $hCodeEdit $PairingCode
    ; Allow empty (skip pairing for now)
FunctionEnd

;---------------------------------------------------------------------------
; Install section
;---------------------------------------------------------------------------
Section "Shield Agent" SecMain
    SectionIn RO

    SetOutPath "$INSTDIR"
    File /r "..\dist\ShieldAgent\*.*"

    ; Write install path
    WriteRegStr HKLM "Software\RSTGlobal\ShieldAgent" "InstallPath" "$INSTDIR"
    WriteRegStr HKLM "Software\RSTGlobal\ShieldAgent" "Version"     "1.0.0"

    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    ; Add to Programs & Features
    WriteRegStr HKLM \
        "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShieldAgent" \
        "DisplayName"          "Shield Agent"
    WriteRegStr HKLM \
        "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShieldAgent" \
        "UninstallString"      '"$INSTDIR\Uninstall.exe"'
    WriteRegStr HKLM \
        "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShieldAgent" \
        "DisplayIcon"          "$INSTDIR\ShieldAgent.exe"
    WriteRegStr HKLM \
        "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShieldAgent" \
        "Publisher"            "RST Global"
    WriteRegStr HKLM \
        "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShieldAgent" \
        "DisplayVersion"       "1.0.0"

    ; Install Windows service
    DetailPrint "Installing Shield Agent service..."
    ExecWait '"$INSTDIR\ShieldAgent.exe" install'

    ; Start service
    DetailPrint "Starting Shield Agent service..."
    ExecWait '"$INSTDIR\ShieldAgent.exe" start'

    ; Pairing (if code was entered)
    ${If} $PairingCode != ""
        DetailPrint "Pairing device with code $PairingCode..."
        ExecWait '"$INSTDIR\ShieldAgent.exe" pair $PairingCode'
    ${EndIf}

SectionEnd

;---------------------------------------------------------------------------
; Uninstall section
;---------------------------------------------------------------------------
Section "Uninstall"
    ; Stop and remove service
    ExecWait '"$INSTDIR\ShieldAgent.exe" stop'
    ExecWait '"$INSTDIR\ShieldAgent.exe" uninstall'

    ; Restore DNS on all adapters via helper
    ExecWait '"$INSTDIR\ShieldAgent.exe" restore-dns'

    ; Remove files
    RMDir /r "$INSTDIR"

    ; Remove registry entries
    DeleteRegKey HKLM "Software\RSTGlobal\ShieldAgent"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShieldAgent"

    ; Remove ProgramData (config/logs) — leave if user wants to keep data
    MessageBox MB_YESNO "Remove Shield Agent data and logs?" IDNO skip_data
        RMDir /r "$PROGRAMDATA\RSTGlobal\ShieldAgent"
    skip_data:

SectionEnd
