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
  [switch]$Reset,
  [switch]$Stop,
  [switch]$NoOpen
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "viza-fe\internal-website"
$marketingDir = Join-Path $repoRoot "viza-fe\marketing-website"
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

function Test-HttpProbe {
  param(
    [string]$Uri,
    [string[]]$ExpectedContent = @()
  )

  if ([string]::IsNullOrWhiteSpace($Uri)) {
    return $false
  }

  try {
    $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 500) {
      return $false
    }

    $body = [string]$response.Content
    foreach ($token in $ExpectedContent) {
      if (!$body.Contains($token)) {
        return $false
      }
    }

    return $true
  } catch {
    return $false
  }
}

function Assert-PortAvailableOrExpected {
  param(
    [string]$Name,
    [int]$Port,
    [string]$ExpectedPath,
    [string]$HealthUri = "",
    [string[]]$ExpectedContent = @()
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

  if (Test-HttpProbe -Uri $HealthUri -ExpectedContent $ExpectedContent) {
    Write-Warn "$Name already responding on port $Port (PID $($listener.OwningProcess)); reusing it."
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

function Stop-ProcessesByPath {
  param([string]$Path)

  $fullPath = [System.IO.Path]::GetFullPath($Path).ToLowerInvariant()
  $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and $_.CommandLine.ToLowerInvariant().Contains($fullPath)
    }

  if (!$processes -or $processes.Count -eq 0) {
    return
  }

  foreach ($process in $processes) {
    Write-Warn "Stopping lingering process tree from path match: PID $($process.ProcessId)"
    & cmd.exe /c "taskkill /PID $($process.ProcessId) /T /F >nul 2>nul"
  }
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

  $probePath = Join-Path $runLogDir "probe-agent-socket.cjs"
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
      Write-Info "  $lastOutput"
      return
    }

    Start-Sleep -Seconds 2
  }

  throw "VIZA agent Socket.IO namespace did not connect before timeout: $ServerUrl/visa. Last output: $lastOutput"
}

function Wait-ProcessAlive {
  param(
    [string]$Name,
    [int]$ProcessId,
    [string]$Stdout = "",
    [string]$Stderr = "",
    [int]$Seconds = 12
  )

  for ($i = 0; $i -lt $Seconds; $i++) {
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (!$process) {
      Write-LogTail -Path $Stderr
      Write-LogTail -Path $Stdout
      throw "$Name exited during startup. Check logs in $runLogDir."
    }
    Start-Sleep -Seconds 1
  }

  Write-Ok "$Name process is still running (PID $ProcessId)"
}

