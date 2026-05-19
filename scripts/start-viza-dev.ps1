param(
  [int]$FrontendPort = 3000,
  [int]$AgentPort = 3002,
  [int]$TravelPort = 8000,
  [switch]$NoBackend,
  [switch]$NoTravel,
  [switch]$NoBrowser,
  [switch]$CleanNext,
  [switch]$Reset,
  [switch]$Stop
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "viza-fe\internal-website"
$agentBackendDir = Join-Path $repoRoot "viza-be\agent-backend"
$travelServiceDir = Join-Path $repoRoot "viza-be\travel-service"
$logDir = Join-Path $repoRoot ".dev-logs"

function Write-Step {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Cyan
}

function Write-Warn {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Yellow
}

function Assert-Directory {
  param([string]$Path)
  if (!(Test-Path $Path)) {
    throw "Missing directory: $Path"
  }
}

function Test-PortInUse {
  param([int]$Port)
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return $null -ne $connection
}

function Find-FreePort {
  param(
    [int]$PreferredPort,
    [int[]]$AvoidPorts = @()
  )

  for ($port = $PreferredPort; $port -lt ($PreferredPort + 30); $port++) {
    if ($AvoidPorts -contains $port) {
      continue
    }
    if (!(Test-PortInUse -Port $port)) {
      return $port
    }
  }

  throw "Could not find a free port near $PreferredPort"
}

function Stop-StartedProcesses {
  if (!(Test-Path $logDir)) {
    Write-Warn "No .dev-logs directory found. Nothing to stop."
    return
  }

  $pidFiles = Get-ChildItem -Path $logDir -Filter "*.pid" -ErrorAction SilentlyContinue
  if ($pidFiles.Count -eq 0) {
    Write-Warn "No pid files found in .dev-logs. Nothing to stop."
    return
  }

  foreach ($pidFile in $pidFiles) {
    $rawPid = (Get-Content -Raw $pidFile.FullName).Trim()
    if (!$rawPid) {
      continue
    }

    Write-Step "Stopping process tree from $($pidFile.Name): PID $rawPid"
    cmd /c "taskkill /PID $rawPid /T /F >nul 2>nul"
    Remove-Item -LiteralPath $pidFile.FullName -Force -ErrorAction SilentlyContinue
  }
}

function Stop-RepoDevProcesses {
  $repoPattern = [WildcardPattern]::Escape($repoRoot)
  $frontendPattern = "*$repoPattern*viza-fe*internal-website*"
  $agentPattern = "*$repoPattern*viza-be*agent-backend*"
  $travelPattern = "*$repoPattern*viza-be*travel-service*"

  $processes = Get-CimInstance Win32_Process |
    Where-Object {
      $_.ProcessId -ne $PID -and
      (
        ($_.Name -eq "node.exe" -and $_.CommandLine -like $frontendPattern) -or
        ($_.Name -eq "node.exe" -and $_.CommandLine -like $agentPattern) -or
        (($_.Name -eq "python.exe" -or $_.Name -eq "uvicorn.exe") -and $_.CommandLine -like $travelPattern)
      )
    }

  if (!$processes -or $processes.Count -eq 0) {
    Write-Warn "No running VIZA dev processes found."
    return
  }

  foreach ($process in $processes) {
    Write-Step "Stopping VIZA dev process PID $($process.ProcessId): $($process.Name)"
    cmd /c "taskkill /PID $($process.ProcessId) /T /F >nul 2>nul"
  }
}

function Clear-NextCache {
  $nextDir = Join-Path $frontendDir ".next"
  if (!(Test-Path $nextDir)) {
    return
  }

  $resolvedNextDir = [System.IO.Path]::GetFullPath($nextDir)
  $resolvedFrontendDir = [System.IO.Path]::GetFullPath($frontendDir)
  $isFrontendChild = $resolvedNextDir.StartsWith($resolvedFrontendDir, [System.StringComparison]::OrdinalIgnoreCase)
  $isNextCache = (Split-Path -Leaf $resolvedNextDir) -eq ".next"

  if (!$isFrontendChild -or !$isNextCache) {
    throw "Refusing to delete unexpected path: $resolvedNextDir"
  }

  Write-Step "Removing stale Next.js cache: $resolvedNextDir"
  Remove-Item -LiteralPath $resolvedNextDir -Recurse -Force
}

function Start-DevProcess {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$Command
  )

  $safeName = $Name.ToLowerInvariant().Replace(" ", "-")
  $stdout = Join-Path $logDir "$safeName.out.log"
  $stderr = Join-Path $logDir "$safeName.err.log"
  $pidFile = Join-Path $logDir "$safeName.pid"
  $wrapped = "`$ErrorActionPreference = 'Continue'; $Command"

  $process = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $wrapped) `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -WindowStyle Hidden `
    -PassThru

  Set-Content -LiteralPath $pidFile -Value $process.Id
  Write-Host ("Started {0} (PID {1})" -f $Name, $process.Id) -ForegroundColor Green
  Write-Host "  stdout: $stdout" -ForegroundColor DarkGray
  Write-Host "  stderr: $stderr" -ForegroundColor DarkGray
}

