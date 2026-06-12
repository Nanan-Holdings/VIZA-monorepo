param(
  [int]$FrontendPort = 3000,
  [int]$AgentPort = 3002,
  [int]$TravelPort = 8000,
  [switch]$NoBackend,
  [switch]$NoTravel,
  [switch]$NoBrowser,
  [switch]$CleanNext,
  [switch]$Reset,
  [switch]$Stop,
  [int]$StartupTimeoutSeconds = 120
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

  return [PSCustomObject]@{
    Name = $Name
    Pid = $process.Id
    Stdout = $stdout
    Stderr = $stderr
  }
}

function Write-Ok {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Green
}

function Write-LogTail {
  param(
    [string]$Path,
    [int]$Tail = 80
  )

  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) {
    return
  }

  $content = @(Get-Content -LiteralPath $Path -Tail $Tail -ErrorAction SilentlyContinue)
  if ($content.Count -eq 0) {
    return
  }

  Write-Warn "Last $Tail lines from $Path"
  foreach ($line in $content) {
    Write-Host $line -ForegroundColor DarkYellow
  }
}

function Wait-ProcessAlive {
  param(
    [string]$Name,
    [int]$ProcessId,
    [string]$Stdout = "",
    [string]$Stderr = "",
    [int]$Seconds = 8
  )

  for ($i = 0; $i -lt $Seconds; $i++) {
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (!$process) {
      Write-LogTail -Path $Stderr
      Write-LogTail -Path $Stdout
      throw "$Name exited during startup. Check logs in $logDir."
    }
    Start-Sleep -Seconds 1
  }

  Write-Ok "$Name process is still running (PID $ProcessId)"
}

function Wait-HttpReady {
  param(
    [string]$Name,
    [string]$Uri,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Ok "$Name ready: $Uri"
        return
      }
    } catch {
      Start-Sleep -Seconds 2
      continue
    }

    Start-Sleep -Seconds 2
  }

  throw "$Name did not become ready before timeout: $Uri"
}

function Wait-HttpJsonFieldReady {
  param(
    [string]$Name,
    [string]$Uri,
    [string]$FieldName,
    [object]$ExpectedValue,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastMessage = ""
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        $json = $response.Content | ConvertFrom-Json
        if ($json.PSObject.Properties.Name -contains $FieldName -and $json.$FieldName -eq $ExpectedValue) {
          Write-Ok "$Name ready: $Uri ($FieldName=$ExpectedValue)"
          return
        }
        $lastMessage = "$FieldName was '$($json.$FieldName)'"
      }
    } catch {
      $lastMessage = $_.Exception.Message
    }

    Start-Sleep -Seconds 2
  }

  throw "$Name did not report $FieldName=$ExpectedValue before timeout: $Uri. Last result: $lastMessage"
}

