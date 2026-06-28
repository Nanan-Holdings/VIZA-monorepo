param(
  [int]$Port = 9224,
  [string]$ProfileDirectory = "Default",
  [string]$Url = "https://etravel.gov.ph",
  [string]$IsolatedUserDataDir = "",
  [switch]$RequireDefaultProfile,
  [switch]$Visible
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
  Write-Output "Set PH_ETRAVEL_CDP_ENDPOINT=http://127.0.0.1:$Port before running the worker or smoke script."
  exit 0
}

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
  $chromeCommand = Get-Command chrome.exe -ErrorAction SilentlyContinue
  if ($chromeCommand) {
    $chrome = $chromeCommand.Source
  }
}

if (-not $chrome) {
  throw "Google Chrome was not found in the standard install locations or PATH."
}

$runningChrome = Get-Process chrome -ErrorAction SilentlyContinue
if ($runningChrome -and $RequireDefaultProfile) {
  Write-Error "Chrome is already running without CDP. Close all Chrome windows, then rerun this script so the runner can use your default Chrome profile at http://127.0.0.1:$Port."
  exit 2
}

$defaultUserDataDir = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$userDataDir = if ($runningChrome -or -not $RequireDefaultProfile) {
  if ($IsolatedUserDataDir.Trim()) {
    $IsolatedUserDataDir
  } else {
    Join-Path $repoRoot "output\chrome-profiles\ph-etravel-cdp"
  }
} else {
  $defaultUserDataDir
}

if (-not (Test-Path $userDataDir)) {
  New-Item -ItemType Directory -Force -Path $userDataDir | Out-Null
}

$args = @(
  "--remote-debugging-port=$Port",
  "--user-data-dir=$userDataDir",
  "--profile-directory=$ProfileDirectory",
  "--disable-features=Translate",
  "--new-window",
  $Url
)

$windowStyle = if ($Visible) { "Normal" } else { "Hidden" }
Start-Process -FilePath $chrome -ArgumentList $args -WindowStyle $windowStyle
Start-Sleep -Seconds 3

if (-not (Test-CdpEndpoint -Port $Port)) {
  throw "Chrome started, but CDP did not become available at http://127.0.0.1:$Port."
}

Write-Output "Chrome CDP is ready at http://127.0.0.1:$Port"
Write-Output "PowerShell: `$env:PH_ETRAVEL_CDP_ENDPOINT='http://127.0.0.1:$Port'"
Write-Output "Env file: PH_ETRAVEL_CDP_ENDPOINT=http://127.0.0.1:$Port"
