Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo = (Resolve-Path ".").Path
$desktop = Join-Path $env:USERPROFILE "Desktop"
$deskFGS = Join-Path $desktop "FGS"
$savesRoot = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST"
$canonZip  = Join-Path $savesRoot "FGS_LATEST.zip"
$canonNote = Join-Path $savesRoot "FGS_LATEST_CHECKPOINT.txt"
$deskZip   = Join-Path $deskFGS  "FGS_LATEST.zip"
$deskNote  = Join-Path $deskFGS  "FGS_LATEST_CHECKPOINT.txt"

function Get-GitClean {
  try {
    $s = (git status --porcelain) 2>$null
    return [string]::IsNullOrWhiteSpace($s)
  } catch { return $false }
}

# Desktop root offenders (never allow these on Desktop root)
$off = @(
  Get-ChildItem $desktop -File -Filter "FGS_LATEST*.zip" -ErrorAction SilentlyContinue
  Get-ChildItem $desktop -File -Filter "FGS_LATEST*CHECKPOINT*.txt" -ErrorAction SilentlyContinue
) | Where-Object { $_ }

$gitClean = if (Get-GitClean) { "CLEAN" } else { "DIRTY" }

$mirrorCount = 0
if (Test-Path $deskZip)  { $mirrorCount++ }
if (Test-Path $deskNote) { $mirrorCount++ }

$markerHeader = 0
$markerMirror = 0
# markers: we just verify they exist somewhere under scripts\logs or root, without being strict about location
if (Get-ChildItem -Path . -Recurse -File -Filter "*BACKUP_HEADER*" -ErrorAction SilentlyContinue) { $markerHeader = 1 }
if (Get-ChildItem -Path . -Recurse -File -Filter "*BACKUP_MIRROR*" -ErrorAction SilentlyContinue) { $markerMirror = 1 }

$zipOK = $false
if ((Test-Path $canonZip) -and (Test-Path $deskZip)) {
  $c = Get-Item $canonZip
  $d = Get-Item $deskZip
  $zipOK = (($c.Length -eq $d.Length) -and ($c.LastWriteTime -eq $d.LastWriteTime))
}

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[FGS HARD TRUTH FOOTER] $ts   Repo: $repo   Git:  $gitClean   Dirty: $(if($gitClean){" "}else{"YES"})   Desktop root offenders: $(@($off).Count)  (should be 0)   Desktop\FGS mirror files: $mirrorCount (should be 2)   Backup markers: header=$markerHeader mirror=$markerMirror (should be 1/1)   Mirror ZIP quick-check: $(if($zipOK){"OK (size+time)"}else{"DRIFT? (size+time)"})"
