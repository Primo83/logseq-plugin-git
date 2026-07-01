param(
  [string]$AllowedRoot = "C:\PGMPI-DATA-STRATEGY",
  [int]$Port = 17838,
  [string]$ShortcutName = "Logseq Git Helper"
)

$ErrorActionPreference = "Stop"

$helperScript = Join-Path $PSScriptRoot "start-logseq-git-helper.ps1"
if (-not (Test-Path -LiteralPath $helperScript)) {
  throw "Missing helper launcher: $helperScript"
}

$startup = [Environment]::GetFolderPath("Startup")
if (-not (Test-Path -LiteralPath $startup)) {
  throw "Startup folder not found: $startup"
}

$shortcutPath = Join-Path $startup "$ShortcutName.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$helperScript`" -AllowedRoot `"$AllowedRoot`" -Port $Port"
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.WindowStyle = 7
$shortcut.Description = "Start local Logseq Git helper"
$shortcut.Save()

Write-Host "Installed startup shortcut: $shortcutPath"
