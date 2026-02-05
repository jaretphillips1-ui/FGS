#@FGS_UP_HEADER
[CmdletBinding()]
param(
  [switch]$NoBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo = "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
if (-not (Test-Path $repo)) { throw "Repo missing: $repo" }

Set-Location $repo

Write-Host ""
Write-Host "=== FGS UP ==="
Write-Host "Repo: $repo"
Write-Host ""

git status
git log -1 --oneline

# Clear Next.js dev lock (common after crashes)
$lock = Join-Path $repo ".next\dev\lock"
if (Test-Path $lock) {
  Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue
  Write-Host "Cleared: $lock"
}

Write-Host ""
Write-Host "Starting: npm run dev"
Write-Host ""

# Start dev server in a separate window so your shell stays usable
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$repo`" && npm run dev" -WorkingDirectory $repo | Out-Null

if (-not $NoBrowser) {
  Start-Sleep -Milliseconds 350
  Start-Process "http://localhost:3000/rods" | Out-Null
}
