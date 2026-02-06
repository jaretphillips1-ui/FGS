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

# Canonical save root (ONE TRUE SAVE)
$saves = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST"
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
Desktop ZIP (local): $env:USERPROFILE\Desktop\FGS_LATEST.zip
Desktop ZIP (OneDrive): $env:USERPROFILE\OneDrive\Desktop\FGS_LATEST.zip
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

Write-Host "`n✅ Backup complete:"
Write-Host "  $latestZip"
Write-Host "  $stampedZip"
Write-Host "  $notePath"

# FGS_BACKUP_MIRROR
$null = New-FGSBackupMarker -Kind MIRROR
# ============================
# FORCE MIRROR TO BOTH DESKTOPS
# ============================
try {
  $saveZip = $latestZip
  if (Test-Path -LiteralPath $saveZip) {

    $desktopLocal    = Join-Path $env:USERPROFILE "Desktop"
    $desktopOneDrive = Join-Path $env:USERPROFILE "OneDrive\Desktop"

    $targets = @()

    if (Test-Path -LiteralPath $desktopLocal) {
      $targets += (Join-Path $desktopLocal "FGS_LATEST.zip")
    }
    if (Test-Path -LiteralPath $desktopOneDrive) {
      $targets += (Join-Path $desktopOneDrive "FGS_LATEST.zip")
    }

    if (@($targets).Count -eq 0) {
      Write-Warning "Desktop mirror skipped: no Desktop paths found."
    } else {
      foreach ($t in $targets) {
        Copy-Item -LiteralPath $saveZip -Destination $t -Force
      }

      Write-Host "✅ Desktop mirrored (forced):" -ForegroundColor Green
      foreach ($t in $targets) { Write-Host "  $t" }
    }

  } else {
    Write-Warning "Canonical zip missing for mirror: $saveZip"
  }
} catch {
  Write-Warning ("Desktop mirror (forced) failed: " + $_.Exception.Message)
}

# ============================
# FGS RETENTION POLICY
# - Keep FGS_LATEST.zip + CHECKPOINT.txt always
# - Keep only the newest 20 timestamped zips (FGS_LATEST_*.zip)
# ============================
try {
  $saveRoot = $saves
  if (Test-Path -LiteralPath $saveRoot) {

    $keep = 20

    # Force array no matter what (0/1/many)
    [array]$timestamped = @(Get-ChildItem -LiteralPath $saveRoot -File -Filter "FGS_LATEST_*.zip" -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending)

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
    Write-Warning ("Retention skipped: save root missing: " + $saveRoot)
  }
} catch {
  Write-Warning ("Retention failed: " + $_.Exception.Message)
}
