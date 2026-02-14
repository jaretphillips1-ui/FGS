param(
  [switch]$RestartExplorer,
  [int]$Retries = 6,
  [int]$DelayMs = 800
)

$ErrorActionPreference = "Stop"

function Stop-NodeSilently {
  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Restart-ExplorerIfRequested {
  param([switch]$DoIt)
  if (-not $DoIt) { return }
  try {
    Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 700
    Start-Process explorer.exe | Out-Null
  } catch {
    Write-Host "YELLOW: Explorer restart failed or was blocked; continuing..." -ForegroundColor Yellow
  }
}

function Remove-NextWithRetries {
  param(
    [string]$NextPath,
    [int]$Retries,
    [int]$DelayMs
  )

  if (-not (Test-Path -LiteralPath $NextPath)) {
    Write-Host "GREEN: No .next folder found (ok)." -ForegroundColor Green
    return
  }

  for ($i = 1; $i -le $Retries; $i++) {
    try {
      $chunks = Join-Path $NextPath "build\chunks"
      if (Test-Path -LiteralPath $chunks) {
        Remove-Item -LiteralPath $chunks -Recurse -Force -ErrorAction Stop
      }

      Remove-Item -LiteralPath $NextPath -Recurse -Force -ErrorAction Stop
      Write-Host "GREEN: Deleted .next successfully." -ForegroundColor Green
      return
    } catch {
      Write-Host "YELLOW: Attempt $i failed to delete .next (lock). Retrying..." -ForegroundColor Yellow
      Start-Sleep -Milliseconds $DelayMs
      if ($i -eq $Retries) { throw }
    }
  }
}

Write-Host "=== FGS CLEAN .next ===" -ForegroundColor Cyan
Write-Host "Repo:" (Get-Location).Path

Stop-NodeSilently
Restart-ExplorerIfRequested -DoIt:$RestartExplorer

$nextPath = Join-Path (Get-Location).Path ".next"
Remove-NextWithRetries -NextPath $nextPath -Retries $Retries -DelayMs $DelayMs

# Also clear stale dev lock if it exists
$devLock = Join-Path (Get-Location).Path ".next\dev\lock"
if (Test-Path -LiteralPath $devLock) {
  Remove-Item -LiteralPath $devLock -Force -ErrorAction SilentlyContinue
  Write-Host "YELLOW: Removed stale Next.js dev lock." -ForegroundColor Yellow
}

Write-Host "=== FGS CLEAN: DONE ===" -ForegroundColor Green
