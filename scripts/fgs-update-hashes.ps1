[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  $locked = "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
  if (Test-Path -LiteralPath $locked) { return $locked }

  if ($PSScriptRoot -and $PSScriptRoot.Trim().Length -gt 0) {
    $d = Split-Path -Parent $PSScriptRoot
    while ($true) {
      if (Test-Path -LiteralPath (Join-Path $d "package.json")) { return $d }
      $p = Split-Path -Parent $d
      if ($p -eq $d) { break }
      $d = $p
    }
  }

  throw "Unable to resolve repo root."
}

$repo = Resolve-RepoRoot
Set-Location $repo

$manifestPath = Join-Path $repo "scripts\fgs-hash-manifest.json"

# Files we consider "hardened surface area"
$files = @(
  "scripts\fgs-verify.ps1",
  "scripts\fgs-eventlog.ps1",
  "scripts\fgs-backup.ps1",
  "scripts\fgs-save-shutdown.ps1",
  "scripts\fgs-hard-truth.ps1",
  "scripts\fgs-truth.ps1",
  "scripts\fgs-verify-mirror.ps1",
  "scripts\fgs-apply-file.ps1",
  "scripts\fgs-up.ps1",
  "scripts\fgs-down.ps1",
  "scripts\fgs-dev.ps1",
  "scripts\fgs-resume.ps1",
  "scripts\FGS-GO.ps1",
  "scripts\install-fgs-hard-truth-footer.ps1",
  "scripts\Save-FGS.ps1",
  "scripts\Save-FGS-Verified.ps1"
)

$missing = @()
$out = @()

foreach ($rel in $files) {
  $full = Join-Path $repo $rel
  if (-not (Test-Path -LiteralPath $full)) {
    $missing += $rel
    continue
  }
  $hash = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash
  $out += [pscustomobject]@{ path = $rel; sha256 = $hash }
}

if ($missing.Count -gt 0) {
  Write-Warning ("Some files listed for hashing are missing (they will be skipped):`n  " + ($missing -join "`n  "))
}

$manifest = [pscustomobject]@{
  generated_at = (Get-Date -Format o)
  repo         = $repo
  files        = $out
}

$dir = Split-Path -Parent $manifestPath
New-Item -ItemType Directory -Force -Path $dir | Out-Null

($manifest | ConvertTo-Json -Depth 5) | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host "✅ Updated hash manifest:" -ForegroundColor Green
Write-Host "  $manifestPath"
Write-Host ("  Entries: {0}" -f @($out).Count)
