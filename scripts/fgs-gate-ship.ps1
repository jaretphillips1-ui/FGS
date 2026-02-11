param(
  [string]$Message = "",
  [string[]]$Paths = @(),
  [switch]$IncludeUntracked,
  [switch]$AutoFixNext = $true,
  [switch]$GateOnly,
  [switch]$VerdictOnly
)

function Line($msg, $color = "Gray") { Write-Host $msg -ForegroundColor $color }

function Fail($msg) {
  if (-not $VerdictOnly) { Line "" }
  Line "🛑 NOT READY — $msg" "Red"
  exit 1
}

function Ok($msg) {
  if (-not $VerdictOnly) { Line "" }
  Line "✅ READY — $msg" "Green"
}

function Run($cmd) {
  if (-not $VerdictOnly) { Line ""; Line ">> $cmd" "Cyan" }
  iex $cmd
  if ($LASTEXITCODE -ne 0) { Fail "Command failed: $cmd" }
}

function GetPorcelain() {
  $p = git status --porcelain 2>$null
  if ($null -eq $p) { return @() }

  if ($p -is [string]) {
    if ([string]::IsNullOrWhiteSpace($p)) { return @() }
    return ($p -split "`n" | ForEach-Object { $_.TrimEnd("`r") } | Where-Object { $_ })
  }

  return @($p)
}

function PrintWorktreeStatus([string]$when) {
  $p = GetPorcelain
  if (@($p).Count -eq 0) {
    Line "WORKTREE ($when): ✅ CLEAN — no modified/untracked files" "Green"
    return
  }
  Line "WORKTREE ($when): ⚠️ NOT CLEAN — changes/untracked detected:" "Yellow"
  $p | ForEach-Object { Line ("  " + $_) "Yellow" }
}

function PrintGates([bool]$lintOk, [bool]$buildOk) {
  $lintLine  = if ($lintOk)  { "GATES: Lint ✅ PASS" } else { "GATES: Lint 🛑 FAIL" }
  $buildLine = if ($buildOk) { "       Build ✅ PASS" } else { "       Build 🛑 FAIL" }
  Line $lintLine  ($lintOk  ? "Green" : "Red")
  Line $buildLine ($buildOk ? "Green" : "Red")
}

function PrintVerdict([bool]$ready) {
  if ($ready) { Line "VERDICT: ✅ READY — Safe to proceed." "Green" }
  else        { Line "VERDICT: 🛑 NOT READY — Fix issues above and rerun." "Red" }
}

Run "git rev-parse --is-inside-work-tree | Out-Null"

if (-not $VerdictOnly) { Line ""; Line "=== FGS GATE + SHIP ===" "White" }

PrintWorktreeStatus "start"

$porcelainStart = GetPorcelain
if (@($porcelainStart).Count -eq 0) {
  if ($GateOnly) { Ok "Nothing to commit. (Working tree is clean.)"; exit 0 }
  Fail "No changes detected. Nothing to ship."
}

if (-not $VerdictOnly) {
  Run "git status"
  Line ""; Line "=== Diff summary ===" "White"
  Run "git diff --stat"
}

$lintOk = $false
$buildOk = $false

if (-not $VerdictOnly) { Line ""; Line "=== Lint ===" "White" }
try { npm run lint; if ($LASTEXITCODE -eq 0) { $lintOk = $true } } catch { $lintOk = $false }

if (-not $lintOk) { PrintGates $lintOk $false; PrintVerdict $false; exit 1 }

if (-not $VerdictOnly) { Line ""; Line "=== Build (with optional EPERM auto-fix) ===" "White" }
try { npm run build; if ($LASTEXITCODE -eq 0) { $buildOk = $true } } catch { $buildOk = $false }

if (-not $buildOk -and $AutoFixNext) {
  if (-not $VerdictOnly) { Line ""; Line "⚠️ Build failed. Trying EPERM recovery: kill node + wipe .next + retry build once..." "Yellow" }
  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  if (Test-Path ".next") { Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue }
  if (Test-Path ".next") { cmd /c rmdir /s /q ".next" | Out-Null }
  try { npm run build; if ($LASTEXITCODE -eq 0) { $buildOk = $true } } catch { $buildOk = $false }
}

if (-not $buildOk) { PrintGates $lintOk $buildOk; PrintVerdict $false; exit 1 }

if (-not $VerdictOnly) { Line "" }
PrintGates $lintOk $buildOk

if ($GateOnly) { PrintVerdict $true; exit 0 }

if (-not $Message.Trim()) { PrintVerdict $false; Fail "Missing -Message." }

if (@($Paths).Count -gt 0) {
  foreach ($p in $Paths) { if (-not (Test-Path $p)) { Fail "Path not found: $p" } }
}

if (-not $VerdictOnly) { Line ""; Line "=== Stage ===" "White" }

if (@($Paths).Count -gt 0) {
  $quoted = $Paths | ForEach-Object { '"' + $_ + '"' } | Join-String -Separator " "
  Run "git add $quoted"
} else {
  $untracked = @(GetPorcelain | Where-Object { $_ -match '^\?\?' })
  if (@($untracked).Count -gt 0 -and -not $IncludeUntracked) {
    if (-not $VerdictOnly) { Line ""; Line "Untracked files detected (not allowed by default):" "Yellow"; $untracked | ForEach-Object { Line ("  " + $_) "Yellow" } }
    PrintVerdict $false
    Fail "Untracked files present. Re-run with -IncludeUntracked OR pass -Paths."
  }
  if ($IncludeUntracked) { Run "git add -A" } else { Run "git add -u" }
}

$staged = git diff --cached --name-only 2>$null
if (-not $staged) { PrintVerdict $false; Fail "Nothing staged." }

if (-not $VerdictOnly) { Line ""; Line "=== Commit ===" "White" }
Run "git commit -m `"$Message`""

if (-not $VerdictOnly) { Line ""; Line "=== Push ===" "White" }
Run "git push"

if (-not $VerdictOnly) {
  Line ""; Line "=== Final ===" "White"
  Run "git status"
  Run "git log -1 --oneline"
  Line ""
}

Line "✅ SHIPPED." "Green"
