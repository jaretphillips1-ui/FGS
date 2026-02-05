Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo = "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
Set-Location $repo

# Preconditions
git status | Out-Host
if (-not [string]::IsNullOrWhiteSpace((git status --porcelain))) {
  throw "Repo is DIRTY. Commit/stash before save+shutdown."
}

$desktop   = Join-Path $env:USERPROFILE "Desktop"
$deskFGS   = Join-Path $desktop "FGS"
$savesRoot = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST"
$canonZip  = Join-Path $savesRoot "FGS_LATEST.zip"
$canonNote = Join-Path $savesRoot "FGS_LATEST_CHECKPOINT.txt"

# Guardrail: enumerate destinations before we touch them
"`n--- PREVIEW TARGETS ---"
"Repo      : $repo"
"SAVES     : $savesRoot"
"DesktopFGS: $deskFGS"
"`nContents of SAVES (top):"
Get-ChildItem $savesRoot -File | Sort-Object LastWriteTime -Descending | Select-Object -First 10 Name,Length,LastWriteTime | Format-Table -AutoSize

"`nContents of Desktop\FGS (top):"
New-Item -ItemType Directory -Force -Path $deskFGS | Out-Null
Get-ChildItem $deskFGS -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 10 Name,Length,LastWriteTime | Format-Table -AutoSize

# Run your existing backup script if present
$backup = Join-Path $repo "scripts\fgs-backup.ps1"
if (Test-Path $backup) {
  "`n--- RUN BACKUP SCRIPT ---"
  & $backup
} else {
  "`n⚠️ scripts\fgs-backup.ps1 not found. Skipping backup step."
}

# Move any offenders off Desktop root (never leave them there)
"`n--- Desktop root offenders sweep ---"
$off = @(
  Get-ChildItem $desktop -File -Filter "FGS_LATEST*.zip" -ErrorAction SilentlyContinue
  Get-ChildItem $desktop -File -Filter "FGS_LATEST*CHECKPOINT*.txt" -ErrorAction SilentlyContinue
) | Where-Object { $_ }

if (@($off).Count -gt 0) {
  foreach ($f in $off) {
    Move-Item -Force -LiteralPath $f.FullName -Destination (Join-Path $deskFGS $f.Name)
  }
  "✅ Moved offenders into Desktop\FGS"
} else {
  "✅ Desktop root offenders: 0"
}

# Re-mirror canonical ZIP + note into Desktop\FGS (canonical always wins)
"`n--- Re-mirror from canonical _SAVES ---"
Copy-Item -Force -LiteralPath $canonZip  -Destination (Join-Path $deskFGS "FGS_LATEST.zip")
Copy-Item -Force -LiteralPath $canonNote -Destination (Join-Path $deskFGS "FGS_LATEST_CHECKPOINT.txt")
"✅ Re-mirrored Desktop\FGS from canonical _SAVES"

# Verify drift (size + time)
"`n--- Verify mirror drift (size+time) ---"
$c = Get-Item $canonZip
$d = Get-Item (Join-Path $deskFGS "FGS_LATEST.zip")
"Canon: $($c.Length) bytes @ $($c.LastWriteTime)"
"Desk : $($d.Length) bytes @ $($d.LastWriteTime)"
if (($c.Length -eq $d.Length) -and ($c.LastWriteTime -eq $d.LastWriteTime)) { "✅ Mirror ZIP: OK" } else { "⚠️ Mirror ZIP: DRIFT? (size+time)" }

# Stop node (dev server)
"`n--- Stop dev server (node) ---"
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
"✅ node stopped (if it was running)"

# Clear Next lock
$lock = Join-Path $repo ".next\dev\lock"
if (Test-Path $lock) { Remove-Item -Force -LiteralPath $lock; "✅ Cleared .next\dev\lock" }

# Final hard truth check
"`n--- Final hard truth ---"
& "$PSScriptRoot\fgs-hard-truth.ps1" | Write-Host
