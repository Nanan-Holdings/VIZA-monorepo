param(
  [switch]$WithSubmissionService
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "viza-fe\internal-website"
$agentBackendDir = Join-Path $repoRoot "viza-be\agent-backend"
$travelServiceDir = Join-Path $repoRoot "viza-be\travel-service"
$submissionServiceDir = Join-Path $repoRoot "viza-be\submission-service"

function Start-ServiceTerminal {
  param(
    [Parameter(Mandatory = $true)][string]$WindowTitle,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$Command
  )

  $escapedCommand = $Command.Replace('"', '\"')
  $bootstrap = "`$Host.UI.RawUI.WindowTitle = '$WindowTitle'; Set-Location '$WorkingDirectory'; $escapedCommand"

  Start-Process powershell -ArgumentList "-NoExit", "-Command", $bootstrap | Out-Null
}

Write-Host "Starting VIZA Travel development services..." -ForegroundColor Cyan
Write-Host "Repo root: $repoRoot" -ForegroundColor DarkGray

Start-ServiceTerminal `
  -WindowTitle "VIZA Frontend (3000)" `
  -WorkingDirectory $frontendDir `
  -Command "npm run dev"

Start-ServiceTerminal `
  -WindowTitle "VIZA Agent Backend (3002)" `
  -WorkingDirectory $agentBackendDir `
  -Command "npm run dev"

Start-ServiceTerminal `
  -WindowTitle "VIZA Travel Service (8000)" `
  -WorkingDirectory $travelServiceDir `
  -Command "if (!(Test-Path .\.venv\Scripts\Activate.ps1)) { Write-Host 'Missing .venv. Run: python -m venv .venv; .\.venv\Scripts\activate; pip install -r requirements.txt' -ForegroundColor Yellow } else { .\.venv\Scripts\activate; uvicorn main:app --host 0.0.0.0 --port 8000 --reload }"

if ($WithSubmissionService) {
  Start-ServiceTerminal `
    -WindowTitle "VIZA Submission Service" `
    -WorkingDirectory $submissionServiceDir `
    -Command "npm run dev"
}

Write-Host "Done. Opened terminals: frontend + agent-backend + travel-service" -ForegroundColor Green
if ($WithSubmissionService) {
  Write-Host "Submission service terminal also started." -ForegroundColor Green
} else {
  Write-Host "Submission service not started. Add -WithSubmissionService to include it." -ForegroundColor Yellow
}
