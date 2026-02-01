param(
  [string]$Message = "Checkpoint"
)

$ErrorActionPreference = "Stop"

# --- Identity
$projectName = "FGS"

# --- Paths (authoritative)
$workspace   = "C:\Users\lsphi\OneDrive\AI_Workspace"
$projectRoot = Join-Path $workspace $projectName

# Repo is parent folder of scripts\
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

# --- Save folders (OneDrive authoritative)
$savesRoot  = Join-Path $workspace "_SAVES"
$projectDir = Join-Path $savesRoot $projectName
$latestDir  = Join-Path $projectDir "LATEST"
$backupDir  = Join-Path $projectDir "BACKUP"
New-Item -ItemType Directory -Force $latestDir,$backupDir | Out-Null

# --- Optional DROP folder (quick cloud mirror)
$drop = Join-Path $projectRoot "_DROP"
New-Item -ItemType Directory -Force $drop | Out-Null

# --- Timestamp
$ts   = Get-Date -Format "yyyy-MM-dd__HHmmss"
$base = "$($projectName)__SAVE__$ts"

# --- Git facts (best-effort)
$branch = (git rev-parse --abbrev-ref HEAD) 2>$null
$sha    = (git rev-parse --short HEAD) 2>$null
$last   = (git log -1 --pretty=format:"%ad | %s" --date=iso) 2>$null

# --- Core files in repo
$checkpointPath = Join-Path $repo "$($projectName)_MASTER_CHECKPOINT.txt"
$foundationPath = Join-Path $repo "$($projectName)_FOUNDATION.md"
$zipPath        = Join-Path $repo 'FGS_LATEST.zip'

# --- Write checkpoint (overwrite)
@"
$projectName MASTER CHECKPOINT (LATEST)
===============================

When:     $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Message:  $Message

Repo:     $repo
Branch:   $branch
Commit:   $sha
Last:     $last

Run:
- npm run dev

Notes:
- This file is overwritten on every SAVE.
- Zip is created fresh on every SAVE (git tracked files only).
- FOUNDATION is a living file: $($projectName)_FOUNDATION.md (if present)
"@ | Set-Content -Encoding utf8 $checkpointPath

# --- Ensure at least one commit exists so git archive works
git rev-parse --verify HEAD 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  git add -A
  git commit -m "$projectName baseline init" | Out-Null
}

# --- Create zip from git (tracked files only)
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
git archive --format=zip --output $zipPath HEAD

# --- BACKUP MODEL (keep 1): move previous LATEST zip to BACKUP (overwrite)
$latestZip = Join-Path $latestDir "$($projectName)_LATEST.zip"
$backupZip = Join-Path $backupDir "$($projectName)_BACKUP.zip"

if (Test-Path $latestZip) {
  Move-Item -Force $latestZip $backupZip
}

# --- Copy to LATEST (overwrite)
Copy-Item -Force $checkpointPath (Join-Path $latestDir "$($projectName)_MASTER_CHECKPOINT.txt")
if (Test-Path $foundationPath) {
  Copy-Item -Force $foundationPath (Join-Path $latestDir "$($projectName)_FOUNDATION.md")
}
Copy-Item -Force $zipPath $latestZip

# --- Copy to DROP (kept simple)
Copy-Item -Force $checkpointPath (Join-Path $drop "$($projectName)_MASTER_CHECKPOINT.txt")
if (Test-Path $foundationPath) {
  Copy-Item -Force $foundationPath (Join-Path $drop "$($projectName)_FOUNDATION.md")
}
Copy-Item -Force $latestZip (Join-Path $drop "$($projectName)_LATEST.zip")
if (Test-Path $backupZip) {
  Copy-Item -Force $backupZip (Join-Path $drop "$($projectName)_BACKUP.zip")
}

Write-Host ""
Write-Host "✅ $projectName SAVED" -ForegroundColor Green
Write-Host "📦 LATEST:  $latestDir"  -ForegroundColor Cyan
Write-Host "🧯 BACKUP:  $backupDir (keeps 1)" -ForegroundColor Cyan
Write-Host "☁ DROP:    $drop"       -ForegroundColor Cyan
Write-Host ""
Write-Host "Repo files written:" -ForegroundColor DarkGray
Write-Host " - $checkpointPath"
Write-Host " - $zipPath"



