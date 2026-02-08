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

function Write-Banner($title) {
  $line = ("=" * 72)
  ""
  Write-Host $line
  Write-Host ("=== " + $title + " ===")
  Write-Host $line
}

function Invoke-Step {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][scriptblock]$Action
  )

  Write-Banner $Name
  & $Action
  Write-Ok ("{0}: OK" -f $Name)
}

$repo = Get-FgsRepoRoot
Set-Location $repo

# Log file (single artifact you can paste back)
$logsDir = Join-Path $repo "scripts\logs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logPath = Join-Path $logsDir ("FGS_SAVE_SHUTDOWN_{0}.log" -f $stamp)

Write-Host ("Log: {0}" -f $logPath)

Start-Transcript -Path $logPath -Force | Out-Null

try {
  Write-Banner "FGS SAVE + VERIFY + SHUTDOWN"

  Invoke-Step -Name "Preflight" -Action {
    git status | Out-Host
    if (-not [string]::IsNullOrWhiteSpace((git status --porcelain))) {
      throw "Repo is DIRTY. Commit/stash before save+shutdown."
    }

    $head = (git log -1 --oneline)
    Write-Host ("HEAD: {0}" -f $head)
  }

  # Roots
  $desktopLocalRoot = Join-Path $env:USERPROFILE "Desktop"

  $oneDriveRoot = $env:OneDrive
  if ([string]::IsNullOrWhiteSpace($oneDriveRoot)) {
    $oneDriveRoot = Join-Path $env:USERPROFILE "OneDrive"
  }
  $desktopODRoot = Join-Path $oneDriveRoot "Desktop"

  if (-not (Test-Path -LiteralPath $desktopODRoot)) {
    throw ("OneDrive Desktop root not found. Expected: {0}" -f $desktopODRoot)
  }

  # POLICY: ONLY ONE desktop mirror is allowed (OneDrive Desktop\FGS)
  $deskODFGS = Join-Path $desktopODRoot "FGS"

  # Canonical save root (ONE TRUE SAVE)
  $savesRoot = Join-Path $oneDriveRoot "AI_Workspace\_SAVES\FGS\LATEST"
  $canonZip  = Join-Path $savesRoot "FGS_LATEST.zip"
  $canonNote = Join-Path $savesRoot "FGS_LATEST_CHECKPOINT.txt"

  # Drift archive root
  $archiveRoot = Join-Path $oneDriveRoot "AI_Workspace\_SAVES\FGS\DESKTOP_ARCHIVE"

  Invoke-Step -Name "Preview targets" -Action {
    "`n--- PREVIEW TARGETS ---"
    ("Repo         : {0}" -f $repo)
    ("SAVES        : {0}" -f $savesRoot)
    ("DesktopODFGS : {0}" -f $deskODFGS)
    ("DesktopLocal : {0} (NO MIRROR ALLOWED)" -f $desktopLocalRoot)

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
  }

  Invoke-Step -Name "Enforce no local Desktop mirror folder" -Action {
    $deskLocalFGS = Join-Path $desktopLocalRoot "FGS"
    if (Test-Path -LiteralPath $deskLocalFGS) {
      $stamp2 = Get-Date -Format "yyyyMMdd_HHmmss"
      $archive = Join-Path $archiveRoot ("LocalDesktop_FGS_{0}" -f $stamp2)
      New-Item -ItemType Directory -Force -Path $archive | Out-Null

      Get-ChildItem -LiteralPath $deskLocalFGS -Force -ErrorAction SilentlyContinue |
        ForEach-Object {
          Copy-Item -Force -LiteralPath $_.FullName -Destination (Join-Path $archive $_.Name)
        }

      Remove-Item -Recurse -Force -LiteralPath $deskLocalFGS
      Write-Warn ("Local Desktop mirror detected and removed (archived to): {0}" -f $archive)
    } else {
      Write-Ok "No local Desktop mirror folder exists (good)."
    }
  }

  Invoke-Step -Name "Run backup" -Action {
    $backup = Join-Path $repo "scripts\fgs-backup.ps1"
    if (Test-Path -LiteralPath $backup) {
      & $backup
    } else {
      throw "Missing: scripts\fgs-backup.ps1"
    }
  }

  function Sweep-RootOffendersToOD {
    param(
      [Parameter(Mandatory)][string]$Root,
      [Parameter(Mandatory)][string]$DestFolderFGS,
      [Parameter(Mandatory)][string]$Name
    )

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
      Write-Warn ("Swept {0} offender(s) off {1} Desktop ROOT -> OneDrive Desktop\FGS" -f @(@($off).Count, $Name))
    } else {
      Write-Ok ("Desktop root offenders ({0}): 0" -f $Name)
    }
  }

  Invoke-Step -Name "Sweep Desktop root offenders -> OneDrive Desktop\FGS" -Action {
    Sweep-RootOffendersToOD -Root $desktopLocalRoot -DestFolderFGS $deskODFGS -Name "local" | Out-Host
    Sweep-RootOffendersToOD -Root $desktopODRoot    -DestFolderFGS $deskODFGS -Name "od"    | Out-Host
  }

  Invoke-Step -Name "Mirror canonical -> OneDrive Desktop\FGS" -Action {
    if (-not (Test-Path -LiteralPath $canonZip))  { throw ("Missing canonical zip: {0}" -f $canonZip) }
    if (-not (Test-Path -LiteralPath $canonNote)) { throw ("Missing canonical note: {0}" -f $canonNote) }

    New-Item -ItemType Directory -Force -Path $deskODFGS | Out-Null
    Copy-Item -Force -LiteralPath $canonZip  -Destination (Join-Path $deskODFGS "FGS_LATEST.zip")
    Copy-Item -Force -LiteralPath $canonNote -Destination (Join-Path $deskODFGS "FGS_LATEST_CHECKPOINT.txt")
    Write-Ok "Re-mirrored OneDrive Desktop\FGS from canonical _SAVES"
  }

  function Verify-FileMatch {
    param(
      [Parameter(Mandatory)][string]$Canon,
      [Parameter(Mandatory)][string]$Mirror,
      [Parameter(Mandatory)][string]$Name
    )

    if (-not (Test-Path -LiteralPath $Mirror)) { throw ("Mirror missing ({0}): {1}" -f $Name, $Mirror) }

    $c = Get-Item -LiteralPath $Canon
    $m = Get-Item -LiteralPath $Mirror
    $ch = (Get-FileHash -LiteralPath $Canon  -Algorithm SHA256).Hash
    $mh = (Get-FileHash -LiteralPath $Mirror -Algorithm SHA256).Hash

    Write-Host ("Canon ({0}): {1} bytes @ {2}" -f $Name, $c.Length, $c.LastWriteTime)
    Write-Host ("Mirr ({0}): {1} bytes @ {2}" -f $Name, $m.Length, $m.LastWriteTime)
    if ($ch -eq $mh) { Write-Ok ("Mirror ({0}): HASH OK" -f $Name) } else { throw ("Mirror ({0}): HASH MISMATCH" -f $Name) }
  }

  Invoke-Step -Name "Verify mirrored ZIP + NOTE hash match" -Action {
    Verify-FileMatch -Canon $canonZip  -Mirror (Join-Path $deskODFGS "FGS_LATEST.zip")            -Name "ZIP"  | Out-Host
    Verify-FileMatch -Canon $canonNote -Mirror (Join-Path $deskODFGS "FGS_LATEST_CHECKPOINT.txt") -Name "NOTE" | Out-Host
  }

  Invoke-Step -Name "Run fgs-verify.ps1" -Action {
    & (Join-Path $repo "scripts\fgs-verify.ps1") | Out-Host
  }

  Invoke-Step -Name "Run fgs-verify-mirror.ps1" -Action {
    & (Join-Path $repo "scripts\fgs-verify-mirror.ps1") | Out-Host
  }

  Invoke-Step -Name "Stop dev server (node)" -Action {
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Ok "node stopped (if it was running)"
  }

  Invoke-Step -Name "Clear Next.js dev lock (if present)" -Action {
    $lock = Join-Path $repo ".next\dev\lock"
    if (Test-Path -LiteralPath $lock) {
      Remove-Item -Force -LiteralPath $lock
      Write-Ok "Cleared .next\dev\lock"
    } else {
      Write-Ok "No .next\dev\lock (good)"
    }
  }

  Invoke-Step -Name "Final hard truth" -Action {
    & (Join-Path $repo "scripts\fgs-hard-truth.ps1") | Out-Host
  }

  Write-Banner "FGS SAVE + VERIFY + SHUTDOWN: PASS"
  Write-Host ("Log: {0}" -f $logPath)
  exit 0
}
catch {
  Write-Banner "FGS SAVE + VERIFY + SHUTDOWN: FAIL"
  Write-Bad $_.Exception.Message

  if ($_.ScriptStackTrace) {
    ""
    Write-Host "--- STACK ---"
    Write-Host $_.ScriptStackTrace
  }

  ""
  Write-Host ("Log: {0}" -f $logPath)
  exit 1
}
finally {
  try { Stop-Transcript | Out-Null } catch { }
}