function Wait-AgentSocketReady {
  param(
    [string]$ServerUrl,
    [int]$TimeoutSeconds
  )

  $socketModule = Join-Path $frontendDir "node_modules\socket.io-client"
  if (!(Test-Path -LiteralPath $socketModule -PathType Container)) {
    throw "socket.io-client is missing under frontend node_modules: $socketModule"
  }

  $probePath = Join-Path $logDir "probe-agent-socket.cjs"
  $escapedSocketModule = $socketModule.Replace("\", "\\")
  Set-Content -LiteralPath $probePath -Value @"
const { io } = require("$escapedSocketModule");
const url = process.argv[2];
const timeoutMs = Number(process.argv[3] || "10000");
const socket = io(url + "/visa", {
  path: "/socket.io",
  transports: ["polling", "websocket"],
  timeout: timeoutMs,
  forceNew: true
});
const timer = setTimeout(() => {
  console.error("timeout waiting for Socket.IO /visa connection");
  socket.close();
  process.exit(1);
}, timeoutMs + 2000);
socket.on("connect", () => {
  console.log(JSON.stringify({
    connected: true,
    id: socket.id,
    transport: socket.io.engine.transport.name
  }));
  clearTimeout(timer);
  socket.close();
  process.exit(0);
});
socket.on("connect_error", (error) => {
  console.error(error && error.message ? error.message : String(error));
  clearTimeout(timer);
  socket.close();
  process.exit(1);
});
"@

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastOutput = ""
  while ((Get-Date) -lt $deadline) {
    $output = & node $probePath $ServerUrl 8000 2>&1
    $lastOutput = ($output | Out-String).Trim()
    if ($LASTEXITCODE -eq 0) {
      Write-Ok "VIZA agent Socket.IO namespace ready: $ServerUrl/visa"
      Write-Host "  $lastOutput" -ForegroundColor DarkGray
      return
    }

    Start-Sleep -Seconds 2
  }

  throw "VIZA agent Socket.IO namespace did not connect before timeout: $ServerUrl/visa. Last output: $lastOutput"
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

$started = @()

if (!$NoBackend) {
  $started += Start-DevProcess `
    -Name "VIZA Agent Backend" `
    -WorkingDirectory $agentBackendDir `
    -Command "`$env:PORT = '$selectedAgentPort'; `$env:CORS_ORIGINS = 'http://localhost:$selectedFrontendPort,http://127.0.0.1:$selectedFrontendPort'; npm run dev"
}

if (!$NoTravel) {
  $venvActivate = Join-Path $travelServiceDir ".venv\Scripts\Activate.ps1"
  if (Test-Path $venvActivate) {
    $started += Start-DevProcess `
      -Name "VIZA Travel Service" `
      -WorkingDirectory $travelServiceDir `
      -Command ". '.\.venv\Scripts\Activate.ps1'; uvicorn main:app --host 0.0.0.0 --port $selectedTravelPort --reload"
  } else {
    throw "Travel service .venv not found. Setup with: cd viza-be\travel-service; python -m venv .venv; .\.venv\Scripts\activate; pip install -r requirements.txt"
  }
}

$started += Start-DevProcess `
  -Name "VIZA Frontend" `
  -WorkingDirectory $frontendDir `
  -Command "`$env:NEXT_PUBLIC_AGENT_BACKEND_URL = 'http://127.0.0.1:$selectedAgentPort'; `$env:AGENT_BACKEND_URL = 'http://127.0.0.1:$selectedAgentPort'; `$env:TRAVEL_BACKEND_URL = 'http://127.0.0.1:$selectedTravelPort'; `$env:NEXT_PUBLIC_APP_URL = 'http://127.0.0.1:$selectedFrontendPort'; `$env:APP_BASE_URL = 'http://127.0.0.1:$selectedFrontendPort'; npm run dev -- -p $selectedFrontendPort"

foreach ($process in $started) {
  Wait-ProcessAlive -Name $process.Name -ProcessId $process.Pid -Stdout $process.Stdout -Stderr $process.Stderr
}

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

if (!$NoBackend) {
  Wait-HttpReady -Name "agent-backend" -Uri "http://127.0.0.1:$selectedAgentPort/health" -TimeoutSeconds $StartupTimeoutSeconds
  Wait-AgentSocketReady -ServerUrl "http://127.0.0.1:$selectedAgentPort" -TimeoutSeconds $StartupTimeoutSeconds
}

if (!$NoTravel) {
  Wait-HttpReady -Name "travel-service" -Uri "http://127.0.0.1:$selectedTravelPort/docs" -TimeoutSeconds $StartupTimeoutSeconds
}

Wait-HttpReady -Name "frontend" -Uri $clientLoginUrl -TimeoutSeconds $StartupTimeoutSeconds

if (!$NoTravel) {
  Wait-HttpJsonFieldReady `
    -Name "frontend travel proxy" `
    -Uri "http://127.0.0.1:$selectedFrontendPort/api/travel/health" `
    -FieldName "travelBackendReachable" `
    -ExpectedValue $true `
    -TimeoutSeconds $StartupTimeoutSeconds
}

if (!$NoBrowser) {
  Start-Process $clientLoginUrl | Out-Null
}