function Open-Portal {
  if ($NoOpen) {
    return
  }

  $path = if ([string]::IsNullOrWhiteSpace($PortalPath)) { "/client/login" } else { $PortalPath }
  if (!$path.StartsWith("/")) {
    $path = "/$path"
  }

  $portalUrl = "http://127.0.0.1:$FrontendPort$path"
  try {
    Start-Process $portalUrl | Out-Null
    Write-Ok "Opened portal: $portalUrl"
  } catch {
    Write-Warn "Could not open portal automatically: $($_.Exception.Message)"
    Write-Warn "Open manually: $portalUrl"
  }
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

function Invoke-VizaRequiredMigrations {
  if ($SkipVizaMigrations) {
    Write-Warn "Skipping targeted VIZA migrations because -SkipVizaMigrations was provided."
    return
  }

  Write-Step "Applying targeted VIZA Supabase migrations..."
  Write-Info "Command: cd viza-fe\\internal-website; npm run db:migrate:viza -- --apply"

  $migrationLog = Join-Path $runLogDir "viza-migrations.out.log"
  Push-Location $frontendDir
  try {
    & npm run db:migrate:viza -- --apply *> $migrationLog
    if ($LASTEXITCODE -eq 0) {
      Write-Ok "Targeted VIZA migrations applied."
      Write-Info "  log: $migrationLog"
      return
    }

    $message = "Targeted VIZA migrations failed with exit code $LASTEXITCODE. Check $migrationLog"
    if ($RequireVizaMigrations) {
      throw $message
    }

    Write-Warn $message
    Write-Warn "Continuing startup. Re-run with -RequireVizaMigrations to fail fast, or run npm run db:migrate:viza -- --apply after database/DNS is reachable."
  } catch {
    if ($RequireVizaMigrations) {
      throw
    }

    Write-Warn "Targeted VIZA migrations could not run: $($_.Exception.Message)"
    Write-Warn "Continuing startup; DB-driven form metadata may be stale until migrations apply."
  } finally {
    Pop-Location
    if (Test-Path -LiteralPath $migrationLog -PathType Leaf) {
      Write-Info "  migration output: $migrationLog"
    }
  }
}

function Assert-ServiceInputs {
  Assert-Directory -Path $frontendDir
  Assert-Directory -Path $marketingDir
  Assert-Directory -Path $agentBackendDir
  Assert-Directory -Path $submissionServiceDir
  Assert-Directory -Path $travelServiceDir

  Assert-NpmScript -Directory $frontendDir -ExpectedName "admin-website" -ScriptName "dev"
  Assert-NpmScript -Directory $marketingDir -ExpectedName "marketing-website" -ScriptName "dev"
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
  Stop-ProcessesByPath -Path $agentBackendDir
  Stop-ProcessesByPath -Path $submissionServiceDir
  Stop-ProcessesByPath -Path $travelServiceDir
  Stop-ProcessesByPath -Path $marketingDir
  Stop-ProcessesByPath -Path $frontendDir
  Start-Sleep -Seconds 2
}

Write-Step "Starting VIZA local development stack..."
Write-Info "Repo root: $repoRoot"

New-Item -ItemType Directory -Force -Path $runLogDir | Out-Null

Assert-ServiceInputs
Start-DatabaseServices
Invoke-VizaRequiredMigrations

$frontendAlreadyRunning = Assert-PortAvailableOrExpected `
  -Name "frontend" `
  -Port $FrontendPort `
  -ExpectedPath $frontendDir `
  -HealthUri "http://127.0.0.1:$FrontendPort/client/login" `
  -ExpectedContent @("_next")
$marketingAlreadyRunning = Assert-PortAvailableOrExpected `
  -Name "marketing web" `
  -Port $MarketingPort `
  -ExpectedPath $marketingDir `
  -HealthUri "http://127.0.0.1:$MarketingPort/" `
  -ExpectedContent @("_next")
$agentAlreadyRunning = Assert-PortAvailableOrExpected `
  -Name "agent-backend" `
  -Port $AgentPort `
  -ExpectedPath $agentBackendDir `
  -HealthUri "http://127.0.0.1:$AgentPort/health" `
  -ExpectedContent @('"status":"ok"')
$travelAlreadyRunning = Assert-PortAvailableOrExpected `
  -Name "travel-service" `
  -Port $TravelPort `
  -ExpectedPath $travelServiceDir `
  -HealthUri "http://127.0.0.1:$TravelPort/openapi.json" `
  -ExpectedContent @('"/generate"', '"/chat"', '"/flight-options"')
$submissionAlreadyRunning = Assert-PortAvailableOrExpected `
  -Name "submission-service" `
  -Port $SubmissionPort `
  -ExpectedPath $submissionServiceDir `
  -HealthUri "http://127.0.0.1:$SubmissionPort/health" `
  -ExpectedContent @('"status":"ok"')
$submissionCardSessionUri = "http://127.0.0.1:$SubmissionPort/local/vietnam/card-session"
if ($submissionAlreadyRunning -and !(Test-HttpProbe -Uri $submissionCardSessionUri -ExpectedContent @('"enabled":true'))) {
  Write-Warn "submission-service is running but Vietnam card-session endpoint is not enabled; restarting it with local autopay env."
  Stop-ProcessesByPath -Path $submissionServiceDir
  Start-Sleep -Seconds 2
  $submissionAlreadyRunning = $false
}

if ($Reset) {
  $agentAlreadyRunning = $false
  $marketingAlreadyRunning = $false
  $travelAlreadyRunning = $false
  $submissionAlreadyRunning = $false
  $frontendAlreadyRunning = $false
}

$started = @()

if (!$agentAlreadyRunning) {
  $agentCommand = "`$env:PORT = '$AgentPort'; `$env:CORS_ORIGINS = 'http://localhost:$FrontendPort,http://127.0.0.1:$FrontendPort'; npm run dev"
  $started += Start-ManagedProcess `
    -Name "agent-backend" `
    -SafeName "agent-backend" `
    -WorkingDirectory $agentBackendDir `
    -Command $agentCommand
}

if (!$submissionAlreadyRunning) {
  $submissionProcess = Find-RunningProcessByPath -Path $submissionServiceDir
  if ($submissionProcess) {
    if (Test-HttpProbe -Uri $submissionCardSessionUri -ExpectedContent @('"enabled":true')) {
      Write-Warn "submission-service already running (PID $($submissionProcess.ProcessId)); reusing it."
    } else {
      Write-Warn "submission-service process found (PID $($submissionProcess.ProcessId)) but Vietnam card-session endpoint is not ready; restarting it."
      Stop-ProcessesByPath -Path $submissionServiceDir
      Start-Sleep -Seconds 2
      $submissionCommand = "`$env:PORT = '$SubmissionPort'; `$env:VN_OFFICIAL_PAYMENT_AUTOPAY = 'true'; `$env:VN_LOCAL_CARD_SESSION_ENABLED = 'true'; `$env:VN_LIVE_SUBMISSION_ENABLED = 'true'; `$env:VN_LIVE_ASSISTED_ONLY = 'true'; `$env:VN_PLAYWRIGHT_HEADLESS = 'false'; npm run dev"
      $started += Start-ManagedProcess `
        -Name "submission-service worker with Vietnam autopay" `
        -SafeName "submission-service" `
        -WorkingDirectory $submissionServiceDir `
        -Command $submissionCommand
    }
  } else {
    $submissionCommand = "`$env:PORT = '$SubmissionPort'; `$env:VN_OFFICIAL_PAYMENT_AUTOPAY = 'true'; `$env:VN_LOCAL_CARD_SESSION_ENABLED = 'true'; `$env:VN_LIVE_SUBMISSION_ENABLED = 'true'; `$env:VN_LIVE_ASSISTED_ONLY = 'true'; `$env:VN_PLAYWRIGHT_HEADLESS = 'false'; npm run dev"
    $started += Start-ManagedProcess `
      -Name "submission-service worker with Vietnam autopay" `
      -SafeName "submission-service" `
      -WorkingDirectory $submissionServiceDir `
      -Command $submissionCommand
  }
} else {
  Write-Warn "submission-service health already responding on port $SubmissionPort; reusing it."
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

if (!$marketingAlreadyRunning) {
  $marketingCommand = "`$env:NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:$MarketingPort'; `$env:NEXT_PUBLIC_PORTAL_URL = 'http://127.0.0.1:$FrontendPort'; npm run dev -- -p $MarketingPort"
  $started += Start-ManagedProcess `
    -Name "marketing web" `
    -SafeName "marketing-web" `
    -WorkingDirectory $marketingDir `
    -Command $marketingCommand
}

