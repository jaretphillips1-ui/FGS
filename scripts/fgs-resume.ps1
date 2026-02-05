# FGS Resume (no-drift): works when executed as a script OR pasted
$ErrorActionPreference = "Stop"

function Get-FgsRepoRoot {
  if ($PSScriptRoot -and $PSScriptRoot.Trim().Length -gt 0) {
    return (Split-Path -Parent $PSScriptRoot)
  }

  $d = (Get-Location).Path
  while ($true) {
    if (Test-Path (Join-Path $d "package.json")) { return $d }
    $p = Split-Path -Parent $d
    if ($p -eq $d) { break }
    $d = $p
  }

  return "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
}

$repo = Get-FgsRepoRoot
Set-Location $repo

Write-Host "`n=== Repo ==="
Get-Location
git status
git log -1 --oneline

Write-Host "`n=== Stop stray node (safe) ==="
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
  try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {}
}

Write-Host "`n=== Clear .next dev lock (if any) ==="
$lock = Join-Path $repo ".next\dev\lock"
if (Test-Path $lock) { Remove-Item $lock -Force; Write-Host "Removed: $lock" } else { Write-Host "No lock." }

Write-Host "`n=== npm ci ==="
npm ci

Write-Host "`n=== lint ==="
npm run lint

Write-Host "`n=== dev ==="
npm run dev
