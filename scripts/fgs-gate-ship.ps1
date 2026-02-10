param(
  # Commit message is only required when actually shipping.
  [string]$Message = "",

  # Optional: restrict staging to a list of paths.
  # If omitted, stages tracked changes; untracked only if -IncludeUntracked is set.
  [string[]]$Paths = @(),

  # If set, allow untracked files to be included when Paths is empty.
  [switch]$IncludeUntracked,

  # If set, auto-run the EPERM fix + retry build once (recommended).
  [switch]$AutoFixNext = $true,

  # If set, only run gates (lint/build) and print a verdict. No staging/commit/push.
  [switch]$GateOnly,

  # If set, keep output minimal and focus on verdict lines.
  [switch]$VerdictOnly
)

# ----------------------------
# Helpers
# ----------------------------
function Line($msg, $color = "Gray") {
  Write-Host $msg -ForegroundColor $color
}

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
  if (-not $VerdictOnly) {
    Line ""
    Line ">> $cmd" "Cyan"
  }
  iex $cmd
  if ($LASTEXITCODE -ne 0) {
    Fail "Command failed: $cmd"
  }
}

function GetPorcelain() {
  # Returns an array of lines (or empty array)
  $p = git status --porcelain
  if ($null -eq $p) { return @() }
  if ($p -is [string]) {
    if ([string]::IsNullOrWhiteSpace($p)) { return @() }
    return $p -split "`n" | ForEach-Object { $_.TrimEnd("`r") } | Where-Object { $_ }
  }
  return @($p)
}

function PrintWorktreeStatus([string]$when) {
  $p = GetPorcelain
  if ($p.Count -eq 0) {
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
  if ($ready) {
    Line "VERDICT: ✅ READY — Safe to proceed." "Green"
  } else {
    Line "VERDICT: 🛑 NOT READY — Fix issues above and rerun." "Red"
  }
}

# ----------------------------
# Preflight
# ----------------------------
Run "git rev-parse --is-inside-work-tree | Out-Null"

if (-not $VerdictOnly) {
  Line ""
  Line "=== FGS GATE + SHIP ===" "White"
}

# Show status up-front (always)
PrintWorktreeStatus "start"

# If no changes at all:
# - GateOnly: this is a SUCCESS (clean and nothing to do)
# - Ship mode: fail (nothing to commit)
$porcelainStart = GetPorcelain
if ($porcelainStart.Count -eq 0) {
  if ($GateOnly) {
    if (-not $VerdictOnly) { Line "" }
    Ok "Nothing to commit. (Working tree is clean.)"
    exit 0
  } else {
    Fail "No changes detected. Nothing to ship."
  }
}

if (-not $VerdictOnly) {
  Run "git status"
  Line ""
  Line "=== Diff summary ===" "White"
  Run "git diff --stat"
}

# ----------------------------
# Quality gates
# ----------------------------
$lintOk = $false
$buildOk = $false

if (-not $VerdictOnly) { Line ""; Line "=== Lint ===" "White" }
try {
  npm run lint
  if ($LASTEXITCODE -eq 0) { $lintOk = $true }
} catch {
  $lintOk = $false
}

if (-not $lintOk) {
  if (-not $VerdictOnly) { Line "" }
  PrintGates $lintOk $false
  PrintVerdict $false
  exit 1
}

if (-not $VerdictOnly) { Line ""; Line "=== Build (with optional EPERM auto-fix) ===" "White" }
try {
  npm run build
  if ($LASTEXITCODE -eq 0) { $buildOk = $true }
} catch {
  $buildOk = $false
}

if (-not $buildOk -and $AutoFixNext) {
  if (-not $VerdictOnly) {
    Line ""
    Line "⚠️ Build failed. Trying EPERM recovery: kill node + wipe .next + retry build once..." "Yellow"
  }

  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  if (Test-Path ".next") { Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue }
  if (Test-Path ".next") { cmd /c rmdir /s /q ".next" | Out-Null }

  try {
    npm run build
    if ($LASTEXITCODE -eq 0) { $buildOk = $true }
  } catch {
    $buildOk = $false
  }
}

if (-not $buildOk) {
  if (-not $VerdictOnly) { Line "" }
  PrintGates $lintOk $buildOk
  PrintVerdict $false
  exit 1
}

# Gates passed — print bottom-line summary (always)
if (-not $VerdictOnly) { Line "" }
PrintGates $lintOk $buildOk

# If we're only gating, stop here with an explicit verdict.
if ($GateOnly) {
  PrintVerdict $true
  exit 0
}

# ----------------------------
# Shipping requires a commit message
# ----------------------------
if (-not $Message.Trim()) {
  PrintVerdict $false
  Fail "Missing -Message. Example: .\scripts\fgs-gate-ship.ps1 -Message `"Shopping: show Restock from inventory`""
}

# If user supplied Paths, ensure they exist.
if ($Paths.Count -gt 0) {
  foreach ($p in $Paths) {
    if (-not (Test-Path $p)) { Fail "Path not found: $p" }
  }
}

# ----------------------------
# Stage
# ----------------------------
if (-not $VerdictOnly) { Line ""; Line "=== Stage ===" "White" }

if ($Paths.Count -gt 0) {
  $quoted = $Paths | ForEach-Object { '"' + $_ + '"' } | Join-String -Separator " "
  Run "git add $quoted"
} else {
  # If untracked exist and not allowed, fail BEFORE staging them.
  $untracked = GetPorcelain | Where-Object { $_ -match '^\?\?' }
  if ($untracked.Count -gt 0 -and -not $IncludeUntracked) {
    if (-not $VerdictOnly) {
      Line ""
      Line "Untracked files detected (not allowed by default):" "Yellow"
      $untracked | ForEach-Object { Line ("  " + $_) "Yellow" }
    }
    PrintVerdict $false
    Fail "Untracked files present. Re-run with -IncludeUntracked OR pass -Paths."
  }

  if ($IncludeUntracked) {
    # Stage tracked + untracked
    Run "git add -A"
  } else {
    # Stage tracked changes only (safe default)
    Run "git add -u"
  }
}

# If nothing staged, stop.
$staged = git diff --cached --name-only
if (-not $staged) {
  PrintVerdict $false
  Fail "Nothing staged. (Did you mean to pass -Paths or -IncludeUntracked?)"
}

if (-not $VerdictOnly) { Line ""; Line "=== Commit ===" "White" }
Run "git commit -m `"$Message`""

if (-not $VerdictOnly) { Line ""; Line "=== Push ===" "White" }
Run "git push"

if (-not $VerdictOnly) {
  Line ""
  Line "=== Final ===" "White"
  Run "git status"
  Run "git log -1 --oneline"
  Line ""
}

Line "✅ SHIPPED." "Green"