if (!$frontendAlreadyRunning) {
  $frontendCommand = "`$env:NEXT_PUBLIC_AGENT_BACKEND_URL = 'http://127.0.0.1:$AgentPort'; `$env:AGENT_BACKEND_URL = 'http://127.0.0.1:$AgentPort'; `$env:TRAVEL_BACKEND_URL = 'http://127.0.0.1:$TravelPort'; `$env:NEXT_PUBLIC_APP_URL = 'http://127.0.0.1:$FrontendPort'; `$env:APP_BASE_URL = 'http://127.0.0.1:$FrontendPort'; `$env:SUBMISSION_SERVICE_LOCAL_URL = 'http://127.0.0.1:$SubmissionPort'; `$env:NEXT_PUBLIC_VN_LIVE_SUBMISSION_ENABLED = 'true'; `$env:NEXT_PUBLIC_VN_SUBMISSION_MODE = 'live_assisted'; npm run dev -- -p $FrontendPort"
  $started += Start-ManagedProcess `
    -Name "frontend" `
    -SafeName "frontend" `
    -WorkingDirectory $frontendDir `
    -Command $frontendCommand
}

foreach ($process in $started) {
  Wait-ProcessAlive -Name $process.Name -ProcessId $process.Pid -Stdout $process.Stdout -Stderr $process.Stderr
}

