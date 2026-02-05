Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo = "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
Set-Location $repo

# Hard truth check (non-destructive)
& "$PSScriptRoot\fgs-hard-truth.ps1" | Write-Host

# Kill stale Next dev lock if it exists
$lock = Join-Path $repo ".next\dev\lock"
if (Test-Path $lock) {
  Remove-Item -Force -LiteralPath $lock
  "✅ Cleared .next\dev\lock"
}

# Start dev server
"Starting dev server..."
Start-Process -FilePath "powershell" -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$repo'; npm run dev"
)

# Open rods page after a short moment (browser handles the rest)
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000/rods"
