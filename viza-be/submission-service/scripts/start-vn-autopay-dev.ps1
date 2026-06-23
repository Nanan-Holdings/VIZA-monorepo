param(
  [switch]$Headless
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

$pan = Read-Host "Vietnam fixed-card PAN"
$expiry = Read-Host "Vietnam fixed-card expiry (MM/YY or MM/YYYY)"
$cvvSecure = Read-Host "Vietnam fixed-card CVV" -AsSecureString
$cvv = Convert-SecureStringToPlainText $cvvSecure

try {
  $env:VN_OFFICIAL_PAYMENT_AUTOPAY = "true"
  $env:VN_FIXED_CARD_ENABLED = "true"
  $env:VN_FIXED_CARD_PAN = $pan
  $env:VN_FIXED_CARD_EXPIRY = $expiry
  $env:VN_FIXED_CARD_CVV = $cvv
  $env:VN_LIVE_SUBMISSION_ENABLED = "true"
  $env:VN_LIVE_ASSISTED_ONLY = "true"
  $env:VN_PLAYWRIGHT_HEADLESS = if ($Headless) { "true" } else { "false" }

  Write-Host "Starting submission-service with Vietnam fixed-card autopay enabled for this process only."
  Write-Host "The card values were not written to disk. Stop this terminal to clear them."
  npm run dev
} finally {
  Remove-Item Env:\VN_FIXED_CARD_PAN -ErrorAction SilentlyContinue
  Remove-Item Env:\VN_FIXED_CARD_EXPIRY -ErrorAction SilentlyContinue
  Remove-Item Env:\VN_FIXED_CARD_CVV -ErrorAction SilentlyContinue
  Remove-Item Env:\VN_FIXED_CARD_ENABLED -ErrorAction SilentlyContinue
  Remove-Item Env:\VN_OFFICIAL_PAYMENT_AUTOPAY -ErrorAction SilentlyContinue
}