Wait-HttpReady -Name "agent-backend" -Uri "http://127.0.0.1:$AgentPort/health" -TimeoutSeconds $StartupTimeoutSeconds
Wait-HttpReady -Name "submission-service" -Uri "http://127.0.0.1:$SubmissionPort/health" -TimeoutSeconds $StartupTimeoutSeconds
Wait-HttpReady -Name "Vietnam one-time card session endpoint" -Uri $submissionCardSessionUri -TimeoutSeconds $StartupTimeoutSeconds
Wait-HttpReady -Name "travel-service" -Uri "http://127.0.0.1:$TravelPort/docs" -TimeoutSeconds $StartupTimeoutSeconds
Wait-HttpReady -Name "marketing web" -Uri "http://127.0.0.1:$MarketingPort/" -TimeoutSeconds $StartupTimeoutSeconds
Wait-HttpReady -Name "frontend" -Uri "http://127.0.0.1:$FrontendPort/client/login" -TimeoutSeconds $StartupTimeoutSeconds
Wait-AgentSocketReady -ServerUrl "http://127.0.0.1:$AgentPort" -TimeoutSeconds $StartupTimeoutSeconds
Wait-HttpJsonFieldReady `
  -Name "frontend travel proxy" `
  -Uri "http://127.0.0.1:$FrontendPort/api/travel/health" `
  -FieldName "travelBackendReachable" `
  -ExpectedValue $true `
  -TimeoutSeconds $StartupTimeoutSeconds

Write-Host ""
Write-Ok "VIZA local development stack is ready."
Write-Host "Frontend/client:     http://127.0.0.1:$FrontendPort/client/login" -ForegroundColor Green
Write-Host "Marketing web:       http://127.0.0.1:$MarketingPort/" -ForegroundColor Green
Write-Host "Admin login:         http://127.0.0.1:$FrontendPort/admin/login" -ForegroundColor Green
Write-Host "Agent backend:       http://127.0.0.1:$AgentPort/health" -ForegroundColor Green
Write-Host "Submission service:  http://127.0.0.1:$SubmissionPort/health" -ForegroundColor Green
Write-Host "VN card handoff:     http://127.0.0.1:$SubmissionPort/local/vietnam/card-session" -ForegroundColor Green
Write-Host "VIZA agent socket:   http://127.0.0.1:$AgentPort/visa" -ForegroundColor Green
Write-Host "Travel service docs: http://127.0.0.1:$TravelPort/docs" -ForegroundColor Green
Write-Host "Travel proxy health: http://127.0.0.1:$FrontendPort/api/travel/health" -ForegroundColor Green
Write-Host "Logs:                $runLogDir" -ForegroundColor Green
Open-Portal
Write-Host ""
Write-Host "Stop later with:" -ForegroundColor Yellow
Write-Host "  npm run dev:all:stop" -ForegroundColor Yellow
