<#
.SYNOPSIS
    Shield Parental Control — Windows Setup Script
.DESCRIPTION
    Installs Shield Agent on this PC and pairs it with a child profile.
    Requires a 6-digit pairing code generated from the Shield parent dashboard.
    Run as Administrator (the script will self-elevate if needed).
.NOTES
    https://shield.rstglobal.in
    Version: 1.0.0
#>

# ── Self-elevate to Administrator ─────────────────────────────────────────────
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Write-Host "Restarting as Administrator..." -ForegroundColor Yellow
    Start-Process PowerShell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ── Configuration ─────────────────────────────────────────────────────────────
$API_BASE    = "https://shield.rstglobal.in/api/v1"
$AGENT_URL   = "https://shield.rstglobal.in/static/ShieldAgent.exe"
$INSTALL_DIR = "$env:ProgramFiles\Shield"
$AGENT_EXE   = "$INSTALL_DIR\ShieldAgent.exe"
$DATA_DIR    = "$env:ProgramData\RSTGlobal\ShieldAgent"
$BOOTSTRAP   = "$DATA_DIR\bootstrap.json"
$SERVICE     = "ShieldAgent"
$NRPT_PATH   = "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient\DnsPolicy\ShieldParentalControl"

# ── Helpers ───────────────────────────────────────────────────────────────────
function Write-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  +===============================================+" -ForegroundColor Cyan
    Write-Host "  |        Shield Parental Control               |" -ForegroundColor Cyan
    Write-Host "  |          Windows Setup  v1.0.0               |" -ForegroundColor Cyan
    Write-Host "  |    https://shield.rstglobal.in               |" -ForegroundColor Cyan
    Write-Host "  +===============================================+" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($n, $text) {
    Write-Host ""
    Write-Host "  [$n/5] $text" -ForegroundColor White
    Write-Host "  $('-' * 45)" -ForegroundColor DarkGray
}

