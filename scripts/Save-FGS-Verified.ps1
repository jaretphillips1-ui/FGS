param(
  [string]$Message = "CHECKPOINT"
)

$ErrorActionPreference = "Stop"

$repoRoot = "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
Set-Location $repoRoot

$saveScript = Join-Path $repoRoot "scripts\Save-FGS.ps1"
if (-not (Test-Path -LiteralPath $saveScript)) {
  throw "Missing Save script: $saveScript"
}

Write-Host "`n=== FGS SAVE ===" -ForegroundColor Cyan
pwsh -NoProfile -ExecutionPolicy Bypass -File $saveScript -Message $Message

Write-Host "`n=== FGS VERIFY ===" -ForegroundColor Cyan

# 1) Verify key repo files (LiteralPath because [id] is special)
$clientPath = Join-Path $repoRoot 'src\app\rods\[id]\RodDetailClient.tsx'
$pagePath   = Join-Path $repoRoot 'src\app\rods\[id]\page.tsx'

foreach ($p in @($clientPath, $pagePath)) {
  if (-not (Test-Path -LiteralPath $p)) { throw "MISSING FILE: $p" }
}

$clientInfo = Get-Item -LiteralPath $clientPath
$pageInfo   = Get-Item -LiteralPath $pagePath

Write-Host "✓ Repo files exist" -ForegroundColor Green
$clientInfo | Select-Object FullName, Length, LastWriteTime
$pageInfo   | Select-Object FullName, Length, LastWriteTime

# 2) Verify save artifacts exist + are fresh
$savesLatest = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST"
$zip = Join-Path $savesLatest "FGS_LATEST.zip"
$chk = Join-Path $savesLatest "FGS_MASTER_CHECKPOINT.txt"

foreach ($p in @($zip, $chk)) {
  if (-not (Test-Path -LiteralPath $p)) { throw "MISSING SAVE ARTIFACT: $p" }
}

$zipInfo = Get-Item -LiteralPath $zip
$chkInfo = Get-Item -LiteralPath $chk

# Freshness window (minutes)
$windowMinutes = 10
$cutoff = (Get-Date).AddMinutes(-$windowMinutes)

if ($zipInfo.LastWriteTime -lt $cutoff) { throw "SAVE ZIP is not fresh (older than $windowMinutes min): $($zipInfo.LastWriteTime)" }
if ($chkInfo.LastWriteTime -lt $cutoff) { throw "CHECKPOINT is not fresh (older than $windowMinutes min): $($chkInfo.LastWriteTime)" }

Write-Host "`n✓ Save artifacts exist + are fresh (<= $windowMinutes minutes)" -ForegroundColor Green
$zipInfo | Select-Object FullName, Length, LastWriteTime
$chkInfo | Select-Object FullName, Length, LastWriteTime

# 3) Git status snapshot (helpful confirmation)
Write-Host "`n--- GIT STATUS ---" -ForegroundColor Cyan
if (Test-Path -LiteralPath (Join-Path $repoRoot ".git")) {
  git status -sb
} else {
  Write-Host "(Info) Not a git repo here." -ForegroundColor Yellow
}

Write-Host "`n✅ CONFIRMED: Saved + verified. You're good to stop safely." -ForegroundColor Green