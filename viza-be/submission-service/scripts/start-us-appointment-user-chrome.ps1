param(
  [int]$Port = 9222,
  [string]$ProfileDirectory = "Default",
  [string]$Url = "https://www.usvisascheduling.com/",
  [string]$IsolatedUserDataDir = "",
  [switch]$RequireDefaultProfile
)

$ErrorActionPreference = "Stop"

function Test-CdpEndpoint {
  param([int]$Port)
  try {
    $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/json/version" -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (Test-CdpEndpoint -Port $Port) {
  Write-Output "Chrome CDP is already available at http://127.0.0.1:$Port"
  exit 0
}

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
  throw "Google Chrome was not found in the standard install locations."
}

$runningChrome = Get-Process chrome -ErrorAction SilentlyContinue
if ($runningChrome -and $RequireDefaultProfile) {
  Write-Error "Chrome is already running without CDP. Close all Chrome windows, then rerun this script so the runner can use your real Chrome profile at http://127.0.0.1:$Port."
  exit 2
}

$defaultUserDataDir = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"
$userDataDir = $defaultUserDataDir
if ($runningChrome) {
  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
  $userDataDir = if ($IsolatedUserDataDir.Trim()) {
    $IsolatedUserDataDir
  } else {
    Join-Path $repoRoot "output\chrome-profiles\us-appointment-cdp"
  }
  Write-Output "Chrome is already running, so starting an isolated VIZA automation profile: $userDataDir"
}
if (-not (Test-Path $userDataDir)) {
  New-Item -ItemType Directory -Force -Path $userDataDir | Out-Null
}

$args = @(
  "--remote-debugging-port=$Port",
  "--user-data-dir=$userDataDir",
  "--profile-directory=$ProfileDirectory",
  "--new-window",
  $Url
)

Start-Process -FilePath $chrome -ArgumentList $args -WindowStyle Normal
Start-Sleep -Seconds 3

if (-not (Test-CdpEndpoint -Port $Port)) {
  throw "Chrome started, but CDP did not become available at http://127.0.0.1:$Port."
}

Write-Output "Chrome CDP is ready at http://127.0.0.1:$Port"
