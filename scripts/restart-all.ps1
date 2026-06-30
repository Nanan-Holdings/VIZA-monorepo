param(
  [int]$FrontendPort = 3000,
  [int]$MarketingPort = 3001,
  [int]$AgentPort = 3002,
  [int]$SubmissionPort = 8085,
  [int]$TravelPort = 8000,
  [int]$StartupTimeoutSeconds = 120,
  [string]$PortalPath = "/client/login",
  [switch]$WithDb,
  [switch]$SkipVizaMigrations,
  [switch]$RequireVizaMigrations,
  [switch]$NoOpen
)

$ErrorActionPreference = "Stop"

$scriptRoot = $PSScriptRoot
$startAllScript = Join-Path $scriptRoot "start-all.ps1"

if (!(Test-Path -LiteralPath $startAllScript -PathType Leaf)) {
  throw "start-all script missing: $startAllScript"
}

Write-Host "Emergency restart: stopping all VIZA dev services, then restarting..." -ForegroundColor Cyan

& "$startAllScript" `
  -Reset `
  -FrontendPort $FrontendPort `
  -MarketingPort $MarketingPort `
  -AgentPort $AgentPort `
  -SubmissionPort $SubmissionPort `
  -TravelPort $TravelPort `
  -StartupTimeoutSeconds $StartupTimeoutSeconds `
  -PortalPath $PortalPath `
  -WithDb:$WithDb `
  -SkipVizaMigrations:$SkipVizaMigrations `
  -RequireVizaMigrations:$RequireVizaMigrations `
  -NoOpen:$NoOpen
