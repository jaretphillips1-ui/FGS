Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-FgsRepoRoot {
  if ($PSScriptRoot -and $PSScriptRoot.Trim().Length -gt 0) {
    return (Split-Path -Parent $PSScriptRoot)
  }

  $d = (Get-Location).Path
  while ($true) {
    if (Test-Path (Join-Path $d "package.json")) { return $d }
    $p = Split-Path -Parent $d
    if ($p -eq $d) { break }
    $d = $p
  }

  return "$env:OneDrive\AI_Workspace\FGS\fgs-app"
}

function Get-OneDriveRoot {
  $od = $env:OneDrive
  if (-not [string]::IsNullOrWhiteSpace($od)) { return $od }
  return (Join-Path $env:USERPROFILE "OneDrive")
}

$repo = Get-FgsRepoRoot
$oneDriveRoot = Get-OneDriveRoot

$desktopLocalRoot = Join-Path $env:USERPROFILE "Desktop"
$desktopODRoot    = Join-Path $oneDriveRoot "Desktop"

# POLICY:
# - Local Desktop\FGS mirror folder is NOT ALLOWED (expected 0 files)
# - OneDrive Desktop\FGS mirror folder IS REQUIRED (expected 2 files)
$deskLocalFGS = Join-Path $desktopLocalRoot "FGS"
$deskODFGS    = Join-Path $desktopODRoot    "FGS"

$savesRoot = Join-Path $oneDriveRoot "AI_Workspace\_SAVES\FGS\LATEST"
$canonZip  = Join-Path $savesRoot "FGS_LATEST.zip"
$canonNote = Join-Path $savesRoot "FGS_LATEST_CHECKPOINT.txt"

function Get-GitClean {
  try {
    Set-Location $repo
    $s = (git status --porcelain) 2>$null
    return [string]::IsNullOrWhiteSpace($s)
  } catch {
    return $false
  }
}

# Desktop ROOT offenders (never allow these on either Desktop root)
function Get-RootOffenders {
  param([Parameter(Mandatory)][string]$Root)

  if (-not (Test-Path -LiteralPath $Root)) { return @() }

  @(
    Get-ChildItem -LiteralPath $Root -File -Filter "FGS_LATEST*.zip" -ErrorAction SilentlyContinue
    Get-ChildItem -LiteralPath $Root -File -Filter "FGS_LATEST*CHECKPOINT*.txt" -ErrorAction SilentlyContinue
  ) | Where-Object { $_ }
}

$offLocal = Get-RootOffenders -Root $desktopLocalRoot
$offOD    = Get-RootOffenders -Root $desktopODRoot

$gitClean = if (Get-GitClean) { "CLEAN" } else { "DIRTY" }

# Mirror file presence (per Desktop\FGS folder)
function Get-MirrorCount {
  param([Parameter(Mandatory)][string]$Folder)

  $zip  = Join-Path $Folder "FGS_LATEST.zip"
  $note = Join-Path $Folder "FGS_LATEST_CHECKPOINT.txt"
  $n = 0
  if (Test-Path -LiteralPath $zip)  { $n++ }
  if (Test-Path -LiteralPath $note) { $n++ }
  return $n
}

$mirrorLocalCount = if (Test-Path -LiteralPath $deskLocalFGS) { Get-MirrorCount -Folder $deskLocalFGS } else { 0 }
$mirrorODCount    = if (Test-Path -LiteralPath $deskODFGS)    { Get-MirrorCount -Folder $deskODFGS }    else { 0 }

# Backup markers (only look in scripts\logs to avoid expensive recurse)
$markerHeader = 0
$markerMirror = 0
try {
  $logs = Join-Path $repo "scripts\logs"
  if (Test-Path -LiteralPath $logs) {
    if (Get-ChildItem -LiteralPath $logs -File -Filter "FGS_BACKUP_HEADER_*.txt" -ErrorAction SilentlyContinue | Select-Object -First 1) { $markerHeader = 1 }
    if (Get-ChildItem -LiteralPath $logs -File -Filter "FGS_BACKUP_MIRROR_*.txt" -ErrorAction SilentlyContinue | Select-Object -First 1) { $markerMirror = 1 }
  }
} catch { }

# Mirror ZIP quick-check (size+time)
function Get-ZipQuickOk {
  param([Parameter(Mandatory)][string]$MirrorFolder)

  $mirrorZip = Join-Path $MirrorFolder "FGS_LATEST.zip"
  if (-not (Test-Path -LiteralPath $canonZip))  { return $false }
  if (-not (Test-Path -LiteralPath $mirrorZip)) { return $false }

  $c = Get-Item -LiteralPath $canonZip
  $m = Get-Item -LiteralPath $mirrorZip
  return (($c.Length -eq $m.Length) -and ($c.LastWriteTime -eq $m.LastWriteTime))
}

# Local Desktop\FGS is NOT ALLOWED. If it exists, we flag it explicitly.
$zipLocalStatus =
  if (Test-Path -LiteralPath $deskLocalFGS) {
    "NOT ALLOWED"
  } else {
    "OK (none)"
  }

# OneDrive Desktop\FGS is REQUIRED. Quick-check should be OK.
$zipODStatus =
  if (Test-Path -LiteralPath $deskODFGS) {
    if (Get-ZipQuickOk -MirrorFolder $deskODFGS) { "OK" } else { "DRIFT?" }
  } else {
    "MISSING"
  }

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

"[FGS HARD TRUTH FOOTER] $ts   Repo: $repo   Git: $gitClean   Desktop root offenders: local=$(@($offLocal).Count) od=$(@($offOD).Count) (both should be 0)   Desktop\FGS mirror files: local=$mirrorLocalCount (should be 0) od=$mirrorODCount (should be 2)   Backup markers: header=$markerHeader mirror=$markerMirror (should be 1/1)   Mirror ZIP quick-check: local=$zipLocalStatus od=$zipODStatus (size+time)"
