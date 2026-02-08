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

function Get-OneDriveRoot {
  $od = $env:OneDrive
  if ([string]::IsNullOrWhiteSpace($od)) {
    $od = Join-Path $env:USERPROFILE "OneDrive"
  }
  return $od
}

function Ensure-Dir([Parameter(Mandatory)][string]$Path) {
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
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

function Write-StatusFiles {
  param(
    [Parameter(Mandatory)][string]$StatusDir,
    [Parameter(Mandatory)][ValidateSet("PASS","FAIL")][string]$Result,
    [Parameter(Mandatory)][string]$Repo,
    [Parameter(Mandatory)][string]$Head,
    [Parameter(Mandatory)][string]$LogPath,
    [string]$Message = ""
  )

  Ensure-Dir $StatusDir

  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $lastRun  = Join-Path $StatusDir "FGS_LAST_RUN.txt"
  $lastFail = Join-Path $StatusDir "FGS_LAST_FAIL.txt"

  $body = @()
  $body += "FGS SAVE + VERIFY + SHUTDOWN"
  $body += "Timestamp : $ts"
  $body += "Result    : $Result"
  $body += "Repo      : $Repo"
  $body += "HEAD      : $Head"
  $body += "Log       : $LogPath"
  if (-not [string]::IsNullOrWhiteSpace($Message)) {
    $body += ""
    $body += "Message:"
    $body += $Message
  }

  Set-Content -LiteralPath $lastRun -Value ($body -join "`r`n") -Encoding UTF8

  if ($Result -eq "FAIL") {
    Set-Content -LiteralPath $lastFail -Value ($body -join "`r`n") -Encoding UTF8
  } else {
    if (Test-Path -LiteralPath $lastFail) { Remove-Item -Force -LiteralPath $lastFail }
  }
}

function Notify-User {
  param(
    [Parameter(Mandatory)][string]$Title,
    [Parameter(Mandatory)][string]$Text,
    [ValidateSet("INFO","WARN","ERROR")][string]$Level = "INFO"
  )

  # Preferred: BurntToast (toast notification)
  try {
    if (Get-Module -ListAvailable -Name BurntToast) {
      Import-Module BurntToast -ErrorAction Stop | Out-Null
      New-BurntToastNotification -Text $Title, $Text | Out-Null
      return
    }
  } catch {}

  # Fallback: MessageBox (always visible)
  try {
    Add-Type -AssemblyName PresentationFramework -ErrorAction Stop
    [System.Windows.MessageBox]::Show($Text, $Title) | Out-Null
    return
  } catch {}

  # Last resort: console only
  if ($Level -eq "ERROR") { Write-Bad $Text }
  elseif ($Level -eq "WARN") { Write-Warn $Text }
  else { Write-Ok $Text }
}

$repo = Get-FgsRepoRoot
Set-Location $repo

# Log file (single artifact you can paste back)
$logsDir = Join-Path $repo "scripts\logs"
Ensure-Dir $logsDir
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logPath = Join-Path $logsDir ("FGS_SAVE_SHUTDOWN_{0}.log" -f $stamp)

# Log retention (keep 30 most recent)
try {
  $keepLogs = 30
  $logs = Get-ChildItem -LiteralPath $logsDir -File -Filter "FGS_SAVE_SHUTDOWN_*.log" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending
  $toDelete = @($logs | Select-Object -Skip $keepLogs)
  foreach ($f in $toDelete) { Remove-Item -Force -LiteralPath $f.FullName }
  if (@($toDelete).Count -gt 0) { Write-Ok ("Log retention: pruned {0}; kept {1}." -f @(@($toDelete).Count, $keepLogs)) }
  else { Write-Ok ("Log retention: nothing to prune; kept {0}." -f $keepLogs) }
} catch {}

Write-Host ("Log: {0}" -f $logPath)
Start-Transcript -Path $logPath -Force | Out-Null

# Status dir (ONE place to check later)
$oneDriveRoot  = Get-OneDriveRoot
$desktopODRoot = Join-Path $oneDriveRoot "Desktop"
$deskODFGS     = Join-Path $desktopODRoot "FGS"

# IMPORTANT: write to script scope so it survives Invoke-Step scriptblocks
$script:headLine = ""

try {
  Write-Banner "FGS SAVE + VERIFY + SHUTDOWN"

  Invoke-Step -Name "Preflight" -Action {
    git status | Out-Host
    if (-not [string]::IsNullOrWhiteSpace((git status --porcelain))) {
      throw "Repo is DIRTY. Commit/stash before save+shutdown."
    }

    $script:headLine = (git log -1 --oneline)
    Write-Host ("HEAD: {0}" -f $script:headLine)
  }

  # Roots
  $desktopLocalRoot = Join-Path $env:USERPROFILE "Desktop"
  if (-not (Test-Path -LiteralPath $desktopODRoot)) {
    throw ("OneDrive Desktop root not found. Expected: {0}" -f $desktopODRoot)
  }

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
    Ensure-Dir $deskODFGS
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
      Ensure-Dir $archive

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

    Ensure-Dir $DestFolderFGS

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

    Ensure-Dir $deskODFGS
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

  # PASS breadcrumb + popup (fallback head if somehow empty)
  $headFinal = $script:headLine
  if ([string]::IsNullOrWhiteSpace($headFinal)) { $headFinal = (git log -1 --oneline) }

  Write-StatusFiles -StatusDir $deskODFGS -Result "PASS" -Repo $repo -Head $headFinal -LogPath $logPath
  Notify-User -Title "FGS Save + Shutdown" -Text "PASS — saved, mirrored, verified, and shutdown complete."

  Write-Banner "FGS SAVE + VERIFY + SHUTDOWN: PASS"
  Write-Host ("Log: {0}" -f $logPath)
  exit 0
}
catch {
  $msg = $_.Exception.Message
  try { if ($_.ScriptStackTrace) { $msg = $msg + "`r`n`r`nSTACK:`r`n" + $_.ScriptStackTrace } } catch {}

  $headNow = ""
  try { $headNow = (git log -1 --oneline) } catch {}

  Write-StatusFiles -StatusDir $deskODFGS -Result "FAIL" -Repo $repo -Head $headNow -LogPath $logPath -Message $msg
  Notify-User -Title "FGS Save + Shutdown" -Text "FAIL — open OneDrive\Desktop\FGS\FGS_LAST_FAIL.txt for details." -Level "ERROR"

  Write-Banner "FGS SAVE + VERIFY + SHUTDOWN: FAIL"
  Write-Bad $_.Exception.Message

  if ($_.ScriptStackTrace) {
    ""
    Write-Host "--- STACK ---"
    Write-Host $_.ScriptStackTrace
  }

  ""
  Write-Host ("Log: {0}" -f $logPath)

  Read-Host "Press Enter to close (FAIL)"
  exit 1
}
finally {
  try { Stop-Transcript | Out-Null } catch {}
}
