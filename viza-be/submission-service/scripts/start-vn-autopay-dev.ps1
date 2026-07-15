param(
  [switch]$Headless,
  [switch]$FixedCard
)

$ErrorActionPreference = "Stop"

function Convert-SecureStringToPlainText {
  param([Parameter(Mandatory = $true)][securestring]$Secret)

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
  try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    if ($bstr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }
}

function Read-LocalCardProfile {
  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
  $profilePath = Join-Path $repoRoot ".agents\local-payment-card.env"
  $profile = @{}
  if (Test-Path $profilePath) {
    foreach ($line in Get-Content -LiteralPath $profilePath) {
      if ($line -match "^\s*#" -or $line -notmatch "=") { continue }
      $parts = $line -split "=", 2
      $profile[$parts[0]] = $parts[1]
    }
  }
  $profile
}

function Test-PortAvailable {
  param([Parameter(Mandatory = $true)][int]$Port)

  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::IPv6Any, $Port)
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

function Resolve-HealthPort {
  if ($env:PORT) {
    return [int]$env:PORT
  }

  if (Test-PortAvailable -Port 18080) {
    return 18080
  }

  foreach ($candidate in 18080..18120) {
    if (Test-PortAvailable -Port $candidate) {
      return $candidate
    }
  }

  if (Test-PortAvailable -Port 8080) {
    return 8080
  }

  throw "Could not find a free health server port in 18080..18120."
}

$profile = Read-LocalCardProfile
$configuredLast4 = $profile["VN_FIXED_CARD_LAST4"]
$configuredExpiry = $profile["VN_FIXED_CARD_EXPIRY"]
$configuredHolder = $profile["VN_FIXED_CARD_HOLDER_NAME"]

if ($configuredLast4) {
  Write-Host "Using local Vietnam card profile ending in $configuredLast4."
}

$pan = $null
$expiry = $null
$cvv = $null
if ($FixedCard) {
  $panPrompt = if ($configuredLast4) {
    "Vietnam fixed-card PAN ending in $configuredLast4"
  } else {
    "Vietnam fixed-card PAN"
  }
  $pan = Read-Host $panPrompt
  if ($configuredLast4 -and -not $pan.EndsWith($configuredLast4)) {
    throw "Entered PAN does not match configured last4 $configuredLast4."
  }

  $expiry = $configuredExpiry
  if (-not $expiry) {
    $expiry = Read-Host "Vietnam fixed-card expiry (MM/YY or MM/YYYY)"
  }
  $cvvSecure = Read-Host "Vietnam fixed-card CVV" -AsSecureString
  $cvv = Convert-SecureStringToPlainText $cvvSecure
}

try {
  $env:VN_OFFICIAL_PAYMENT_AUTOPAY = "true"
  $env:VN_LOCAL_CARD_SESSION_ENABLED = "true"
  if ($FixedCard) {
    $env:VN_FIXED_CARD_ENABLED = "true"
    $env:VN_FIXED_CARD_PAN = $pan
    $env:VN_FIXED_CARD_EXPIRY = $expiry
    $env:VN_FIXED_CARD_CVV = $cvv
    if ($configuredHolder) {
      $env:VN_FIXED_CARD_HOLDER_NAME = $configuredHolder
    }
  }
  $env:VN_LIVE_SUBMISSION_ENABLED = "true"
  $env:VN_LIVE_ASSISTED_ONLY = "true"
  $env:VN_PLAYWRIGHT_HEADLESS = if ($Headless) { "true" } else { "false" }
  $env:US_APPOINTMENT_ASSISTED_LIVE_ENABLED = "false"
  $env:US_APPOINTMENT_PLAYWRIGHT_ENABLED = "false"
  $env:PORT = [string](Resolve-HealthPort)

  Write-Host "Starting submission-service with Vietnam autopay enabled for this process only."
  Write-Host "Health server port: $env:PORT"
  Write-Host "Local one-time card session endpoint enabled on http://127.0.0.1:$env:PORT/local/vietnam/card-session."
  Write-Host "If the frontend runs in another terminal, set SUBMISSION_SERVICE_LOCAL_URL=http://127.0.0.1:$env:PORT or restart it after this script prints the port."
  if ($FixedCard) {
    Write-Host "Fixed-card values were not written to disk. Stop this terminal to clear them."
  } else {
    Write-Host "No card values were read in this terminal. The frontend will provide a one-time card session per payment."
  }
  npm run dev
} finally {
  Remove-Item Env:\VN_FIXED_CARD_PAN -ErrorAction SilentlyContinue
  Remove-Item Env:\VN_FIXED_CARD_EXPIRY -ErrorAction SilentlyContinue
  Remove-Item Env:\VN_FIXED_CARD_CVV -ErrorAction SilentlyContinue
  Remove-Item Env:\VN_FIXED_CARD_HOLDER_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:\VN_FIXED_CARD_ENABLED -ErrorAction SilentlyContinue
  Remove-Item Env:\VN_LOCAL_CARD_SESSION_ENABLED -ErrorAction SilentlyContinue
  Remove-Item Env:\VN_OFFICIAL_PAYMENT_AUTOPAY -ErrorAction SilentlyContinue
  Remove-Item Env:\US_APPOINTMENT_ASSISTED_LIVE_ENABLED -ErrorAction SilentlyContinue
  Remove-Item Env:\US_APPOINTMENT_PLAYWRIGHT_ENABLED -ErrorAction SilentlyContinue
}
