param(
  [switch]$Headless,
  [switch]$FixedCard,
  [int]$Port = 8085
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$submissionRoot = Join-Path $repoRoot "viza-be\submission-service"

Push-Location $submissionRoot
try {
  if (-not $env:PORT) {
    $env:PORT = [string]$Port
  }

  $args = @("run", "vn:autopay:dev", "--")
  if ($Headless) {
    $args += "-Headless"
  }
  if ($FixedCard) {
    $args += "-FixedCard"
  }

  npm.cmd @args
} finally {
  Pop-Location
}
