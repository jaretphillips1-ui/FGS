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

function Write-Ok($msg)   { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function Write-Bad($msg)  { Write-Host "❌ $msg" -ForegroundColor Red }

$repo = Get-FgsRepoRoot
Set-Location $repo

# Preconditions
git status | Out-Host
if (-not [string]::IsNullOrWhiteSpace((git status --porcelain))) {
  throw "Repo is DIRTY. Commit/stash before save+shutdown."
}

# Roots
$desktopLocalRoot = Join-Path $env:USERPROFILE "Desktop"

$oneDriveRoot = $env:OneDrive
if ([string]::IsNullOrWhiteSpace($oneDriveRoot)) {
  $oneDriveRoot = Join-Path $env:USERPROFILE "OneDrive"
}
$desktopODRoot = Join-Path $oneDriveRoot "Desktop"

if (-not (Test-Path -LiteralPath $desktopODRoot)) {
  throw "OneDrive Desktop root not found. Expected: $desktopODRoot"
}

# POLICY: ONLY ONE desktop mirror is allowed (OneDrive Desktop)
$deskODFGS = Join-Path $desktopODRoot "FGS"

# Canonical save root (ONE TRUE SAVE)
$savesRoot = Join-Path $oneDriveRoot "AI_Workspace\_SAVES\FGS\LATEST"
$canonZip  = Join-Path $savesRoot "FGS_LATEST.zip"
$canonNote = Join-Path $savesRoot "FGS_LATEST_CHECKPOINT.txt"

# Drift archive root
$archiveRoot = Join-Path $oneDriveRoot "AI_Workspace\_SAVES\FGS\DESKTOP_ARCHIVE"

# Guardrail: enumerate destinations before we touch them
"`n--- PREVIEW TARGETS ---"
"Repo         : $repo"
"SAVES        : $savesRoot"
"DesktopODFGS : $deskODFGS"
"DesktopLocal : $desktopLocalRoot (NO MIRROR ALLOWED)"

"`nContents of SAVES (top):"
Get-ChildItem -LiteralPath $savesRoot -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 10 Name,Length,LastWriteTime |
  Format-Table -AutoSize

"`nContents of DesktopODFGS (top):"
New-Item -ItemType Directory -Force -Path $deskODFGS | Out-Null
Get-ChildItem -LiteralPath $deskODFGS -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 10 Name,Length,LastWriteTime |
  Format-Table -AutoSize

# HARD GUARD: if a local Desktop\FGS mirror exists, archive + remove it (drift prevention)
$deskLocalFGS = Join-Path $desktopLocalRoot "FGS"
if (Test-Path -LiteralPath $deskLocalFGS) {
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $archive = Join-Path $archiveRoot "LocalDesktop_FGS_$stamp"
  New-Item -ItemType Directory -Force -Path $archive | Out-Null

  Get-ChildItem -LiteralPath $deskLocalFGS -Force -ErrorAction SilentlyContinue |
    ForEach-Object {
      Copy-Item -Force -LiteralPath $_.FullName -Destination (Join-Path $archive $_.Name)
    }

  Remove-Item -Recurse -Force -LiteralPath $deskLocalFGS
  Write-Warn "Local Desktop mirror detected and removed (archived to): $archive"
} else {
  Write-Ok "No local Desktop mirror folder exists (good)."
}

# Run backup (canonical zip + note + retention)
$backup = Join-Path $repo "scripts\fgs-backup.ps1"
if (Test-Path -LiteralPath $backup) {
  "`n--- RUN BACKUP SCRIPT ---"
  & $backup
} else {
  throw "Missing: scripts\fgs-backup.ps1"
}

# Desktop ROOT offenders sweep (both roots) -> OneDrive Desktop\FGS only
function Sweep-RootOffendersToOD([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)][string]$DestFolderFGS, [Parameter(Mandatory)][string]$Name) {
  if (-not (Test-Path -LiteralPath $Root)) { return }

  New-Item -ItemType Directory -Force -Path $DestFolderFGS | Out-Null

  $off = @(
    Get-ChildItem -LiteralPath $Root -File -Filter "FGS_LATEST*.zip" -ErrorAction SilentlyContinue
    Get-ChildItem -LiteralPath $Root -File -Filter "FGS_LATEST*CHECKPOINT*.txt" -ErrorAction SilentlyContinue
  ) | Where-Object { $_ }

  if (@($off).Count -gt 0) {
    foreach ($f in $off) {
      Move-Item -Force -LiteralPath $f.FullName -Destination (Join-Path $DestFolderFGS $f.Name)
    }
    Write-Warn "Swept $(@($off).Count) offender(s) off $Name Desktop ROOT -> OneDrive Desktop\FGS"
  } else {
    Write-Ok "Desktop root offenders ($Name): 0"
  }
}

