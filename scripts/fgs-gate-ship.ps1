param(
  # Commit message is only required when actually shipping.
  [string]$Message = "",

  # Optional: restrict staging to a list of paths.
  # If omitted, stages ALL tracked changes + NEW files.
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

function Fail($msg) {
  if (-not $VerdictOnly) { Write-Host "" }
  Write-Host "🛑 NOT READY — $msg" -ForegroundColor Red
  exit 1
}

function Ok($msg) {
  if (-not $VerdictOnly) { Write-Host "" }
  Write-Host "✅ READY — $msg" -ForegroundColor Green
}

function Run($cmd) {
  if (-not $VerdictOnly) {
    Write-Host ""
    Write-Host ">> $cmd" -ForegroundColor Cyan
  }
  iex $cmd
  if ($LASTEXITCODE -ne 0) {
    Fail "Command failed: $cmd"
  }
}

# --- Preflight ---
Run "git rev-parse --is-inside-work-tree | Out-Null"

if (-not $VerdictOnly) {
  Write-Host ""
  Write-Host "=== FGS GATE + SHIP ===" -ForegroundColor White
}

# If no changes at all, stop.
$porcelain = git status --porcelain
if (-not $porcelain) {
  Fail "No changes detected."
}

if (-not $VerdictOnly) {
  Run "git status"
  Write-Host ""
  Write-Host "=== Diff summary ===" -ForegroundColor White
  Run "git diff --stat"
}

# --- Quality gates ---
if (-not $VerdictOnly) {
  Write-Host ""
  Write-Host "=== Lint ===" -ForegroundColor White
}
Run "npm run lint"

if (-not $VerdictOnly) {
  Write-Host ""
  Write-Host "=== Build (with optional EPERM auto-fix) ===" -ForegroundColor White
}

$buildOk = $false
try {
  npm run build
  if ($LASTEXITCODE -eq 0) { $buildOk = $true }
} catch {
  $buildOk = $false
}

if (-not $buildOk -and $AutoFixNext) {
  if (-not $VerdictOnly) {
    Write-Host ""
    Write-Host "⚠️ Build failed. Trying EPERM recovery: kill node + wipe .next + retry build once..." -ForegroundColor Yellow
  }

  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  if (Test-Path ".next") { Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue }
  if (Test-Path ".next") { cmd /c rmdir /s /q ".next" | Out-Null }

  Run "npm run build"
  $buildOk = $true
}

if (-not $buildOk) {
  Fail "Build failed. Fix the build, then rerun."
}

# If we're only gating, stop here with an explicit verdict.
if ($GateOnly) {
  Ok "Lint + build passed. Safe to commit."
  exit 0
}

# --- Shipping requires a commit message ---
if (-not $Message.Trim()) {
  Fail "Missing -Message. Example: .\scripts\fgs-gate-ship.ps1 -Message `"Shopping: show Restock from inventory`""
}

# If user supplied Paths, ensure they exist.
if ($Paths.Count -gt 0) {
  foreach ($p in $Paths) {
    if (-not (Test-Path $p)) { Fail "Path not found: $p" }
  }
}

# --- Stage ---
if (-not $VerdictOnly) {
  Write-Host ""
  Write-Host "=== Stage ===" -ForegroundColor White
}

if ($Paths.Count -gt 0) {
  $quoted = $Paths | ForEach-Object { '"' + $_ + '"' } | Join-String -Separator " "
  Run "git add $quoted"
} else {
  # Stage tracked changes
  Run "git add -A"

  # If untracked exist and not allowed, fail (safety)
  $untracked = git status --porcelain | Where-Object { $_ -match '^\?\?' }
  if ($untracked -and -not $IncludeUntracked) {
    if (-not $VerdictOnly) {
      Write-Host ""
      Write-Host "Untracked files detected:" -ForegroundColor Yellow
      $untracked | ForEach-Object { Write-Host $_ }
    }
    Fail "Untracked files present. Re-run with -IncludeUntracked OR pass -Paths."
  }
}

# If nothing staged, stop.
$staged = git diff --cached --name-only
if (-not $staged) {
  Fail "Nothing staged. (Did you mean to pass -Paths or -IncludeUntracked?)"
}

if (-not $VerdictOnly) {
  Write-Host ""
  Write-Host "=== Commit ===" -ForegroundColor White
}
Run "git commit -m `"$Message`""

if (-not $VerdictOnly) {
  Write-Host ""
  Write-Host "=== Push ===" -ForegroundColor White
}
Run "git push"

if (-not $VerdictOnly) {
  Write-Host ""
  Write-Host "=== Final ===" -ForegroundColor White
  Run "git status"
  Run "git log -1 --oneline"
}

Write-Host ""
Write-Host "✅ SHIPPED." -ForegroundColor Green
