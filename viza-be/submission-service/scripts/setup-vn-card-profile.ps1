param(
  [string]$Last4,
  [string]$Expiry,
  [string]$HolderName
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$profilePath = Join-Path $repoRoot ".agents\local-payment-card.env"
$profileDir = Split-Path $profilePath -Parent

if (-not (Test-Path $profileDir)) {
  New-Item -ItemType Directory -Path $profileDir | Out-Null
}

if (-not $Last4) {
  $Last4 = Read-Host "Card last 4 digits"
}
if ($Last4 -notmatch "^\d{4}$") {
  throw "Card last4 must be exactly 4 digits."
}

if (-not $Expiry) {
  $Expiry = Read-Host "Card expiry (MM/YY or MM/YYYY)"
}
if ($Expiry -notmatch "^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$") {
  throw "Card expiry must be MM/YY or MM/YYYY."
}

if (-not $HolderName) {
  $HolderName = Read-Host "Card holder name (optional)"
}

$lines = @(
  "# Local-only Vietnam fixed-card profile. Ignored by Git.",
  "# Do not store full PAN, CVV, OTP, or 3DS information here.",
  "VN_FIXED_CARD_LAST4=$Last4",
  "VN_FIXED_CARD_EXPIRY=$Expiry",
  "VN_FIXED_CARD_HOLDER_NAME=$HolderName"
)

Set-Content -LiteralPath $profilePath -Value $lines -Encoding UTF8
Write-Host "Saved local card profile to $profilePath"
Write-Host "Stored only last4/expiry/holder. Full PAN and CVV will still be requested at worker startup."
