param(
  [Parameter(Mandatory=$true)]
  [string]$Message,

  # Optional: restrict staging to a list of paths.
  # If omitted, stages ALL tracked changes + NEW files.
  [string[]]$Paths = @(),

  # If set, allow untracked files to be included when Paths is empty.
  [switch]$IncludeUntracked,

  # If set, auto-run the EPERM fix + retry build once (recommended).
  [switch]$AutoFixNext = $true
)

function Fail($msg) {
  Write-Host ""
  Write-Host "❌ $msg" -ForegroundColor Red
  exit 1
}

function Run($cmd) {
  Write-Host ""
  Write-Host ">> $cmd" -ForegroundColor Cyan
  iex $cmd
  if ($LASTEXITCODE -ne 0) {
    Fail "Command failed: $cmd"
  }
}

# --- Preflight ---
Run "git rev-parse --is-inside-work-tree | Out-Null"

Write-Host ""
Write-Host "=== FGS GATE + SHIP ===" -ForegroundColor White
Run "git status"

# If no changes at all, stop.
$porcelain = git status --porcelain
if (-not $porcelain) {
  Fail "No changes to commit."
}

# If user supplied Paths, ensure they exist.
if ($Paths.Count -gt 0) {
  foreach ($p in $Paths) {
    if (-not (Test-Path $p)) { Fail "Path not found: $p" }
  }
}

Write-Host ""
Write-Host "=== Diff summary ===" -ForegroundColor White
Run "git diff --stat"

# --- Quality gates ---
Write-Host ""
Write-Host "=== Lint ===" -ForegroundColor White
Run "npm run lint"

Write-Host ""
Write-Host "=== Build (with optional EPERM auto-fix) ===" -ForegroundColor White

$buildOk = $false
try {
  npm run build
  if ($LASTEXITCODE -eq 0) { $buildOk = $true }
} catch {
  $buildOk = $false
}

if (-not $buildOk -and $AutoFixNext) {
  Write-Host ""
  Write-Host "⚠️ Build failed. Trying EPERM recovery: kill node + wipe .next + retry build once..." -ForegroundColor Yellow

  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  if (Test-Path ".next") { Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue }
  if (Test-Path ".next") { cmd /c rmdir /s /q ".next" | Out-Null }

  Run "npm run build"
  $buildOk = $true
}

if (-not $buildOk) {
  Fail "Build failed. Fix the build, then rerun this script."
}

# --- Stage ---
Write-Host ""
Write-Host "=== Stage ===" -ForegroundColor White

if ($Paths.Count -gt 0) {
  $quoted = $Paths | ForEach-Object { '"' + $_ + '"' } | Join-String -Separator " "
  Run "git add $quoted"
} else {
  # Stage tracked changes
  Run "git add -A"

  # If untracked exist and not allowed, fail (safety)
  $untracked = git status --porcelain | Where-Object { $_ -match '^\?\?' }
  if ($untracked -and -not $IncludeUntracked) {
    Write-Host ""
    Write-Host "Untracked files detected:" -ForegroundColor Yellow
    $untracked | ForEach-Object { Write-Host $_ }
    Fail "Untracked files present. Re-run with -IncludeUntracked OR pass -Paths to stage only what you want."
  }
}

# If nothing staged, stop.
$staged = git diff --cached --name-only
if (-not $staged) {
  Fail "Nothing staged. (Did you mean to pass -Paths or -IncludeUntracked?)"
}

Write-Host ""
Write-Host "=== Commit ===" -ForegroundColor White
Run "git commit -m `"$Message`""

Write-Host ""
Write-Host "=== Push ===" -ForegroundColor White
Run "git push"

Write-Host ""
Write-Host "=== Final ===" -ForegroundColor White
Run "git status"
Run "git log -1 --oneline"

Write-Host ""
Write-Host "✅ Shipped." -ForegroundColor Green
