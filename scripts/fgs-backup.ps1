#@FGS_DESKTOP_MIRROR
#@FGS_BACKUP_HEADER
# FGS Backup (no-drift): works when executed as a script OR pasted
# POLICY: Only OneDrive Desktop mirror is allowed. Never write to local Desktop\FGS.
# POLICY: OneDrive Desktop\FGS mirror allowed files: FGS_LATEST.zip + FGS_MASTER_CHECKPOINT.txt ONLY.
# POLICY: LAST_RUN / TURNOVER status notes must NEVER be placed in the mirror folder.

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

  return "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
}

$repo = Get-FgsRepoRoot

# --- FGS backup markers (for fgs-hard-truth.ps1) ---
$__fgs_logs = Join-Path $repo "scripts\logs"
New-Item -ItemType Directory -Force -Path $__fgs_logs | Out-Null

function New-FGSBackupMarker([Parameter(Mandatory)][ValidateSet("HEADER","MIRROR")]$Kind) {
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $name  = "FGS_BACKUP_${Kind}_${stamp}.txt"
  $path  = Join-Path $__fgs_logs $name
  "FGS BACKUP $Kind @ $(Get-Date -Format o)`r`nRepo: $repo" | Set-Content -Encoding UTF8 -LiteralPath $path
  return $path
}
# ---------------------------------------------------

# FGS_BACKUP_HEADER
$null = New-FGSBackupMarker -Kind HEADER

# Canonical save root (ONE TRUE SAVE)
$saves = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"

Set-Location $repo
New-Item -ItemType Directory -Force -Path $saves | Out-Null

Write-Host "`n=== FGS BACKUP ==="
Write-Host "Repo: $repo"

# Desktop roots
$desktopLocalRoot = Join-Path $env:USERPROFILE "Desktop"

$oneDriveRoot = $env:OneDrive
if ([string]::IsNullOrWhiteSpace($oneDriveRoot)) {
  $oneDriveRoot = Join-Path $env:USERPROFILE "OneDrive"
}
$desktopOneDriveRoot = Join-Path $oneDriveRoot "Desktop"
$desktopOneDriveFGS  = Join-Path $desktopOneDriveRoot "FGS"

# Drift archive root (for any unexpected Desktop mirror content OR status notes)
$archiveRoot = Join-Path $oneDriveRoot "AI_Workspace\_SAVES\FGS\DESKTOP_ARCHIVE"

$masterNotePath = Join-Path $saves "FGS_MASTER_CHECKPOINT.txt"
$latestZip      = Join-Path $saves "FGS_LATEST.zip"
$stampedZip     = Join-Path $saves ("FGS_LATEST_{0}.zip" -f $stamp)

$note = @"
FGS MASTER CHECKPOINT
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Repo: $repo
Branch: $(git branch --show-current)
Commit: $(git rev-parse --short HEAD)
Summary: Backup via scripts\fgs-backup.ps1
Latest ZIP: $latestZip
Stamped ZIP: $stampedZip
Desktop ZIP (OneDrive folder): $desktopOneDriveFGS\FGS_LATEST.zip
"@

$note | Set-Content -LiteralPath $masterNotePath -Encoding UTF8

# Stage repo (exclude bulky folders), then zip
$tmp = Join-Path $env:TEMP ("FGS_STAGE_{0}" -f $stamp)
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

Copy-Item -Path (Join-Path $repo "*") `
  -Destination $tmp `
  -Recurse -Force `
  -Exclude @("node_modules",".next",".git") `
  -ErrorAction SilentlyContinue

Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $latestZip  -Force
Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $stampedZip -Force

Remove-Item $tmp -Recurse -Force

Write-Host "`n✅ Backup complete:"
Write-Host "  $latestZip"
Write-Host "  $stampedZip"
Write-Host "  $masterNotePath"

# FGS_BACKUP_MIRROR
$null = New-FGSBackupMarker -Kind MIRROR

