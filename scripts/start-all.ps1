param(
  [int]$FrontendPort = 3000,
  [int]$AgentPort = 3002,
  [int]$TravelPort = 8000,
  [int]$StartupTimeoutSeconds = 120,
  [switch]$WithDb,
  [switch]$Reset,
  [switch]$Stop
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "viza-fe\internal-website"
$agentBackendDir = Join-Path $repoRoot "viza-be\agent-backend"
$submissionServiceDir = Join-Path $repoRoot "viza-be\submission-service"
$travelServiceDir = Join-Path $repoRoot "viza-be\travel-service"
$logRoot = Join-Path $repoRoot ".dev-logs"
$runLogDir = Join-Path $logRoot "start-all"

function Write-Step {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Yellow
}

function Write-Info {
  param([string]$Message)
  Write-Host $Message -ForegroundColor DarkGray
}

function Assert-Directory {
  param([string]$Path)
  if (!(Test-Path -LiteralPath $Path -PathType Container)) {
    throw "Missing directory: $Path"
  }
}

function Read-PackageJson {
  param([string]$Directory)

  $packagePath = Join-Path $Directory "package.json"
  if (!(Test-Path -LiteralPath $packagePath -PathType Leaf)) {
    throw "Missing package.json: $packagePath"
  }

  return Get-Content -Raw -LiteralPath $packagePath | ConvertFrom-Json
}

function Assert-NpmScript {
  param(
    [string]$Directory,
    [string]$ExpectedName,
    [string]$ScriptName
  )

  $package = Read-PackageJson -Directory $Directory
  if ($package.name -ne $ExpectedName) {
    throw "Unexpected package name in $Directory. Expected '$ExpectedName', found '$($package.name)'."
  }

  $scriptNames = @()
  if ($package.scripts) {
    $scriptNames = @($package.scripts.PSObject.Properties.Name)
  }

  if (!($scriptNames -contains $ScriptName)) {
    throw "Package '$ExpectedName' does not define npm script '$ScriptName'. Found scripts: $($scriptNames -join ', ')"
  }

  Write-Ok "Verified $ExpectedName -> npm run $ScriptName"
}

function Read-EnvMap {
  param([string[]]$Paths)

  $envMap = @{}
  foreach ($path in $Paths) {
    if (!(Test-Path -LiteralPath $path -PathType Leaf)) {
      continue
    }

    foreach ($line in Get-Content -LiteralPath $path) {
      if ($line -match "^\s*#") {
        continue
      }

      if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$") {
        $key = $Matches[1]
        $value = $Matches[2].Trim()
        if ($value.Length -gt 0 -and !$envMap.ContainsKey($key)) {
          $envMap[$key] = $true
        }
      }
    }
  }

  return $envMap
}

function Assert-EnvKeys {
  param(
    [string]$Name,
    [string[]]$Paths,
    [string[]]$RequiredKeys,
    [string[]]$OptionalKeys = @()
  )

  $envMap = Read-EnvMap -Paths $Paths
  $missing = @()
  foreach ($key in $RequiredKeys) {
    $processValue = [Environment]::GetEnvironmentVariable($key)
    if (!$envMap.ContainsKey($key) -and [string]::IsNullOrWhiteSpace($processValue)) {
      $missing += $key
    }
  }

  if ($missing.Count -gt 0) {
    throw "$Name is missing required env key(s): $($missing -join ', ')"
  }

  $missingOptional = @()
  foreach ($key in $OptionalKeys) {
    $processValue = [Environment]::GetEnvironmentVariable($key)
    if (!$envMap.ContainsKey($key) -and [string]::IsNullOrWhiteSpace($processValue)) {
      $missingOptional += $key
    }
  }

  if ($missingOptional.Count -gt 0) {
    Write-Warn "$Name optional env key(s) not set: $($missingOptional -join ', ')"
  }

  Write-Ok "Verified $Name required env keys"
}

