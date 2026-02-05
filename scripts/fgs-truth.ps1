param(
  [int]$CacheSeconds = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Config
$repo      = "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
$savesRoot = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST"
$desktop   = Join-Path $env:USERPROFILE "Desktop"
$deskFGS   = Join-Path $desktop "FGS"
$backupPS1 = Join-Path $repo "scripts\fgs-backup.ps1"

function Get-FgsFooterText {
  param([int]$CacheSeconds = 0)

  if (-not $global:FGS_TruthCache) {
    $global:FGS_TruthCache = @{
      LastRun         = Get-Date "2000-01-01"
      Text            = ""
      LastPrintedText = ""
    }
  }

  $now = Get-Date
  if ($CacheSeconds -gt 0 -and ($now - $global:FGS_TruthCache.LastRun).TotalSeconds -lt $CacheSeconds -and $global:FGS_TruthCache.Text) {
    return $global:FGS_TruthCache.Text
  }

  # Desktop root offenders (should be 0)
  $off = @(
    @(Get-ChildItem $desktop -File -Filter "FGS_LATEST*.zip" -ErrorAction SilentlyContinue),
    @(Get-ChildItem $desktop -File -Filter "FGS_LATEST*CHECKPOINT*.txt" -ErrorAction SilentlyContinue)
  ) | Where-Object { $_ } | Sort-Object FullName -Unique
  $off = @($off)

  # Desktop\FGS mirror files (target 2)
  $mirrorCount = 0
  if (Test-Path $deskFGS) {
    $mirrorCount = @(Get-ChildItem $deskFGS -File -ErrorAction SilentlyContinue).Count
  }

  # Backup markers in scripts\fgs-backup.ps1 (target 1/1)
  $hdr = 0
  $mir = 0
  if (Test-Path $backupPS1) {
    $hdr = @(Select-String -Path $backupPS1 -Pattern '^\s*#@FGS_BACKUP_HEADER\s*$').Count
    $mir = @(Select-String -Path $backupPS1 -Pattern '^\s*#@FGS_DESKTOP_MIRROR\s*$').Count
  }

  # Mirror ZIP drift check
  $canonZip  = Join-Path $savesRoot "FGS_LATEST.zip"
  $deskZip   = Join-Path $deskFGS  "FGS_LATEST.zip"
  $zipStatus = "N/A"
  if ((Test-Path $canonZip) -and (Test-Path $deskZip)) {
    $c = Get-Item $canonZip
    $d = Get-Item $deskZip
    $zipStatus = if (($c.Length -eq $d.Length) -and ($c.LastWriteTime -eq $d.LastWriteTime)) { "OK" } else { "DRIFT?" }
  }

  # Git dirtiness (with porcelain list)
  $gitState  = "N/A"
  $dirtyList = ""
  try {
    $gs = git -C $repo status --porcelain 2>$null
    if ($gs) { $gitState = "DIRTY"; $dirtyList = ($gs -join "; ") } else { $gitState = "CLEAN" }
  } catch {}

  $lines = @(
    "[FGS HARD TRUTH FOOTER] " + ($now.ToString("yyyy-MM-dd HH:mm:ss")),
    "  Repo: " + $repo,
    "  Git:  " + $gitState,
    "  Dirty: " + $dirtyList,
    "  Desktop root offenders: " + $off.Count + "  (should be 0)",
    "  Desktop\FGS mirror files: " + $mirrorCount + " (should be 2)",
    "  Backup markers: header=" + $hdr + " mirror=" + $mir + " (should be 1/1)",
    "  Mirror ZIP quick-check: " + $zipStatus + " (size+time)"
  )

  $text = ($lines -join "`r`n")

  $global:FGS_TruthCache.LastRun = $now
  $global:FGS_TruthCache.Text    = $text

  return $text
}

Write-Host (Get-FgsFooterText -CacheSeconds $CacheSeconds)
