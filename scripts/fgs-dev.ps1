$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app'

Write-Host 'FGS dev server starting...' -ForegroundColor Green

# If Turbopack lock exists, another dev instance is/was running — restart cleanly
$lock = 'C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app\.next\dev\lock'
if (Test-Path -LiteralPath $lock) {
  Write-Host 'Detected Next dev lock — stopping existing node processes and clearing lock...' -ForegroundColor Yellow
  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
  Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue
}

Write-Host 'Local: http://localhost:3000' -ForegroundColor Cyan
npm run dev