# ============================
# MIRROR (NO LOCAL DESKTOP\FGS)
# - Mirror ZIP + MASTER CHECKPOINT into OneDrive\Desktop\FGS only
# - Sweep ZIP/CHECKPOINT offenders off Desktop ROOTS into OneDrive\Desktop\FGS
# - Archive LAST_RUN / TURNOVER notes to DESKTOP_ARCHIVE (NEVER into mirror)
# - Hard-prune mirror folder so it contains ONLY the allowed set
# - If local Desktop\FGS exists, archive+remove it
# ============================
try {
  if (-not (Test-Path -LiteralPath $latestZip)) {
    throw "Canonical zip missing for mirror: $latestZip"
  }
  if (-not (Test-Path -LiteralPath $masterNotePath)) {
    throw "Master checkpoint note missing for mirror: $masterNotePath"
  }

  if (-not (Test-Path -LiteralPath $desktopOneDriveRoot)) {
    throw "OneDrive Desktop root not found: $desktopOneDriveRoot"
  }

  # HARD GUARD: local Desktop\FGS is not allowed; archive+remove if present
  $desktopLocalFGS = Join-Path $desktopLocalRoot "FGS"
  if (Test-Path -LiteralPath $desktopLocalFGS) {
    $stamp2  = Get-Date -Format "yyyyMMdd_HHmmss"
    $archive = Join-Path $archiveRoot "LocalDesktop_FGS_$stamp2"
    New-Item -ItemType Directory -Force -Path $archive | Out-Null

    Get-ChildItem -LiteralPath $desktopLocalFGS -Force -ErrorAction SilentlyContinue |
      ForEach-Object {
        Copy-Item -Force -LiteralPath $_.FullName -Destination (Join-Path $archive $_.Name)
      }

    Remove-Item -Recurse -Force -LiteralPath $desktopLocalFGS
    Write-Warning "Local Desktop\FGS mirror detected and removed (archived to): $archive"
  }

  # OneDrive Desktop\FGS (ONLY)
  New-Item -ItemType Directory -Force -Path $desktopOneDriveFGS | Out-Null

  # Mirror the two allowed files
  Copy-Item -LiteralPath $latestZip      -Destination (Join-Path $desktopOneDriveFGS "FGS_LATEST.zip") -Force
  Copy-Item -LiteralPath $masterNotePath -Destination (Join-Path $desktopOneDriveFGS "FGS_MASTER_CHECKPOINT.txt") -Force

  Write-Host "✅ Desktop mirrored (OneDrive folder-only):" -ForegroundColor Green
  Write-Host ("  {0}" -f $desktopOneDriveFGS)

  function Ensure-Dir([Parameter(Mandatory)][string]$Path) {
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
  }

  # Sweep ZIP/CHECKPOINT offenders off Desktop roots into OneDrive\Desktop\FGS
  function Sweep-ZipCheckpointOffenders([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)][string]$Name) {
    if (-not (Test-Path -LiteralPath $Root)) { return }

    [array]$off = @(
      Get-ChildItem -LiteralPath $Root -File -Filter "FGS_LATEST*.zip" -ErrorAction SilentlyContinue
      Get-ChildItem -LiteralPath $Root -File -Filter "FGS_*CHECKPOINT*.txt" -ErrorAction SilentlyContinue
    ) | Where-Object { $_ }

    if (@($off).Count -gt 0) {
      foreach ($f in $off) {
        Move-Item -Force -LiteralPath $f.FullName -Destination (Join-Path $desktopOneDriveFGS $f.Name)
      }
      Write-Host ("🧹 Swept {0} ZIP/CHECKPOINT offender(s) off {1} Desktop ROOT -> OneDrive\Desktop\FGS" -f @($off).Count, $Name) -ForegroundColor Yellow
    }
  }

  # Archive LAST_RUN / TURNOVER notes off Desktop roots (NEVER into mirror)
  function Archive-StatusNotes([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)][string]$Name) {
    if (-not (Test-Path -LiteralPath $Root)) { return }

    [array]$notes = @(
      Get-ChildItem -LiteralPath $Root -File -Filter "FGS_LAST_RUN*.txt" -ErrorAction SilentlyContinue
      Get-ChildItem -LiteralPath $Root -File -Filter "FGS_TURNOVER_*.txt" -ErrorAction SilentlyContinue
    ) | Where-Object { $_ }

    if (@($notes).Count -gt 0) {
      $stampN = Get-Date -Format "yyyyMMdd_HHmmss"
      $dest = Join-Path $archiveRoot ("DesktopRoot_StatusNotes_{0}_{1}" -f $Name, $stampN)
      Ensure-Dir $dest

      foreach ($n in $notes) {
        Copy-Item -Force -LiteralPath $n.FullName -Destination (Join-Path $dest $n.Name)
        Remove-Item -Force -LiteralPath $n.FullName
      }

      Write-Host ("🧹 Archived {0} status note(s) off {1} Desktop ROOT -> {2}" -f @($notes).Count, $Name, $dest) -ForegroundColor Yellow
    }
  }

  Sweep-ZipCheckpointOffenders -Root $desktopLocalRoot    -Name "local"
  Sweep-ZipCheckpointOffenders -Root $desktopOneDriveRoot -Name "od"

  Archive-StatusNotes -Root $desktopLocalRoot    -Name "local"
  Archive-StatusNotes -Root $desktopOneDriveRoot -Name "od"

  # HARD PRUNE: mirror folder must contain ONLY the allowed set
  $allowed = @("FGS_LATEST.zip","FGS_MASTER_CHECKPOINT.txt")
  $extras = @(
    Get-ChildItem -LiteralPath $desktopOneDriveFGS -Force -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -notin $allowed }
  )

  if (@($extras).Count -gt 0) {
    $stamp3 = Get-Date -Format "yyyyMMdd_HHmmss"
    $archive = Join-Path $archiveRoot "OneDriveDesktop_FGS_EXTRAS_$stamp3"
    New-Item -ItemType Directory -Force -Path $archive | Out-Null

    foreach ($x in $extras) {
      Copy-Item -Force -LiteralPath $x.FullName -Destination (Join-Path $archive $x.Name)
      Remove-Item -Force -LiteralPath $x.FullName
    }

    Write-Host ("🧹 Pruned {0} extra file(s) from OneDrive\Desktop\FGS (archived to): {1}" -f @($extras).Count, $archive) -ForegroundColor Yellow
  }

} catch {
  Write-Warning ("Desktop mirror (OneDrive folder-only) failed: " + $_.Exception.Message)
}