function Write-OK($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "  [!!] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "  [..] $msg" -ForegroundColor Gray }

function Invoke-API($method, $path, $body = $null, $token = $null) {
    $headers = @{ "Content-Type" = "application/json"; "Accept" = "application/json" }
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    $params = @{ Method = $method; Uri = "$API_BASE$path"; Headers = $headers; UseBasicParsing = $true }
    if ($body) { $params["Body"] = ($body | ConvertTo-Json -Compress) }
    try {
        $resp = Invoke-WebRequest @params
        return ($resp.Content | ConvertFrom-Json)
    } catch {
        $errBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        $msg = if ($errBody.message) { $errBody.message } else { $_.Exception.Message }
        throw $msg
    }
}

# ── Main ──────────────────────────────────────────────────────────────────────
Write-Banner

Write-Host "  This wizard will:" -ForegroundColor White
Write-Host "   1. Log in with your Shield parent account" -ForegroundColor Gray
Write-Host "   2. Enter the 6-digit pairing code from the Shield app" -ForegroundColor Gray
Write-Host "   3. Download and install the Shield Agent service" -ForegroundColor Gray
Write-Host "   4. Apply DNS filtering for the child profile" -ForegroundColor Gray
Write-Host ""
Write-Host "  To get a pairing code: Shield Dashboard > Devices > Windows PC > Generate Code" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  HOW TO RUN THIS SCRIPT:" -ForegroundColor Yellow
Write-Host "   1. Open Start > search 'PowerShell' > right-click > Run as Administrator" -ForegroundColor Gray
Write-Host "   2. cd to this script's folder, e.g.:" -ForegroundColor Gray
Write-Host "      cd `"$env:USERPROFILE\Downloads`"" -ForegroundColor DarkGray
Write-Host "   3. Type:  .\ShieldSetup.ps1" -ForegroundColor Green
Write-Host ""

# ── STEP 1 — Login ────────────────────────────────────────────────────────────
Write-Step 1 "Parent Account Login"

$email = Read-Host "  Email"
$securePwd = Read-Host "  Password" -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd))

Write-Info "Logging in..."
try {
    $login = Invoke-API "POST" "/auth/login" @{ email = $email.Trim(); password = $password }
    if (-not $login.success) { throw ($login.message ?? "Login failed") }
    $token = $login.data.accessToken
    $userName = $login.data.name
    Write-OK "Logged in as $userName"
} catch {
    Write-Err "Login failed: $_"
    Write-Host ""
    Write-Host "  Press Enter to exit..." -ForegroundColor Gray
    Read-Host | Out-Null
    exit 1
}

# ── STEP 2 — Pairing Code ─────────────────────────────────────────────────────
Write-Step 2 "Enter Pairing Code"

Write-Host "  Open Shield Dashboard > Devices > Windows PC" -ForegroundColor DarkCyan
Write-Host "  Click 'Generate Pairing Code' and enter it below." -ForegroundColor DarkCyan
Write-Host ""

$code = ""
do {
    $code = (Read-Host "  6-Digit Pairing Code").Trim()
    if ($code -notmatch '^\d{6}$') {
        Write-Err "Code must be exactly 6 digits. Try again."
    }
} while ($code -notmatch '^\d{6}$')

Write-Info "Pairing this PC ($env:COMPUTERNAME) with code $code ..."
try {
    $pair = Invoke-API "POST" "/profiles/devices/pair" @{
        pairingCode  = $code
        deviceName   = $env:COMPUTERNAME
        platform     = "windows"
        agentVersion = "1.0.0"
    } $token

    if (-not $pair.success) { throw ($pair.message ?? "Pairing failed") }

    $cfg = $pair.data
    Write-OK "Paired with child profile: $($cfg.name)"
    Write-OK "DNS filter level: $($cfg.filterLevel)"
} catch {
    Write-Err "Pairing failed: $_"
    Write-Err "Make sure the code is correct and hasn't expired (15 min TTL)."
    Write-Host ""
    Write-Host "  Press Enter to exit..." -ForegroundColor Gray
    Read-Host | Out-Null
    exit 1
}

# ── STEP 3 — Download Agent ───────────────────────────────────────────────────
Write-Step 3 "Download Shield Agent"

if (-not (Test-Path $INSTALL_DIR)) {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
}
if (-not (Test-Path $DATA_DIR)) {
    New-Item -ItemType Directory -Path $DATA_DIR -Force | Out-Null
}

# Stop + remove existing service before replacing EXE
$svc = Get-Service -Name $SERVICE -ErrorAction SilentlyContinue
if ($svc) {
    Write-Info "Stopping existing Shield Agent service..."
    if ($svc.Status -eq "Running") { Stop-Service -Name $SERVICE -Force }
    Start-Sleep -Seconds 2
    sc.exe delete $SERVICE | Out-Null
    Start-Sleep -Seconds 1
}

Write-Info "Downloading ShieldAgent.exe from shield.rstglobal.in ..."
try {
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile($AGENT_URL, $AGENT_EXE)
    $size = [math]::Round((Get-Item $AGENT_EXE).Length / 1MB, 1)
    Write-OK "Downloaded ShieldAgent.exe ($size MB) to $INSTALL_DIR"
} catch {
    Write-Err "Download failed: $_"
    Write-Err "Check your internet connection and try again."
    Write-Host ""
    Write-Host "  Press Enter to exit..." -ForegroundColor Gray
    Read-Host | Out-Null
    exit 1
}

# ── STEP 4 — Save Config + Install Service ────────────────────────────────────
Write-Step 4 "Configure and Install Service"

# Write bootstrap config (plaintext — the service encrypts it on first start)
$bootstrap = @{
    profile_id    = $cfg.profileId
    device_id     = $cfg.deviceId
    dns_client_id = $cfg.dnsClientId
    child_name    = $cfg.name
    access_token  = $token
    token_exp     = ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 82800)
    email         = $email.Trim()
} | ConvertTo-Json
[System.IO.File]::WriteAllText($BOOTSTRAP, $bootstrap, [System.Text.Encoding]::UTF8)
Write-OK "Profile config saved"

# Install Windows service
Write-Info "Installing Shield Agent as Windows service..."
$result = sc.exe create $SERVICE `
    binPath= "`"$AGENT_EXE`" svc" `
    DisplayName= "Shield Parental Control Agent" `
    start= auto `
    obj= LocalSystem 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Err "Service install failed: $result"
} else {
    sc.exe description $SERVICE "Shield DNS filtering and activity monitoring for child devices." | Out-Null
    sc.exe failure $SERVICE reset= 60 actions= restart/5000/restart/10000/restart/30000 | Out-Null
    Write-OK "Service installed (auto-start, failure recovery enabled)"
}

