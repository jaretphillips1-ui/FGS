# FGS Backup (no-drift): works when executed as a script OR pasted
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

$repo  = Get-FgsRepoRoot
$saves = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST"
$desk  = "C:\Users\lsphi\Desktop"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"

Set-Location $repo
New-Item -ItemType Directory -Force -Path $saves | Out-Null

Write-Host "`n=== FGS BACKUP ==="
Write-Host "Repo: $repo"

$note = @"
FGS CHECKPOINT
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Repo: $repo
Branch: $(git branch --show-current)
Commit: $(git rev-parse --short HEAD)
Summary: Backup via scripts\fgs-backup.ps1
Latest ZIP: $saves\FGS_LATEST.zip
Stamped ZIP: $saves\FGS_LATEST_$stamp.zip
Desktop ZIP: $desk\FGS_LATEST.zip
"@

$notePath   = Join-Path $saves "FGS_LATEST_CHECKPOINT.txt"
$latestZip  = Join-Path $saves "FGS_LATEST.zip"
$stampedZip = Join-Path $saves ("FGS_LATEST_{0}.zip" -f $stamp)

$note | Set-Content -Path $notePath -Encoding UTF8

$tmp = Join-Path $env:TEMP ("FGS_STAGE_{0}" -f $stamp)
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

Copy-Item -Path (Join-Path $repo "*") `
  -Destination $tmp `
  -Recurse -Force `
  -Exclude @("node_modules",".next",".git") `
  -ErrorAction SilentlyContinue

Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $latestZip -Force
Compress-Archive -Path (Join-Path $tmp "*") -DestinationPath $stampedZip -Force

Remove-Item $tmp -Recurse -Force

Copy-Item -Path $latestZip -Destination (Join-Path $desk "FGS_LATEST.zip") -Force

Write-Host "`n✅ Backup complete:"
Write-Host "  $latestZip"
Write-Host "  $stampedZip"
Write-Host "  $notePath"
Write-Host "  Desktop mirrored"
