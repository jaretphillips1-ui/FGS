#@FGS_DESKTOP_MIRROR
#@FGS_BACKUP_HEADER
# FGS Backup (no-drift): works when executed as a script OR pasted
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

$repo  = Get-FgsRepoRoot


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

$saves = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST"
$desk  = "C:\Users\lsphi\Desktop\FGS"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"

Set-Location $repo
New-Item -ItemType Directory -Force -Path $saves | Out-Null

Write-Host "`n=== FGS BACKUP ==="
Write-Host "Repo: $repo"

$note = @"
FGS CHECKPOINT
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Repo: $repo
Branch: $(git branch --show-current)
Commit: $(git rev-parse --short HEAD)
Summary: Backup via scripts\fgs-backup.ps1
Latest ZIP: $saves\FGS_LATEST.zip
Stamped ZIP: $saves\FGS_LATEST_$stamp.zip
Desktop ZIP: $desk\FGS_LATEST.zip
"@

$notePath   = Join-Path $saves "FGS_LATEST_CHECKPOINT.txt"
$latestZip  = Join-Path $saves "FGS_LATEST.zip"
$stampedZip = Join-Path $saves ("FGS_LATEST_{0}.zip" -f $stamp)

$note | Set-Content -Path $notePath -Encoding UTF8

$tmp = Join-Path $env:TEMP ("FGS_STAGE_{0}" -f $stamp)
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

Copy-Item -Path (Join-Path $repo "*") `
  -Destination $tmp `
  -Recurse -Force `
  -Exclude @("node_modules",".next",".git") `
  -ErrorAction SilentlyContinue

Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $latestZip -Force
Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $stampedZip -Force

Remove-Item $tmp -Recurse -Force

Copy-Item -Path $latestZip -Destination (Join-Path $desk "FGS_LATEST.zip") -Force

Write-Host "`n✅ Backup complete:"
Write-Host "  $latestZip"
Write-Host "  $stampedZip"
Write-Host "  $notePath"
Write-Host "  Desktop mirrored"

# FGS_BACKUP_MIRROR
$null = New-FGSBackupMarker -Kind MIRROR
# ============================
# FORCE MIRROR TO BOTH DESKTOPS
# ============================
try {
  $saveZip = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST\FGS_LATEST.zip"
  if (Test-Path -LiteralPath $saveZip) {
    $desktopLocal    = Join-Path $env:USERPROFILE "Desktop\FGS_LATEST.zip"
    $desktopOneDrive = Join-Path $env:USERPROFILE "OneDrive\Desktop\FGS_LATEST.zip"
# (disabled) local desktop mirror
    Copy-Item -LiteralPath $saveZip -Destination $desktopOneDrive -Force

    Write-Host "✅ Desktop mirrored (forced):" -ForegroundColor Green
# (disabled) local desktop mirror path output
    Write-Host "  $desktopOneDrive"
  } else {
    Write-Warning "Canonical zip missing for mirror: $saveZip"
  }
} catch {
  Write-Warning ("Desktop mirror (forced) failed: " + $_.Exception.Message)
}

# ============================

# ============================
# FGS SCRIPT BACKUP GUARDRAIL
# - Never leave scripts\*.bak_* inside the repo (clutter + accidental commits)
# - Move any found backups to canonical: _SAVES\FGS\SCRIPT_BACKUPS
# - Keep only newest 50 backup folders; delete anything older than 30 days

# ============================
# FGS RETENTION POLICY
# - Keep FGS_LATEST.zip + CHECKPOINT.txt always
# - Keep only the newest 20 timestamped zips (FGS_LATEST_*.zip)
# ============================
try {
  $saveRoot = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST"
  if (Test-Path -LiteralPath $saveRoot) {

    $keep = 20

    # IMPORTANT: force array so .Count is always valid (even 0 or 1 result)
    $timestamped = @(
      Get-ChildItem -LiteralPath $saveRoot -File -Filter "FGS_LATEST_*.zip" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending
    )

    if ($timestamped.Count -gt $keep) {
      $toRemove = $timestamped | Select-Object -Skip $keep
      Write-Host ("🧹 Retention: removing {0} old timestamped zips (keeping newest {1})..." -f $toRemove.Count, $keep) -ForegroundColor Yellow
      foreach ($f in $toRemove) { Remove-Item -LiteralPath $f.FullName -Force }
    } else {
      Write-Host ("🧹 Retention: ok (timestamped zips: {0}, keep: {1})" -f $timestamped.Count, $keep) -ForegroundColor Green
    }

  } else {
    Write-Warning ("Retention skipped: save root missing: " + $saveRoot)
  }
} catch {
  Write-Warning ("Retention failed: " + $_.Exception.Message)
}