"`n--- Desktop root offenders sweep (to OneDrive Desktop\FGS) ---"
Sweep-RootOffendersToOD -Root $desktopLocalRoot -DestFolderFGS $deskODFGS -Name "local" | Out-Host
Sweep-RootOffendersToOD -Root $desktopODRoot    -DestFolderFGS $deskODFGS -Name "od"    | Out-Host

# Mirror canonical ZIP + note into OneDrive Desktop\FGS (canonical always wins)
"`n--- Mirror from canonical _SAVES -> OneDrive Desktop\FGS (ONLY) ---"
if (-not (Test-Path -LiteralPath $canonZip))  { throw "Missing canonical zip: $canonZip" }
if (-not (Test-Path -LiteralPath $canonNote)) { throw "Missing canonical note: $canonNote" }

New-Item -ItemType Directory -Force -Path $deskODFGS | Out-Null
Copy-Item -Force -LiteralPath $canonZip  -Destination (Join-Path $deskODFGS "FGS_LATEST.zip")
Copy-Item -Force -LiteralPath $canonNote -Destination (Join-Path $deskODFGS "FGS_LATEST_CHECKPOINT.txt")
Write-Ok "Re-mirrored OneDrive Desktop\FGS from canonical _SAVES"

# Verify mirror drift (hash + size)
function Verify-FileMatch([Parameter(Mandatory)][string]$Canon, [Parameter(Mandatory)][string]$Mirror, [Parameter(Mandatory)][string]$Name) {
  if (-not (Test-Path -LiteralPath $Mirror)) { throw "Mirror missing ($Name): $Mirror" }

  $c = Get-Item -LiteralPath $Canon
  $m = Get-Item -LiteralPath $Mirror
  $ch = (Get-FileHash -LiteralPath $Canon  -Algorithm SHA256).Hash
  $mh = (Get-FileHash -LiteralPath $Mirror -Algorithm SHA256).Hash

  Write-Host "Canon ($Name): $($c.Length) bytes @ $($c.LastWriteTime)"
  Write-Host "Mirr ($Name): $($m.Length) bytes @ $($m.LastWriteTime)"
  if ($ch -eq $mh) { Write-Ok "Mirror ($Name): HASH OK" } else { throw "Mirror ($Name): HASH MISMATCH" }
}

"`n--- Verify mirror drift (hash) ---"
Verify-FileMatch -Canon $canonZip  -Mirror (Join-Path $deskODFGS "FGS_LATEST.zip")            -Name "ZIP"  | Out-Host
Verify-FileMatch -Canon $canonNote -Mirror (Join-Path $deskODFGS "FGS_LATEST_CHECKPOINT.txt") -Name "NOTE" | Out-Host

# Stop node (dev server)
"`n--- Stop dev server (node) ---"
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Ok "node stopped (if it was running)"

# Clear Next lock
$lock = Join-Path $repo ".next\dev\lock"
if (Test-Path -LiteralPath $lock) {
  Remove-Item -Force -LiteralPath $lock
  Write-Ok "Cleared .next\dev\lock"
}

# Final hard truth check (FULL PATH, no $PSScriptRoot dependency)
"`n--- Final hard truth ---"
& (Join-Path $repo "scripts\fgs-hard-truth.ps1") | Write-Host
