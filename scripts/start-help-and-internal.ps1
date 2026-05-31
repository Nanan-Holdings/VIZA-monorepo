param(
  [int]$HelpPort = 3001,
  [int]$PortalPort = 3000,
  [switch]$NoBrowser,
  [switch]$Reset,
  [switch]$Stop
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$helpDir = Join-Path $repoRoot "viza-fe\marketing-website"
$portalDir = Join-Path $repoRoot "viza-fe\internal-website"
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

function Assert-NextInstalled {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Directory
  )

  $nextBin = Join-Path $Directory "node_modules\.bin\next.cmd"
  if (!(Test-Path $nextBin)) {
    $relativeDir = Resolve-Path -Path $Directory -Relative
    Write-Host "$Name dependencies are missing." -ForegroundColor Red
    Write-Host "Run this once, then start again:" -ForegroundColor Yellow
    Write-Host "  cd $relativeDir; npm install" -ForegroundColor Yellow
    exit 1
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

function Stop-ProcessTree {
  param([int]$ProcessId)
  cmd /c "taskkill /PID $ProcessId /T /F >nul 2>nul"
}

function Stop-StartedProcesses {
  if (!(Test-Path $logDir)) {
    Write-Warn "No .dev-logs directory found. Nothing to stop."
    return
  }

  $pidFiles = @(
    Join-Path $logDir "viza-help-page.pid"
    Join-Path $logDir "viza-internal-portal.pid"
  ) | Where-Object { Test-Path $_ }

  if ($pidFiles.Count -eq 0) {
    Write-Warn "No help/internal pid files found in .dev-logs."
    return
  }

  foreach ($pidFile in $pidFiles) {
    $rawPid = (Get-Content -Raw $pidFile).Trim()
    if (!$rawPid) {
      continue
    }

    Write-Step "Stopping process tree from $(Split-Path -Leaf $pidFile): PID $rawPid"
    Stop-ProcessTree -ProcessId ([int]$rawPid)
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  }
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

function Get-ExistingNextDev {
  param(
    [Parameter(Mandatory = $true)][string]$Directory,
    [Parameter(Mandatory = $true)][int]$DefaultPort
  )

  $directoryPattern = "*" + [WildcardPattern]::Escape($Directory) + "*"
  $process = Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -eq "node.exe" -and
      $_.CommandLine -like $directoryPattern -and
      $_.CommandLine -match "next" -and
      $_.CommandLine -match "\bdev\b"
    } |
    Select-Object -First 1

  if (!$process) {
    return $null
  }

  $port = $DefaultPort
  if ($process.CommandLine -match "(?:--port|-p)\s+(\d+)") {
    $port = [int]$Matches[1]
  }

  return [pscustomobject]@{
    ProcessId = $process.ProcessId
    Port = $port
  }
}

Assert-Directory -Path $helpDir
Assert-Directory -Path $portalDir

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if ($Stop) {
  Stop-StartedProcesses
  exit 0
}

if ($Reset) {
  Stop-StartedProcesses
  Start-Sleep -Seconds 2
}

Write-Step "Starting VIZA help page and internal portal..."
Write-Host "Repo root: $repoRoot" -ForegroundColor DarkGray

$existingPortal = Get-ExistingNextDev -Directory $portalDir -DefaultPort $PortalPort
$existingHelp = Get-ExistingNextDev -Directory $helpDir -DefaultPort $HelpPort

if (!$existingPortal) {
  Assert-NextInstalled -Name "Internal portal" -Directory $portalDir
}

if (!$existingHelp) {
  Assert-NextInstalled -Name "Help page" -Directory $helpDir
}

$selectedPortalPort = $PortalPort
if ($existingPortal) {
  $selectedPortalPort = $existingPortal.Port
  Write-Warn "Internal portal already running on port $selectedPortalPort (PID $($existingPortal.ProcessId)). Reusing it."
} else {
  if (Test-PortInUse -Port $selectedPortalPort) {
    $selectedPortalPort = Find-FreePort -PreferredPort ($PortalPort + 1) -AvoidPorts @($HelpPort)
    Write-Warn "Internal portal port $PortalPort is busy. Using $selectedPortalPort."
  }

  Start-DevProcess `
    -Name "VIZA Internal Portal" `
    -WorkingDirectory $portalDir `
    -Command "`$env:NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:$selectedPortalPort'; npm run dev -- -p $selectedPortalPort"
}

$selectedHelpPort = $HelpPort
if ($existingHelp) {
  $selectedHelpPort = $existingHelp.Port
  Write-Warn "Help page already running on port $selectedHelpPort (PID $($existingHelp.ProcessId)). Reusing it."
} else {
  if (Test-PortInUse -Port $selectedHelpPort) {
    $selectedHelpPort = Find-FreePort -PreferredPort ($HelpPort + 1) -AvoidPorts @($selectedPortalPort)
    Write-Warn "Help page port $HelpPort is busy. Using $selectedHelpPort."
  }

  Start-DevProcess `
    -Name "VIZA Help Page" `
    -WorkingDirectory $helpDir `
    -Command "`$env:NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:$selectedHelpPort'; `$env:NEXT_PUBLIC_PORTAL_URL = 'http://127.0.0.1:$selectedPortalPort'; npm run dev -- -p $selectedHelpPort"
}

$helpUrl = "http://127.0.0.1:$selectedHelpPort"
$portalUrl = "http://127.0.0.1:$selectedPortalPort"
$portalHelpUrl = "http://127.0.0.1:$selectedPortalPort/client/help"
$adminUrl = "http://127.0.0.1:$selectedPortalPort/admin/login"

Write-Host ""
Write-Host "VIZA help page and internal portal are starting." -ForegroundColor Green
Write-Host "Help/public site:     $helpUrl" -ForegroundColor Green
Write-Host "Internal portal:      $portalUrl" -ForegroundColor Green
Write-Host "Portal help center:   $portalHelpUrl" -ForegroundColor Green
Write-Host "Admin login:          $adminUrl" -ForegroundColor Green
Write-Host "Logs:                 $logDir" -ForegroundColor Green
Write-Host ""
Write-Host "Stop later with:" -ForegroundColor Yellow
Write-Host "  .\scripts\start-help-and-internal.ps1 -Stop" -ForegroundColor Yellow
Write-Host "Clean restart later with:" -ForegroundColor Yellow
Write-Host "  .\scripts\start-help-and-internal.ps1 -Reset" -ForegroundColor Yellow

if (!$NoBrowser) {
  Start-Sleep -Seconds 4
  Start-Process $helpUrl | Out-Null
  Start-Process $portalUrl | Out-Null
}