# ============================
# FGS RETENTION POLICY
# - Keep FGS_LATEST.zip + FGS_MASTER_CHECKPOINT.txt always
# - Keep only the newest 20 timestamped zips (FGS_LATEST_*.zip)
# ============================
try {
  if (Test-Path -LiteralPath $saves) {

    $keep = 20

    [array]$timestamped = @(
      Get-ChildItem -LiteralPath $saves -File -Filter "FGS_LATEST_*.zip" -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending
    )

    $tsCount = @($timestamped).Count

    if ($tsCount -gt $keep) {
      [array]$toRemove = @($timestamped | Select-Object -Skip $keep)
      $rmCount = @($toRemove).Count

      Write-Host ("🧹 Retention: removing {0} old timestamped zips (keeping newest {1})..." -f $rmCount, $keep) -ForegroundColor Yellow
      foreach ($f in $toRemove) { Remove-Item -LiteralPath $f.FullName -Force }
    } else {
      Write-Host ("🧹 Retention: ok (timestamped zips: {0}, keep: {1})" -f $tsCount, $keep) -ForegroundColor Green
    }

  } else {
    Write-Warning ("Retention skipped: save root missing: " + $saves)
  }
} catch {
  Write-Warning ("Retention failed: " + $_.Exception.Message)
}
