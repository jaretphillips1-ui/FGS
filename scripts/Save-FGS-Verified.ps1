param(
  [Parameter(Position=0)]
  [string]$Message = "CHECKPOINT",
  [int]$windowMinutes = 10
)

$ErrorActionPreference = "Stop"

$repoRoot = "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
$saveScript = Join-Path $repoRoot "scripts\Save-FGS.ps1"
if (-not (Test-Path -LiteralPath $saveScript)) {
  throw "Missing Save script: $saveScript"
}

Write-Host "`n=== FGS SAVE ===" -ForegroundColor Cyan
pwsh -NoProfile -ExecutionPolicy Bypass -File $saveScript -Message $Message

Write-Host "`n=== FGS VERIFY ===" -ForegroundColor Cyan
$latestDir = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST"
$zip = Join-Path $latestDir "FGS_LATEST.zip"
$chk = Join-Path $latestDir "FGS_MASTER_CHECKPOINT.txt"

foreach ($p in @($zip,$chk)) {
  if (-not (Test-Path -LiteralPath $p)) { throw "MISSING SAVE ARTIFACT: $p" }
}

$cutoff = (Get-Date).AddMinutes(-1 * [Math]::Abs($windowMinutes))
$zipInfo = Get-Item -LiteralPath $zip
$chkInfo = Get-Item -LiteralPath $chk

if ($zipInfo.LastWriteTime -lt $cutoff) { throw "SAVE ZIP is not fresh (older than $windowMinutes min): $($zipInfo.LastWriteTime)" }
if ($chkInfo.LastWriteTime -lt $cutoff) { throw "CHECKPOINT is not fresh (older than $windowMinutes min): $($chkInfo.LastWriteTime)" }

Write-Host "`n✓ Save artifacts exist + are fresh (<= $windowMinutes minutes)" -ForegroundColor Green
$zipInfo | Select-Object FullName, Length, LastWriteTime
$chkInfo | Select-Object FullName, Length, LastWriteTime
