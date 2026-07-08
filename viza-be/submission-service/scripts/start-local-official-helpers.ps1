param(
  [int]$Port = 18080,
  [int]$FallbackPort = 8085,
  [int]$RestartDelaySeconds = 5,
  [switch]$Headless,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$localEnv = [ordered]@{
  VN_OFFICIAL_PAYMENT_AUTOPAY = "true"
  VN_LOCAL_CARD_SESSION_ENABLED = "true"
  VN_LIVE_SUBMISSION_ENABLED = "true"
  VN_LIVE_ASSISTED_ONLY = "true"
  VN_PLAYWRIGHT_HEADLESS = if ($Headless) { "true" } else { "false" }
  ID_LOCAL_CARD_SESSION_ENABLED = "true"
  KR_VISA_PORTAL_EFORM_LOCAL_ENABLED = "true"
  KR_VISA_PORTAL_EFORM_LIVE_ENABLED = "true"
  KR_VISA_PORTAL_EFORM_SECOND_PAGE_ENABLED = "true"
  KR_KVAC_LOCAL_OFFICIAL_SESSION_ENABLED = "true"
  US_APPOINTMENT_ASSISTED_LIVE_ENABLED = "false"
  US_APPOINTMENT_PLAYWRIGHT_ENABLED = "false"
}

$localEndpoints = @(
  "/local/vietnam/card-session",
  "/local/indonesia/card-session",
  "/local/korea-eform/generate",
  "/local/korea-kvac/sms/start"
)

function Test-PortAvailable {
  param([Parameter(Mandatory = $true)][int]$CandidatePort)

  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::IPv6Any, $CandidatePort)
    $listener.Server.DualMode = $true
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($listener) {
      $listener.Stop()
    }
  }
}

function Test-EndpointEnabled {
  param(
    [Parameter(Mandatory = $true)][int]$CandidatePort,
    [Parameter(Mandatory = $true)][string]$Path
  )

  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$CandidatePort$Path" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
  } catch {
    return $false
  }
}

function Resolve-HelperPort {
  if (Test-PortAvailable -CandidatePort $Port) {
    return $Port
  }

  $existingHasHelpers = $true
  foreach ($endpoint in $localEndpoints) {
    if (-not (Test-EndpointEnabled -CandidatePort $Port -Path $endpoint)) {
      $existingHasHelpers = $false
      break
    }
  }
  if ($existingHasHelpers) {
    return $Port
  }

  if (Test-PortAvailable -CandidatePort $FallbackPort) {
    return $FallbackPort
  }

  foreach ($candidate in 18080..18120) {
    if (Test-PortAvailable -CandidatePort $candidate) {
      return $candidate
    }
  }

  if (Test-PortAvailable -CandidatePort 8080) {
    return 8080
  }

  throw "Could not find a free local submission-service helper port."
}

if ($DryRun) {
  [ordered]@{
    port = $Port
    fallbackPort = $FallbackPort
    env = $localEnv
    endpoints = $localEndpoints
  } | ConvertTo-Json -Depth 4 -Compress
  exit 0
}

$resolvedPort = Resolve-HelperPort
$env:PORT = [string]$resolvedPort
foreach ($name in $localEnv.Keys) {
  Set-Item -Path "Env:\$name" -Value $localEnv[$name]
}

Write-Host "Starting local submission-service helper watchdog."
Write-Host "Health URL: http://127.0.0.1:$resolvedPort/health"
Write-Host "Enabled endpoints:"
foreach ($endpoint in $localEndpoints) {
  Write-Host "  http://127.0.0.1:$resolvedPort$endpoint"
}
Write-Host "No card numbers or CVV values are read by this script. Frontend one-time sessions stay in worker memory only."
Write-Host "Press Ctrl+C to stop the watchdog."

while ($true) {
  npm run dev
  $exitCode = $LASTEXITCODE
  Write-Warning "submission-service exited with code $exitCode. Restarting in $RestartDelaySeconds seconds..."
  Start-Sleep -Seconds $RestartDelaySeconds
}
