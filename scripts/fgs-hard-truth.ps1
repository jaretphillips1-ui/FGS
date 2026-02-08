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

$repo      = Get-FgsRepoRoot
$desktop   = Join-Path $env:USERPROFILE "Desktop"
$deskOD    = Join-Path $env:USERPROFILE "OneDrive\Desktop"

$deskFGS   = Join-Path $desktop "FGS"
$deskODFGS = Join-Path $deskOD  "FGS"

$savesRoot = "$env:OneDrive\AI_Workspace\_SAVES\FGS\LATEST"
$canonZip  = Join-Path $savesRoot "FGS_LATEST.zip"
$canonNote = Join-Path $savesRoot "FGS_LATEST_CHECKPOINT.txt"

function Get-GitClean {
  try {
    Set-Location $repo
    $s = (git status --porcelain) 2>$null
    return [string]::IsNullOrWhiteSpace($s)
  } catch { return $false }
}

# Desktop ROOT offenders (never allow these on either Desktop root)
function Get-RootOffenders([Parameter(Mandatory)][string]$Root) {
  if (-not (Test-Path -LiteralPath $Root)) { return @() }

  @(
    Get-ChildItem -LiteralPath $Root -File -Filter "FGS_LATEST*.zip" -ErrorAction SilentlyContinue
    Get-ChildItem -LiteralPath $Root -File -Filter "FGS_LATEST*CHECKPOINT*.txt" -ErrorAction SilentlyContinue
  ) | Where-Object { $_ }
}

$offLocal = Get-RootOffenders -Root $desktop
$offOD    = Get-RootOffenders -Root $deskOD

$gitClean = if (Get-GitClean) { "CLEAN" } else { "DIRTY" }

# Mirror file presence (per desktop folder)
function Get-MirrorCount([Parameter(Mandatory)][string]$Folder) {
  $zip  = Join-Path $Folder "FGS_LATEST.zip"
  $note = Join-Path $Folder "FGS_LATEST_CHECKPOINT.txt"
  $n = 0
  if (Test-Path -LiteralPath $zip)  { $n++ }
  if (Test-Path -LiteralPath $note) { $n++ }
  return $n
}

$mirrorLocalCount = if (Test-Path -LiteralPath $deskFGS) { Get-MirrorCount -Folder $deskFGS } else { 0 }
$mirrorODCount    = if (Test-Path -LiteralPath $deskODFGS) { Get-MirrorCount -Folder $deskODFGS } else { 0 }

# Backup markers (only look in scripts\logs to avoid expensive recurse)
$markerHeader = 0
$markerMirror = 0
try {
  $logs = Join-Path $repo "scripts\logs"
  if (Test-Path -LiteralPath $logs) {
    if (Get-ChildItem -LiteralPath $logs -File -Filter "FGS_BACKUP_HEADER_*.txt" -ErrorAction SilentlyContinue | Select-Object -First 1) { $markerHeader = 1 }
    if (Get-ChildItem -LiteralPath $logs -File -Filter "FGS_BACKUP_MIRROR_*.txt" -ErrorAction SilentlyContinue | Select-Object -First 1) { $markerMirror = 1 }
  }
} catch {}

# Mirror ZIP quick-check (size+time) for both Desktop\FGS folders
function Get-ZipOk([Parameter(Mandatory)][string]$MirrorFolder) {
  $mirrorZip = Join-Path $MirrorFolder "FGS_LATEST.zip"
  if (-not (Test-Path -LiteralPath $canonZip)) { return $false }
  if (-not (Test-Path -LiteralPath $mirrorZip)) { return $false }

  $c = Get-Item -LiteralPath $canonZip
  $m = Get-Item -LiteralPath $mirrorZip
  return (($c.Length -eq $m.Length) -and ($c.LastWriteTime -eq $m.LastWriteTime))
}

$zipLocalOK = if (Test-Path -LiteralPath $deskFGS)   { Get-ZipOk -MirrorFolder $deskFGS }   else { $false }
$zipODOK    = if (Test-Path -LiteralPath $deskODFGS) { Get-ZipOk -MirrorFolder $deskODFGS } else { $false }

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[FGS HARD TRUTH FOOTER] $ts   Repo: $repo   Git: $gitClean   Desktop root offenders: local=$(@($offLocal).Count) od=$(@($offOD).Count) (both should be 0)   Desktop\FGS mirror files: local=$mirrorLocalCount od=$mirrorODCount (each should be 2)   Backup markers: header=$markerHeader mirror=$markerMirror (should be 1/1)   Mirror ZIP quick-check: local=$(if($zipLocalOK){'OK'}else{'DRIFT?'}) od=$(if($zipODOK){'OK'}else{'DRIFT?'}) (size+time)"
