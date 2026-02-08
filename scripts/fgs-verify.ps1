[CmdletBinding()]
param(
  [switch]$Plain
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Ok([string]$msg) {
  if ($Plain) { Write-Output "OK  : $msg"; return }
  Write-Host "✅ $msg" -ForegroundColor Green
}
function Write-Warn([string]$msg) {
  if ($Plain) { Write-Output "WARN: $msg"; return }
  Write-Host "⚠️  $msg" -ForegroundColor Yellow
}
function Write-Bad([string]$msg) {
  if ($Plain) { Write-Output "BAD : $msg"; return }
  Write-Host "❌ $msg" -ForegroundColor Red
}

function Resolve-RepoRoot {
  $locked = "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
  if (Test-Path -LiteralPath $locked) { return $locked }

  if ($PSScriptRoot -and $PSScriptRoot.Trim().Length -gt 0) {
    $d = Split-Path -Parent $PSScriptRoot
    while ($true) {
      if (Test-Path -LiteralPath (Join-Path $d "package.json")) { return $d }
      $p = Split-Path -Parent $d
      if ($p -eq $d) { break }
      $d = $p
    }
  }

  throw "Unable to resolve repo root."
}

function Test-Sha256Manifest {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string]$RepoRoot,
    [Parameter(Mandatory)][string]$ManifestRelPath
  )

  $manifestPath = Join-Path $RepoRoot $ManifestRelPath
  if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Hash manifest missing: $manifestPath (run scripts\fgs-update-hashes.ps1)"
  }

  $json = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if (-not $json.files) { throw "Hash manifest invalid (missing .files): $manifestPath" }

  foreach ($f in $json.files) {
    $rel = [string]$f.path
    $expected = [string]$f.sha256

    if ([string]::IsNullOrWhiteSpace($rel) -or [string]::IsNullOrWhiteSpace($expected)) {
      throw "Hash manifest entry invalid (blank path/hash)."
    }

    $full = Join-Path $RepoRoot $rel
    if (-not (Test-Path -LiteralPath $full)) {
      throw "Hash manifest file missing on disk: $rel"
    }

    $actual = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash
    if ($actual -ne $expected) {
      throw "HASH DRIFT: $rel`nExpected: $expected`nActual  : $actual"
    }
  }

  return $true
}

$repo = Resolve-RepoRoot
Set-Location $repo

Write-Host "`n=== FGS VERIFY ===`nRepo: $repo`n"

. (Join-Path $repo "scripts\fgs-eventlog.ps1")
$heartbeatFallback = "C:\ProgramData\FGS\logs\heartbeat.log"

