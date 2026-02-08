#@FGS_DESKTOP_MIRROR
#@FGS_BACKUP_HEADER
# FGS Backup (no-drift): works when executed as a script OR pasted

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

# Desktop folders (IMPORTANT: never write to Desktop root)
$desktopLocalRoot = Join-Path $env:USERPROFILE "Desktop"
$desktopLocalFGS  = Join-Path $desktopLocalRoot "FGS"

$oneDriveRoot = $env:OneDrive
if ([string]::IsNullOrWhiteSpace($oneDriveRoot)) {
  $oneDriveRoot = Join-Path $env:USERPROFILE "OneDrive"
}
$desktopOneDriveRoot = Join-Path $oneDriveRoot "Desktop"
$desktopOneDriveFGS  = Join-Path $desktopOneDriveRoot "FGS"

$notePath   = Join-Path $saves "FGS_LATEST_CHECKPOINT.txt"
$latestZip  = Join-Path $saves "FGS_LATEST.zip"
$stampedZip = Join-Path $saves ("FGS_LATEST_{0}.zip" -f $stamp)

$note = @"
FGS CHECKPOINT
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Repo: $repo
Branch: $(git branch --show-current)
Commit: $(git rev-parse --short HEAD)
Summary: Backup via scripts\fgs-backup.ps1
Latest ZIP: $latestZip
Stamped ZIP: $stampedZip
Desktop ZIP (local folder): $desktopLocalFGS\FGS_LATEST.zip
Desktop ZIP (OneDrive folder): $desktopOneDriveFGS\FGS_LATEST.zip
"@

$note | Set-Content -Path $notePath -Encoding UTF8

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
Write-Host "  $notePath"

# FGS_BACKUP_MIRROR
$null = New-FGSBackupMarker -Kind MIRROR

# ============================
# MIRROR (NO DESKTOP ROOT)
# - Mirror ZIP + CHECKPOINT into Desktop\FGS
# - Optionally also into OneDrive\Desktop\FGS if OneDrive Desktop exists
# - Sweep any legacy offenders off Desktop roots into the folder
# ============================
try {
  if (-not (Test-Path -LiteralPath $latestZip)) {
    throw "Canonical zip missing for mirror: $latestZip"
  }
  if (-not (Test-Path -LiteralPath $notePath)) {
    throw "Checkpoint note missing for mirror: $notePath"
  }

  $targets = @()

  # Local Desktop\FGS (always)
  if (Test-Path -LiteralPath $desktopLocalRoot) {
    New-Item -ItemType Directory -Force -Path $desktopLocalFGS | Out-Null
    $targets += [pscustomobject]@{
      Name      = "DesktopLocalFGS"
      ZipPath   = (Join-Path $desktopLocalFGS "FGS_LATEST.zip")
      NotePath  = (Join-Path $desktopLocalFGS "FGS_LATEST_CHECKPOINT.txt")
      Root      = $desktopLocalRoot
      FolderFGS = $desktopLocalFGS
    }
  }

  # OneDrive Desktop\FGS (only if OneDrive Desktop exists)
  if (Test-Path -LiteralPath $desktopOneDriveRoot) {
    New-Item -ItemType Directory -Force -Path $desktopOneDriveFGS | Out-Null
    $targets += [pscustomobject]@{
      Name      = "DesktopOneDriveFGS"
      ZipPath   = (Join-Path $desktopOneDriveFGS "FGS_LATEST.zip")
      NotePath  = (Join-Path $desktopOneDriveFGS "FGS_LATEST_CHECKPOINT.txt")
      Root      = $desktopOneDriveRoot
      FolderFGS = $desktopOneDriveFGS
    }
  }

  if (@($targets).Count -eq 0) {
    Write-Warning "Desktop mirror skipped: no Desktop targets found."
  } else {
    foreach ($t in $targets) {
      Copy-Item -LiteralPath $latestZip -Destination $t.ZipPath  -Force
      Copy-Item -LiteralPath $notePath  -Destination $t.NotePath -Force
    }

    Write-Host "✅ Desktop mirrored (folder-only):" -ForegroundColor Green
    foreach ($t in $targets) {
      Write-Host ("  {0}: {1}" -f $t.Name, (Split-Path -Parent $t.ZipPath))
    }
  }

  # Legacy offenders sweep: NEVER allow these on Desktop roots
  foreach ($t in $targets) {
    $off = @(
      Get-ChildItem -LiteralPath $t.Root -File -Filter "FGS_LATEST*.zip" -ErrorAction SilentlyContinue
      Get-ChildItem -LiteralPath $t.Root -File -Filter "FGS_LATEST*CHECKPOINT*.txt" -ErrorAction SilentlyContinue
    ) | Where-Object { $_ }

    if (@($off).Count -gt 0) {
      foreach ($f in $off) {
        Move-Item -Force -LiteralPath $f.FullName -Destination (Join-Path $t.FolderFGS $f.Name)
      }
      Write-Host ("🧹 Swept {0} offender(s) off {1} root -> {2}" -f @($off).Count, $t.Name, $t.FolderFGS) -ForegroundColor Yellow
    }
  }

} catch {
  Write-Warning ("Desktop mirror (folder-only) failed: " + $_.Exception.Message)
}

# ============================
# FGS RETENTION POLICY
# - Keep FGS_LATEST.zip + CHECKPOINT.txt always
# - Keep only the newest 20 timestamped zips (FGS_LATEST_*.zip)
# ============================
try {
  if (Test-Path -LiteralPath $saves) {

    $keep = 20

    # Force array no matter what (0/1/many)
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
