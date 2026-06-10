param(
  [switch]$FixBom
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$sensitivePatterns = @(
  "SERVICE_ROLE",
  "AUTH_SECRET",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "TWOCAPTCHA_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "AIRWALLEX_API_KEY",
  "AIRWALLEX_WEBHOOK_SECRET",
  "ALIPAY_PRIVATE_KEY",
  "GOOGLE_TRANSLATE_API_KEY",
  "DATABASE_URL",
  "POSTGRES_URL",
  "REDIS_URL",
  "BLOB_READ_WRITE_TOKEN",
  "IMAP_PASSWORD",
  "SUBMISSION_RESULT_SECRET_KEY"
)
$frontendEnvPattern = [regex]"(^|[\\/])viza-fe[\\/]internal-website[\\/]\.env"

function Get-EnvFiles {
  Get-ChildItem -LiteralPath $repoRoot -Recurse -File -Force |
    Where-Object {
      $_.Name -like ".env*" -and
      $_.FullName -notmatch "[\\/](node_modules|\.next|\.git|\.turbo)[\\/]"
    }
}

function Read-EnvNames([string]$Path) {
  $names = New-Object System.Collections.Generic.List[string]
  foreach ($line in [System.IO.File]::ReadLines($Path)) {
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) {
      continue
    }
    $idx = $trimmed.IndexOf("=")
    if ($idx -le 0) {
      continue
    }
    $names.Add($trimmed.Substring(0, $idx).Trim())
  }
  return $names
}

function Test-HasBom([byte[]]$Bytes) {
  return $Bytes.Length -ge 3 -and
    $Bytes[0] -eq 0xEF -and
    $Bytes[1] -eq 0xBB -and
    $Bytes[2] -eq 0xBF
}

function Test-SensitiveName([string]$Name) {
  foreach ($pattern in $sensitivePatterns) {
    if ($Name -like "*$pattern*") {
      return $true
    }
  }
  return $false
}

function Test-UnsafePublicName([string]$Name) {
  if (-not $Name.StartsWith("NEXT_PUBLIC_")) {
    return $false
  }
  return $Name -match "(SECRET|SERVICE_ROLE|PRIVATE|DATABASE_URL|OPENAI|AIRWALLEX_API|ALIPAY_PRIVATE|GOOGLE_TRANSLATE|SUBMISSION_RESULT)"
}

function Get-RelativePath([string]$BasePath, [string]$TargetPath) {
  $base = [Uri]((Join-Path $BasePath ".") + [System.IO.Path]::DirectorySeparatorChar)
  $target = [Uri]$TargetPath
  return [Uri]::UnescapeDataString(
    $base.MakeRelativeUri($target).ToString()
  ).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
}

$bomFiles = New-Object System.Collections.Generic.List[string]
$frontendSecretNames = New-Object System.Collections.Generic.List[string]
$unsafePublicNames = New-Object System.Collections.Generic.List[string]

Write-Host "VIZA env doctor"
Write-Host "Repo: $repoRoot"
Write-Host ""

foreach ($file in Get-EnvFiles) {
  $relativePath = Get-RelativePath $repoRoot $file.FullName
  $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
  $hasBom = Test-HasBom $bytes
  $names = Read-EnvNames $file.FullName

  if ($hasBom) {
    $bomFiles.Add($relativePath)
    if ($FixBom) {
      $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
      $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
      [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
    }
  }

  if ($frontendEnvPattern.IsMatch($relativePath)) {
    foreach ($name in $names) {
      if (Test-SensitiveName $name) {
        $frontendSecretNames.Add("$relativePath :: $name")
      }
      if (Test-UnsafePublicName $name) {
        $unsafePublicNames.Add("$relativePath :: $name")
      }
    }
  }

  $nameList = if ($names.Count -gt 0) { $names -join ", " } else { "(none)" }
  Write-Host "$relativePath"
  Write-Host "  BOM: $hasBom"
  Write-Host "  Variables: $nameList"
}

Write-Host ""
Write-Host "Summary"

if ($bomFiles.Count -eq 0) {
  Write-Host "- BOM: none found"
} elseif ($FixBom) {
  Write-Host "- BOM removed from:"
  foreach ($path in $bomFiles) {
    Write-Host "  - $path"
  }
} else {
  Write-Host "- BOM found in:"
  foreach ($path in $bomFiles) {
    Write-Host "  - $path"
  }
  Write-Host "  Re-run with -FixBom to remove UTF-8 BOMs."
}

if ($frontendSecretNames.Count -eq 0) {
  Write-Host "- Frontend backend-secret variable names: none found"
} else {
  Write-Host "- Frontend backend-secret variable names found:"
  foreach ($entry in $frontendSecretNames) {
    Write-Host "  - $entry"
  }
  Write-Host "  Move these to backend env files and rotate any value that was committed or shared."
}

if ($unsafePublicNames.Count -eq 0) {
  Write-Host "- Unsafe NEXT_PUBLIC_ sensitive names: none found"
} else {
  Write-Host "- Unsafe NEXT_PUBLIC_ sensitive names found:"
  foreach ($entry in $unsafePublicNames) {
    Write-Host "  - $entry"
  }
  Write-Host "  NEXT_PUBLIC_ values are browser-visible. Rename and move sensitive values server-side."
}

Write-Host ""
Write-Host "No secret values were printed."