try {
  # A) SELF-CHECK (hash manifest)
  $manifestRel = "scripts\fgs-hash-manifest.json"
  Test-Sha256Manifest -RepoRoot $repo -ManifestRelPath $manifestRel | Out-Null
  Write-Ok "Hash self-verification: PASS ($manifestRel)"

  # 0) HARD POLICY: local Desktop mirror is NOT allowed
  $localMirror = Join-Path $env:USERPROFILE "Desktop\FGS"
  if (Test-Path -LiteralPath $localMirror) {
    Write-Bad "DRIFT: Local Desktop mirror exists (NOT allowed): $localMirror"
    throw "DRIFT: Local Desktop mirror exists (remove it; only OneDrive Desktop mirror is allowed)."
  } else {
    Write-Ok "No local Desktop mirror folder (good)."
  }

  # 1) Repo cleanliness
  $gs = (git status --porcelain)
  if ($gs) {
    Write-Warn "Working tree NOT clean. (This can be okay, but it’s a drift risk.)"
    $gs | ForEach-Object { Write-Host "  $_" }
  } else {
    Write-Ok "Working tree clean."
  }

  $head = (git log -1 --oneline)
  Write-Ok "HEAD: $head"

  # 2) Required scripts
  $required = @(
    ".\scripts\FGS-GO.ps1",
    ".\scripts\fgs-dev.ps1",
    ".\scripts\fgs-save-shutdown.ps1"
  )

  $missing = @()
  foreach ($p in $required) {
    if (Test-Path -LiteralPath $p) { Write-Ok "Found: $p" }
    else { $missing += $p; Write-Bad "Missing: $p" }
  }
  if ($missing.Count -gt 0) { throw "Required script(s) missing. Fix before continuing." }

  # 3) Runtime drift indicators
  $lock = Join-Path $repo ".next\dev\lock"
  if (Test-Path -LiteralPath $lock) { Write-Warn ".next dev lock exists: $lock" }
  else { Write-Ok "No .next dev lock." }

  $node = Get-Process node -ErrorAction SilentlyContinue
  if ($node) { Write-Warn "node process(es) running. (May be unrelated, but worth noting.)" }
  else { Write-Ok "No node processes running." }

  # 4) ZIP integrity: canonical == OneDrive Desktop mirror
  $zipCanonical = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST\FGS_LATEST.zip"
  $zipDesktop   = "C:\Users\lsphi\OneDrive\Desktop\FGS\FGS_LATEST.zip"

  if (-not (Test-Path -LiteralPath $zipCanonical)) { throw "Missing canonical ZIP: $zipCanonical" }
  if (-not (Test-Path -LiteralPath $zipDesktop))   { throw "Missing desktop ZIP:   $zipDesktop" }

  $h1 = (Get-FileHash -LiteralPath $zipCanonical -Algorithm SHA256).Hash
  $h2 = (Get-FileHash -LiteralPath $zipDesktop   -Algorithm SHA256).Hash

  $info1 = Get-Item -LiteralPath $zipCanonical
  $info2 = Get-Item -LiteralPath $zipDesktop

  Write-Host "`n--- ZIP STATUS ---"
  Write-Host ("Canonical: {0}  ({1} bytes)  {2}" -f $info1.FullName, $info1.Length, $info1.LastWriteTime)
  Write-Host ("Desktop  : {0}  ({1} bytes)  {2}" -f $info2.FullName, $info2.Length, $info2.LastWriteTime)

  if ($h1 -eq $h2) { Write-Ok "ZIP hashes match (canonical == desktop mirror)." }
  else {
    Write-Bad "ZIP hash mismatch! canonical != desktop mirror"
    Write-Host "  Canonical: $h1"
    Write-Host "  Desktop  : $h2"
    throw "Drift detected: ZIP mismatch."
  }

  # 5) Desktop shortcut wiring (GO + SAVE)
  $desktop = [Environment]::GetFolderPath('Desktop')

  $expected = @(
    @{
      Name="FGS GO.lnk"
      Target="C:\Program Files\PowerShell\7\pwsh.exe"
      MustContain="scripts\FGS-GO.ps1"
      RequireNoExit=$true
    },
    @{
      Name="FGS - SAVE + SHUTDOWN.lnk"
      Target="C:\Program Files\PowerShell\7\pwsh.exe"
      MustContain="FGS_SAVE_SHUTDOWN.ps1"
      RequireNoExit=$false
    }
  )

  $wsh = New-Object -ComObject WScript.Shell
  Write-Host "`n--- SHORTCUT STATUS ---"

  foreach ($e in $expected) {
    $lnk = Join-Path $desktop $e.Name
    if (-not (Test-Path -LiteralPath $lnk)) { throw "Missing shortcut on Desktop: $lnk" }

    $s = $wsh.CreateShortcut($lnk)
    $tp = $s.TargetPath
    $args = $s.Arguments
    $wd = $s.WorkingDirectory

    if ($tp -ne $e.Target) {
      Write-Bad "$($e.Name): TargetPath drifted: $tp"
      throw "Shortcut drift detected: $($e.Name)"
    }

    if ($args -notlike "*$($e.MustContain)*") {
      Write-Bad "$($e.Name): Arguments drifted."
      Write-Host "  Args: $args"
      throw "Shortcut drift detected: $($e.Name)"
    }

    if ($e.RequireNoExit) {
      if ($args -notmatch '(?i)(^|\s)-NoExit(\s|$)') {
        Write-Bad "$($e.Name): Missing -NoExit (required so logs don't vanish)."
        Write-Host "  Args: $args"
        throw "Shortcut drift detected: $($e.Name) missing -NoExit"
      }
    }

    Write-Ok "$($e.Name): OK"
    Write-Host "  Target: $tp"
    Write-Host "  Args  : $args"
    Write-Host "  WD    : $wd"
  }

  Write-Host "`n=== FGS VERIFY: PASS ===`n"

  [void](Write-FgsHeartbeat -Status OK -Message ("FGS Verify OK | " + $head) -Repo $repo -FallbackLogPath $heartbeatFallback)

  exit 0

} catch {
  $msg = $_.Exception.Message
  Write-Bad $msg
  Write-Host "`n=== FGS VERIFY: FAIL ===`n"

  try {
    [void](Write-FgsHeartbeat -Status FAIL -Message ("FGS Verify FAIL | " + $msg) -Repo $repo -FallbackLogPath $heartbeatFallback)
  } catch { }

  exit 1
}