Assert-Directory -Path $frontendDir
Assert-Directory -Path $agentBackendDir
Assert-Directory -Path $travelServiceDir

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if ($Stop) {
  Stop-StartedProcesses
  Stop-RepoDevProcesses
  exit 0
}

if ($Reset) {
  Stop-StartedProcesses
  Stop-RepoDevProcesses
  $CleanNext = $true
  Start-Sleep -Seconds 2
}

Write-Step "Starting VIZA development services..."
Write-Host "Repo root: $repoRoot" -ForegroundColor DarkGray

if ($CleanNext) {
  Clear-NextCache
}

$selectedAgentPort = $AgentPort
if (!$NoBackend) {
  if (Test-PortInUse -Port $selectedAgentPort) {
    $selectedAgentPort = Find-FreePort -PreferredPort ($AgentPort + 1) -AvoidPorts @($FrontendPort, $TravelPort)
    Write-Warn "Agent backend port $AgentPort is busy. Using $selectedAgentPort."
  }
}

$selectedTravelPort = $TravelPort
if (!$NoTravel) {
  if (Test-PortInUse -Port $selectedTravelPort) {
    $selectedTravelPort = Find-FreePort -PreferredPort ($TravelPort + 1) -AvoidPorts @($FrontendPort, $selectedAgentPort)
    Write-Warn "Travel service port $TravelPort is busy. Using $selectedTravelPort."
  }
}

$selectedFrontendPort = $FrontendPort
if (Test-PortInUse -Port $selectedFrontendPort) {
  $selectedFrontendPort = Find-FreePort -PreferredPort ($FrontendPort + 1) -AvoidPorts @($selectedAgentPort, $selectedTravelPort)
  Write-Warn "Frontend port $FrontendPort is busy. Using $selectedFrontendPort."
}

if (!$NoBackend) {
  Start-DevProcess `
    -Name "VIZA Agent Backend" `
    -WorkingDirectory $agentBackendDir `
    -Command "`$env:PORT = '$selectedAgentPort'; `$env:CORS_ORIGINS = 'http://localhost:$selectedFrontendPort,http://127.0.0.1:$selectedFrontendPort'; npm run dev"
}

if (!$NoTravel) {
  $venvActivate = Join-Path $travelServiceDir ".venv\Scripts\Activate.ps1"
  if (Test-Path $venvActivate) {
    Start-DevProcess `
      -Name "VIZA Travel Service" `
      -WorkingDirectory $travelServiceDir `
      -Command ". '.\.venv\Scripts\Activate.ps1'; uvicorn main:app --host 0.0.0.0 --port $selectedTravelPort --reload"
  } else {
    Write-Warn "Travel service .venv not found. Skipping Travel service."
    Write-Warn "Setup later with: cd viza-be\travel-service; python -m venv .venv; .\.venv\Scripts\activate; pip install -r requirements.txt"
  }
}

Start-DevProcess `
  -Name "VIZA Frontend" `
  -WorkingDirectory $frontendDir `
  -Command "`$env:NEXT_PUBLIC_AGENT_BACKEND_URL = 'http://127.0.0.1:$selectedAgentPort'; `$env:TRAVEL_BACKEND_URL = 'http://127.0.0.1:$selectedTravelPort'; npm run dev -- -p $selectedFrontendPort"

$clientLoginUrl = "http://127.0.0.1:$selectedFrontendPort/client/login"
$clientHomeUrl = "http://127.0.0.1:$selectedFrontendPort/client/home"
$adminLoginUrl = "http://127.0.0.1:$selectedFrontendPort/admin/login"

Write-Host ""
Write-Host "VIZA dev services are starting." -ForegroundColor Green
Write-Host "Client login: $clientLoginUrl" -ForegroundColor Green
Write-Host "Client home:  $clientHomeUrl" -ForegroundColor Green
Write-Host "Admin login:  $adminLoginUrl" -ForegroundColor Green
Write-Host "Logs:         $logDir" -ForegroundColor Green
Write-Host ""
Write-Host "Stop later with:" -ForegroundColor Yellow
Write-Host "  .\scripts\start-viza-dev.ps1 -Stop" -ForegroundColor Yellow
Write-Host "Clean restart later with:" -ForegroundColor Yellow
Write-Host "  .\scripts\start-viza-dev.ps1 -Reset" -ForegroundColor Yellow

if (!$NoBrowser) {
  Start-Sleep -Seconds 4
  Start-Process $clientLoginUrl | Out-Null
}
