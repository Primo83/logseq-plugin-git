param(
  [string]$AllowedRoot = "C:\PGMPI-DATA-STRATEGY",
  [int]$Port = 17838
)

$ErrorActionPreference = "Stop"

$helperScript = Join-Path $PSScriptRoot "logseq-git-helper.cjs"
if (-not (Test-Path -LiteralPath $helperScript)) {
  throw "Missing helper script: $helperScript"
}

$healthUrl = "http://127.0.0.1:$Port/health"
try {
  $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 2
  if ($health.ok) {
    Write-Host "Logseq Git helper already running on port $Port (pid $($health.pid), root $($health.allowedRoot))."
    return
  }
} catch {
  # Not running yet.
}

$node = Get-Command node -ErrorAction Stop
$logDir = Join-Path $env:TEMP "logseq-git-helper"
New-Item -Path $logDir -ItemType Directory -Force | Out-Null
$stdoutLog = Join-Path $logDir "helper-$Port.out.log"
$stderrLog = Join-Path $logDir "helper-$Port.err.log"

$oldAllowedRoot = [Environment]::GetEnvironmentVariable("LOGSEQ_GIT_HELPER_ALLOWED_ROOT", "Process")
$oldPort = [Environment]::GetEnvironmentVariable("LOGSEQ_GIT_HELPER_PORT", "Process")

try {
  [Environment]::SetEnvironmentVariable("LOGSEQ_GIT_HELPER_ALLOWED_ROOT", $AllowedRoot, "Process")
  [Environment]::SetEnvironmentVariable("LOGSEQ_GIT_HELPER_PORT", [string]$Port, "Process")

  $process = Start-Process `
    -FilePath $node.Source `
    -ArgumentList @($helperScript) `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru
} finally {
  [Environment]::SetEnvironmentVariable("LOGSEQ_GIT_HELPER_ALLOWED_ROOT", $oldAllowedRoot, "Process")
  [Environment]::SetEnvironmentVariable("LOGSEQ_GIT_HELPER_PORT", $oldPort, "Process")
}

Start-Sleep -Milliseconds 800
$health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 5
Write-Host "Started Logseq Git helper on port $Port (pid $($process.Id), root $($health.allowedRoot))."
Write-Host "Logs: $stdoutLog ; $stderrLog"