function Get-PortListener {
  param([int]$Port)
  return Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Get-ProcessInfo {
  param([int]$ProcessId)
  return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

function Test-CommandLineContainsPath {
  param(
    [string]$CommandLine,
    [string]$Path
  )

  if ([string]::IsNullOrWhiteSpace($CommandLine)) {
    return $false
  }

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  return $CommandLine.ToLowerInvariant().Contains($fullPath.ToLowerInvariant())
}

function Assert-PortAvailableOrExpected {
  param(
    [string]$Name,
    [int]$Port,
    [string]$ExpectedPath
  )

  $listener = Get-PortListener -Port $Port
  if (!$listener) {
    return $false
  }

  $process = Get-ProcessInfo -ProcessId $listener.OwningProcess
  if ($process -and (Test-CommandLineContainsPath -CommandLine $process.CommandLine -Path $ExpectedPath)) {
    Write-Warn "$Name already listening on port $Port (PID $($listener.OwningProcess)); reusing it."
    return $true
  }

  $processName = if ($process) { $process.Name } else { "unknown" }
  throw "Port $Port is already in use by PID $($listener.OwningProcess) ($processName), not by $Name."
}

function Find-RunningProcessByPath {
  param([string]$Path)

  $fullPath = [System.IO.Path]::GetFullPath($Path).ToLowerInvariant()
  return Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and $_.CommandLine.ToLowerInvariant().Contains($fullPath)
    } |
    Select-Object -First 1
}

function Stop-StartedProcesses {
  if (!(Test-Path -LiteralPath $runLogDir -PathType Container)) {
    Write-Warn "No start-all log directory found. Nothing to stop."
    return
  }

  $pidFiles = Get-ChildItem -LiteralPath $runLogDir -Filter "*.pid" -File -ErrorAction SilentlyContinue
  if (!$pidFiles -or $pidFiles.Count -eq 0) {
    Write-Warn "No start-all PID files found. Nothing to stop."
    return
  }

  foreach ($pidFile in $pidFiles) {
    $rawPid = (Get-Content -Raw -LiteralPath $pidFile.FullName).Trim()
    if (!$rawPid) {
      continue
    }

    Write-Step "Stopping process tree from $($pidFile.Name): PID $rawPid"
    & cmd.exe /c "taskkill /PID $rawPid /T /F >nul 2>nul"
    Remove-Item -LiteralPath $pidFile.FullName -Force -ErrorAction SilentlyContinue
  }
}

function Start-ManagedProcess {
  param(
    [string]$Name,
    [string]$SafeName,
    [string]$WorkingDirectory,
    [string]$Command
  )

  New-Item -ItemType Directory -Force -Path $runLogDir | Out-Null

  $stdout = Join-Path $runLogDir "$SafeName.out.log"
  $stderr = Join-Path $runLogDir "$SafeName.err.log"
  $pidFile = Join-Path $runLogDir "$SafeName.pid"
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
  Write-Ok "Started $Name (PID $($process.Id))"
  Write-Info "  stdout: $stdout"
  Write-Info "  stderr: $stderr"

  return [PSCustomObject]@{
    Name = $Name
    Pid = $process.Id
    Stdout = $stdout
    Stderr = $stderr
    PidFile = $pidFile
  }
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

function Wait-ProcessAlive {
  param(
    [string]$Name,
    [int]$ProcessId,
    [int]$Seconds = 12
  )

  for ($i = 0; $i -lt $Seconds; $i++) {
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (!$process) {
      throw "$Name exited during startup. Check logs in $runLogDir."
    }
    Start-Sleep -Seconds 1
  }

  Write-Ok "$Name process is still running (PID $ProcessId)"
}

function Find-ComposeFiles {
  $excludePattern = "\\node_modules\\|\\.git\\|\\.next\\|\\dist\\|\\.venv\\|\\__pycache__\\"
  return Get-ChildItem -Path $repoRoot -Recurse -File -Include "docker-compose.yml","docker-compose.yaml","compose.yml","compose.yaml" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch $excludePattern }
}

function Start-DatabaseServices {
  if (!$WithDb) {
    return
  }

  Write-Step "Starting local database services..."
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (!$docker) {
    Write-Warn "Docker CLI not found. Skipping local Docker/Supabase database startup."
    return
  }

  $composeFiles = @(Find-ComposeFiles)
  if ($composeFiles.Count -gt 0) {
    foreach ($composeFile in $composeFiles) {
      Write-Step "docker compose up -d ($($composeFile.FullName))"
      & docker compose -f $composeFile.FullName up -d
    }
    return
  }

  $supabaseConfig = Join-Path $frontendDir "supabase\config.toml"
  if (Test-Path -LiteralPath $supabaseConfig -PathType Leaf) {
    $supabase = Get-Command supabase -ErrorAction SilentlyContinue
    if (!$supabase) {
      Write-Warn "Supabase config found, but Supabase CLI is not available. Skipping Supabase local services."
      return
    }

    Write-Step "supabase start ($frontendDir)"
    & supabase start --workdir $frontendDir
    return
  }

  Write-Warn "No docker compose file or Supabase local config found. No database service was started."
}

function Assert-ServiceInputs {
  Assert-Directory -Path $frontendDir
  Assert-Directory -Path $agentBackendDir
  Assert-Directory -Path $submissionServiceDir
  Assert-Directory -Path $travelServiceDir

  Assert-NpmScript -Directory $frontendDir -ExpectedName "admin-website" -ScriptName "dev"
  Assert-NpmScript -Directory $agentBackendDir -ExpectedName "@viza/agent-backend" -ScriptName "dev"
  Assert-NpmScript -Directory $submissionServiceDir -ExpectedName "viza-submission-service" -ScriptName "dev"

  Assert-EnvKeys `
    -Name "frontend" `
    -Paths @((Join-Path $frontendDir ".env.local"), (Join-Path $frontendDir ".env")) `
    -RequiredKeys @("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY") `
    -OptionalKeys @("CLIENT_SESSION_SECRET")

  Assert-EnvKeys `
    -Name "agent-backend" `
    -Paths @((Join-Path $agentBackendDir ".env.local"), (Join-Path $agentBackendDir ".env")) `
    -RequiredKeys @("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")

  Assert-EnvKeys `
    -Name "submission-service" `
    -Paths @((Join-Path $submissionServiceDir ".env")) `
    -RequiredKeys @("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")

  Assert-EnvKeys `
    -Name "travel-service" `
    -Paths @((Join-Path $travelServiceDir ".env")) `
    -RequiredKeys @("OPENAI_API_KEY") `
    -OptionalKeys @("RAPIDAPI_KEY", "RAPIDAPI_BOOKING_HOST", "RAPIDAPI_BOOKING_BASE_URL")

  $venvPython = Join-Path $travelServiceDir ".venv\Scripts\python.exe"
  if (!(Test-Path -LiteralPath $venvPython -PathType Leaf)) {
    throw "Travel service virtualenv Python is missing: $venvPython"
  }
}

if ($Stop) {
  Stop-StartedProcesses
  exit 0
}

if ($Reset) {
  Stop-StartedProcesses
  Start-Sleep -Seconds 2
}

Write-Step "Starting VIZA local development stack..."
Write-Info "Repo root: $repoRoot"

New-Item -ItemType Directory -Force -Path $runLogDir | Out-Null

Assert-ServiceInputs
Start-DatabaseServices

$frontendAlreadyRunning = Assert-PortAvailableOrExpected -Name "frontend" -Port $FrontendPort -ExpectedPath $frontendDir
$agentAlreadyRunning = Assert-PortAvailableOrExpected -Name "agent-backend" -Port $AgentPort -ExpectedPath $agentBackendDir
$travelAlreadyRunning = Assert-PortAvailableOrExpected -Name "travel-service" -Port $TravelPort -ExpectedPath $travelServiceDir

$started = @()

if (!$agentAlreadyRunning) {
  $agentCommand = "`$env:PORT = '$AgentPort'; `$env:CORS_ORIGINS = 'http://localhost:$FrontendPort,http://127.0.0.1:$FrontendPort'; npm run dev"
  $started += Start-ManagedProcess `
    -Name "agent-backend" `
    -SafeName "agent-backend" `
    -WorkingDirectory $agentBackendDir `
    -Command $agentCommand
}

$submissionProcess = Find-RunningProcessByPath -Path $submissionServiceDir
if ($submissionProcess) {
  Write-Warn "submission-service already running (PID $($submissionProcess.ProcessId)); reusing it."
} else {
  $started += Start-ManagedProcess `
    -Name "submission-service worker" `
    -SafeName "submission-service" `
    -WorkingDirectory $submissionServiceDir `
    -Command "npm run dev"
}

if (!$travelAlreadyRunning) {
  $travelPython = Join-Path $travelServiceDir ".venv\Scripts\python.exe"
  $travelCommand = "& '$travelPython' -m uvicorn main:app --host 0.0.0.0 --port $TravelPort --reload"
  $started += Start-ManagedProcess `
    -Name "travel-service" `
    -SafeName "travel-service" `
    -WorkingDirectory $travelServiceDir `
    -Command $travelCommand
}

if (!$frontendAlreadyRunning) {
  $frontendCommand = "`$env:NEXT_PUBLIC_AGENT_BACKEND_URL = 'http://127.0.0.1:$AgentPort'; `$env:AGENT_BACKEND_URL = 'http://127.0.0.1:$AgentPort'; `$env:TRAVEL_BACKEND_URL = 'http://127.0.0.1:$TravelPort'; `$env:NEXT_PUBLIC_APP_URL = 'http://127.0.0.1:$FrontendPort'; `$env:APP_BASE_URL = 'http://127.0.0.1:$FrontendPort'; npm run dev -- -p $FrontendPort"
  $started += Start-ManagedProcess `
    -Name "frontend" `
    -SafeName "frontend" `
    -WorkingDirectory $frontendDir `
    -Command $frontendCommand
}

foreach ($process in $started) {
  Wait-ProcessAlive -Name $process.Name -ProcessId $process.Pid
}

Wait-HttpReady -Name "agent-backend" -Uri "http://127.0.0.1:$AgentPort/health" -TimeoutSeconds $StartupTimeoutSeconds
Wait-HttpReady -Name "travel-service" -Uri "http://127.0.0.1:$TravelPort/docs" -TimeoutSeconds $StartupTimeoutSeconds
Wait-HttpReady -Name "frontend" -Uri "http://127.0.0.1:$FrontendPort/client/login" -TimeoutSeconds $StartupTimeoutSeconds

Write-Host ""
Write-Ok "VIZA local development stack is ready."
Write-Host "Frontend/client:     http://127.0.0.1:$FrontendPort/client/login" -ForegroundColor Green
Write-Host "Admin login:         http://127.0.0.1:$FrontendPort/admin/login" -ForegroundColor Green
Write-Host "Agent backend:       http://127.0.0.1:$AgentPort/health" -ForegroundColor Green
Write-Host "Travel service docs: http://127.0.0.1:$TravelPort/docs" -ForegroundColor Green
Write-Host "Logs:                $runLogDir" -ForegroundColor Green
Write-Host ""
Write-Host "Stop later with:" -ForegroundColor Yellow
Write-Host "  npm run dev:all:stop" -ForegroundColor Yellow
