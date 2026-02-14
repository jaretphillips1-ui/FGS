param(
  [string]$Message = "",
  [string[]]$Paths = @(),
  [switch]$IncludeUntracked,
  [switch]$AutoFixNext = $true,
  [switch]$GateOnly,
  [switch]$VerdictOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Green([string]$msg) { Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Red([string]$msg)   { Write-Host "🛑 $msg" -ForegroundColor Red }
function Write-Yellow([string]$msg){ Write-Host "⚠️ $msg" -ForegroundColor Yellow }

function Invoke-Gate {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string]$Title,
    [Parameter(Mandatory)][scriptblock]$Command,
    [Parameter(Mandatory)][string]$Expected,
    [switch]$NoPause
  )

  if (-not $VerdictOnly) {
    Write-Host ""
    Write-Host "=== GATE: $Title ===" -ForegroundColor Cyan
    Write-Host "Expected: $Expected" -ForegroundColor DarkCyan
    Write-Host ""
  }

  try {
    & $Command
    $code = if ($LASTEXITCODE -ne $null) { $LASTEXITCODE } else { 0 }

    if ($code -ne 0) {
      Write-Red "$Title FAILED (exit $code). Paste the full output here."
      if (-not $NoPause) { Read-Host "Press Enter to continue" | Out-Null }
      return $false
    }

    if (-not $VerdictOnly) { Write-Green "$Title OK" }
    return $true
  }
  catch {
    Write-Red "$Title FAILED (exception). Paste the full output here."
    if (-not $VerdictOnly) { Write-Host $_ }
    if (-not $NoPause) { Read-Host "Press Enter to continue" | Out-Null }
    return $false
  }
}

function Get-Porcelain {
  $p = git status --porcelain 2>$null
  if ($null -eq $p) { return @() }

  if ($p -is [string]) {
    if ([string]::IsNullOrWhiteSpace($p)) { return @() }
    return ($p -split "`n" | ForEach-Object { $_.TrimEnd("`r") } | Where-Object { $_ })
  }

  return @($p)
}

function Print-WorktreeStatus([string]$when) {
  $p = Get-Porcelain
  if (@($p).Count -eq 0) {
    Write-Host "WORKTREE ($when): ✅ CLEAN — no modified/untracked files" -ForegroundColor Green
    return
  }
  Write-Host "WORKTREE ($when): ⚠️ NOT CLEAN — changes/untracked detected:" -ForegroundColor Yellow
  $p | ForEach-Object { Write-Host ("  " + $_) -ForegroundColor Yellow }
}

function Print-Gates([bool]$lintOk, [bool]$buildOk) {
  $lintLine  = if ($lintOk)  { "GATES: Lint ✅ PASS" } else { "GATES: Lint 🛑 FAIL" }
  $buildLine = if ($buildOk) { "       Build ✅ PASS" } else { "       Build 🛑 FAIL" }
  Write-Host $lintLine  -ForegroundColor ($lintOk  ? "Green" : "Red")
  Write-Host $buildLine -ForegroundColor ($buildOk ? "Green" : "Red")
}

function Print-Verdict([bool]$ready) {
  if ($ready) { Write-Host "VERDICT: ✅ READY — Safe to proceed." -ForegroundColor Green }
  else        { Write-Host "VERDICT: 🛑 NOT READY — Fix issues above and rerun." -ForegroundColor Red }
}

# ---- Start ----
& git rev-parse --is-inside-work-tree | Out-Null

if (-not $VerdictOnly) {
  Write-Host ""
  Write-Host "=== FGS GATE + SHIP (JP Engine Gate Contract) ===" -ForegroundColor White
}

Print-WorktreeStatus "start"

$porcelainStart = Get-Porcelain
if (@($porcelainStart).Count -eq 0) {
  if ($GateOnly) { Write-Green "READY — Nothing to commit. (Working tree is clean.)"; exit 0 }
  Write-Red "NOT READY — No changes detected. Nothing to ship."
  exit 1
}

if (-not $VerdictOnly) {
  & git status
  Write-Host ""
  Write-Host "=== Diff summary ===" -ForegroundColor White
  & git diff --stat
}