# ── STEP 5 — Apply NRPT + Start Service ──────────────────────────────────────
Write-Step 5 "Activate DNS Filtering"

# Apply NRPT (Group Policy DNS redirect — less suspicious than adapter DNS change)
Write-Info "Applying DNS policy (NRPT)..."
try {
    if (-not (Test-Path $NRPT_PATH)) {
        New-Item -Path $NRPT_PATH -Force | Out-Null
    }
    Set-ItemProperty -Path $NRPT_PATH -Name "Namespace"         -Value "."          -Type String
    Set-ItemProperty -Path $NRPT_PATH -Name "GenericDNSServers" -Value "127.0.0.1"  -Type String
    Set-ItemProperty -Path $NRPT_PATH -Name "Version"           -Value 1            -Type DWord
    Set-ItemProperty -Path $NRPT_PATH -Name "DirectAccessEnabled" -Value 0          -Type DWord
    Set-ItemProperty -Path $NRPT_PATH -Name "Comment"           -Value "Shield Parental Control DNS Policy - do not remove" -Type String
    # Flush DNS cache so the new policy takes effect immediately
    ipconfig /flushdns | Out-Null
    Write-OK "DNS policy applied — all queries routed through Shield"
} catch {
    Write-Err "NRPT setup failed: $_"
}

# Add Windows Firewall rule to allow the DNS stub to listen on 127.0.0.1:53
Write-Info "Configuring firewall for DNS stub..."
netsh advfirewall firewall delete rule name="ShieldAgent DNS" | Out-Null 2>&1
netsh advfirewall firewall add rule `
    name="ShieldAgent DNS" `
    dir=in `
    action=allow `
    program="$AGENT_EXE" `
    protocol=UDP `
    localport=53 | Out-Null
Write-OK "Firewall rule added"

# Start the service
Write-Info "Starting Shield Agent service..."
try {
    Start-Service -Name $SERVICE
    Start-Sleep -Seconds 3
    $svc = Get-Service -Name $SERVICE
    if ($svc.Status -eq "Running") {
        Write-OK "Shield Agent service is RUNNING"
    } else {
        Write-Err "Service started but status is: $($svc.Status)"
    }
} catch {
    Write-Err "Could not start service: $_"
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  +===============================================+" -ForegroundColor Green
Write-Host "  |   Shield is protecting $($cfg.name)'s PC!" -ForegroundColor Green
Write-Host "  |                                               |" -ForegroundColor Green
Write-Host "  |   DNS Filter  : $($cfg.filterLevel)" -ForegroundColor Green
Write-Host "  |   Device ID   : $($cfg.deviceId.Substring(0,8))..." -ForegroundColor Green
Write-Host "  |   Profile     : $($cfg.profileId.Substring(0,8))..." -ForegroundColor Green
Write-Host "  +===============================================+" -ForegroundColor Green
Write-Host ""
Write-Host "  To check status:    sc.exe query ShieldAgent" -ForegroundColor DarkCyan
Write-Host "  To uninstall:       sc.exe stop ShieldAgent && sc.exe delete ShieldAgent" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Press Enter to close this window..." -ForegroundColor Gray
Read-Host | Out-Null
