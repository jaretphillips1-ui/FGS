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

# Desktop\FGS folders (never write to Desktop root)
$deskLocalFGS = Join-Path $desktopLocalRoot "FGS"
$deskODFGS    = Join-Path $desktopODRoot    "FGS"

# Canonical save root (ONE TRUE SAVE)
$savesRoot = Join-Path $oneDriveRoot "AI_Workspace\_SAVES\FGS\LATEST"
$canonZip  = Join-Path $savesRoot "FGS_LATEST.zip"
$canonNote = Join-Path $savesRoot "FGS_LATEST_CHECKPOINT.txt"

# Guardrail: enumerate destinations before we touch them
"`n--- PREVIEW TARGETS ---"
"Repo          : $repo"
"SAVES         : $savesRoot"
"DesktopLocalFGS: $deskLocalFGS"
"DesktopODFGS   : $deskODFGS"

"`nContents of SAVES (top):"
Get-ChildItem -LiteralPath $savesRoot -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 10 Name,Length,LastWriteTime |
  Format-Table -AutoSize

# Show both Desktop\FGS folders (top)
"`nContents of DesktopLocalFGS (top):"
New-Item -ItemType Directory -Force -Path $deskLocalFGS | Out-Null
Get-ChildItem -LiteralPath $deskLocalFGS -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 10 Name,Length,LastWriteTime |
  Format-Table -AutoSize

if (Test-Path -LiteralPath $desktopODRoot) {
  "`nContents of DesktopODFGS (top):"
  New-Item -ItemType Directory -Force -Path $deskODFGS | Out-Null
  Get-ChildItem -LiteralPath $deskODFGS -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 10 Name,Length,LastWriteTime |
    Format-Table -AutoSize
} else {
  "`nOneDrive Desktop root not found (skipping OD folder preview): $desktopODRoot"
}

# Run backup (canonical zip + note + folder-only mirror + retention)
$backup = Join-Path $repo "scripts\fgs-backup.ps1"
if (Test-Path -LiteralPath $backup) {
  "`n--- RUN BACKUP SCRIPT ---"
  & $backup
} else {
  throw "Missing: scripts\fgs-backup.ps1"
}

# Desktop ROOT offenders sweep (both roots) -> their Desktop\FGS folders
function Sweep-RootOffenders([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)][string]$FolderFGS, [Parameter(Mandatory)][string]$Name) {
  if (-not (Test-Path -LiteralPath $Root)) { return }

  New-Item -ItemType Directory -Force -Path $FolderFGS | Out-Null

  $off = @(
    Get-ChildItem -LiteralPath $Root -File -Filter "FGS_LATEST*.zip" -ErrorAction SilentlyContinue
    Get-ChildItem -LiteralPath $Root -File -Filter "FGS_LATEST*CHECKPOINT*.txt" -ErrorAction SilentlyContinue
  ) | Where-Object { $_ }

  if (@($off).Count -gt 0) {
    foreach ($f in $off) {
      Move-Item -Force -LiteralPath $f.FullName -Destination (Join-Path $FolderFGS $f.Name)
    }
    "🧹 Swept $(@($off).Count) offender(s) off $Name root -> $FolderFGS"
  } else {
    "✅ Desktop root offenders ($Name): 0"
  }
}

"`n--- Desktop root offenders sweep ---"
Sweep-RootOffenders -Root $desktopLocalRoot -FolderFGS $deskLocalFGS -Name "local" | Out-Host
if (Test-Path -LiteralPath $desktopODRoot) {
  Sweep-RootOffenders -Root $desktopODRoot -FolderFGS $deskODFGS -Name "od" | Out-Host
}

# Re-mirror canonical ZIP + note into BOTH Desktop\FGS folders (canonical always wins)
"`n--- Re-mirror from canonical _SAVES (both Desktop\FGS folders) ---"
if (-not (Test-Path -LiteralPath $canonZip))  { throw "Missing canonical zip: $canonZip" }
if (-not (Test-Path -LiteralPath $canonNote)) { throw "Missing canonical note: $canonNote" }

New-Item -ItemType Directory -Force -Path $deskLocalFGS | Out-Null
Copy-Item -Force -LiteralPath $canonZip  -Destination (Join-Path $deskLocalFGS "FGS_LATEST.zip")
Copy-Item -Force -LiteralPath $canonNote -Destination (Join-Path $deskLocalFGS "FGS_LATEST_CHECKPOINT.txt")
"✅ Re-mirrored DesktopLocalFGS from canonical _SAVES" | Out-Host

if (Test-Path -LiteralPath $desktopODRoot) {
  New-Item -ItemType Directory -Force -Path $deskODFGS | Out-Null
  Copy-Item -Force -LiteralPath $canonZip  -Destination (Join-Path $deskODFGS "FGS_LATEST.zip")
  Copy-Item -Force -LiteralPath $canonNote -Destination (Join-Path $deskODFGS "FGS_LATEST_CHECKPOINT.txt")
  "✅ Re-mirrored DesktopODFGS from canonical _SAVES" | Out-Host
}

# Verify drift (size + time) for BOTH mirrors
function Verify-ZipMirror([Parameter(Mandatory)][string]$MirrorFolder, [Parameter(Mandatory)][string]$Name) {
  $mz = Join-Path $MirrorFolder "FGS_LATEST.zip"
  if (-not (Test-Path -LiteralPath $mz)) { "⚠️ $Name mirror missing zip: $mz"; return }

  $c = Get-Item -LiteralPath $canonZip
  $m = Get-Item -LiteralPath $mz
  "Canon($Name): $($c.Length) bytes @ $($c.LastWriteTime)"
  "Mirr ($Name): $($m.Length) bytes @ $($m.LastWriteTime)"
  if (($c.Length -eq $m.Length) -and ($c.LastWriteTime -eq $m.LastWriteTime)) { "✅ Mirror ZIP ($Name): OK" } else { "⚠️ Mirror ZIP ($Name): DRIFT? (size+time)" }
}

"`n--- Verify mirror drift (size+time) ---"
Verify-ZipMirror -MirrorFolder $deskLocalFGS -Name "local" | Out-Host
if (Test-Path -LiteralPath $desktopODRoot) {
  Verify-ZipMirror -MirrorFolder $deskODFGS -Name "od" | Out-Host
}

# Stop node (dev server)
"`n--- Stop dev server (node) ---"
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
"✅ node stopped (if it was running)" | Out-Host

# Clear Next lock
$lock = Join-Path $repo ".next\dev\lock"
if (Test-Path -LiteralPath $lock) { Remove-Item -Force -LiteralPath $lock; "✅ Cleared .next\dev\lock" | Out-Host }

# Final hard truth check (FULL PATH, no $PSScriptRoot dependency)
"`n--- Final hard truth ---"
& (Join-Path $repo "scripts\fgs-hard-truth.ps1") | Write-Host