# ---- Gates ----
$lintOk  = Invoke-Gate -Title "Lint" -Expected "npm run lint returns exit code 0." -NoPause -Command { npm run lint }
if (-not $lintOk) { Print-Gates $false $false; Print-Verdict $false; exit 1 }

$buildOk = $false
if (-not $VerdictOnly) { Write-Host ""; Write-Host "=== Build (with optional EPERM recovery) ===" -ForegroundColor White }

$buildOk = Invoke-Gate -Title "Build" -Expected "npm run build returns exit code 0." -NoPause -Command { npm run build }

if (-not $buildOk -and $AutoFixNext) {
  if (-not $VerdictOnly) { Write-Yellow "Build failed. Trying EPERM recovery: kill node + wipe .next + retry build once..." }

  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath ".next") { Remove-Item -LiteralPath ".next" -Recurse -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath ".next") { cmd /c rmdir /s /q ".next" | Out-Null }

  $buildOk = Invoke-Gate -Title "Build (Retry after EPERM recovery)" -Expected "Second build passes after clearing .next and stopping node." -NoPause -Command { npm run build }
}

if (-not $buildOk) { Print-Gates $true $false; Print-Verdict $false; exit 1 }

Print-Gates $true $true

if ($GateOnly) { Print-Verdict $true; exit 0 }

# ---- Ship requirements ----
if (-not $Message.Trim()) {
  Print-Verdict $false
  Write-Red "NOT READY — Missing -Message. Provide a commit message and rerun."
  exit 1
}

if (@($Paths).Count -gt 0) {
  foreach ($p in $Paths) { if (-not (Test-Path -LiteralPath $p)) { Write-Red "NOT READY — Path not found: $p"; exit 1 } }
}

if (-not $VerdictOnly) { Write-Host ""; Write-Host "=== Stage ===" -ForegroundColor White }

if (@($Paths).Count -gt 0) {
  $quoted = $Paths | ForEach-Object { '"' + $_ + '"' } | Join-String -Separator " "
  $okStage = Invoke-Gate -Title "Stage (explicit paths)" -Expected "git add <paths> succeeds (exit code 0)." -NoPause -Command { iex "git add $quoted" }
  if (-not $okStage) { exit 1 }
}
else {
  $untracked = @(Get-Porcelain | Where-Object { $_ -match '^\?\?' })
  if (@($untracked).Count -gt 0 -and -not $IncludeUntracked) {
    if (-not $VerdictOnly) {
      Write-Host ""
      Write-Yellow "Untracked files detected (not allowed by default):"
      $untracked | ForEach-Object { Write-Host ("  " + $_) -ForegroundColor Yellow }
    }
    Print-Verdict $false
    Write-Red "NOT READY — Untracked files present. Re-run with -IncludeUntracked OR pass -Paths."
    exit 1
  }

  $stageCmd = if ($IncludeUntracked) { { git add -A } } else { { git add -u } }
  $stageExpected = if ($IncludeUntracked) { "git add -A stages tracked + untracked files." } else { "git add -u stages tracked changes only (no untracked)." }

  $okStage = Invoke-Gate -Title "Stage" -Expected $stageExpected -NoPause -Command $stageCmd
  if (-not $okStage) { exit 1 }
}

$staged = git diff --cached --name-only 2>$null
if (-not $staged) { Print-Verdict $false; Write-Red "NOT READY — Nothing staged."; exit 1 }

$okCommit = Invoke-Gate -Title "Commit" -Expected "git commit succeeds and creates a new commit." -NoPause -Command { git commit -m "$Message" }
if (-not $okCommit) { exit 1 }

$okPush = Invoke-Gate -Title "Push" -Expected "git push succeeds (no auth/remote errors)." -NoPause -Command { git push }
if (-not $okPush) { exit 1 }

if (-not $VerdictOnly) {
  Write-Host ""
  Write-Host "=== Final ===" -ForegroundColor White
  & git status
  & git log -1 --oneline
  Write-Host ""
}

Write-Green "SHIPPED."
