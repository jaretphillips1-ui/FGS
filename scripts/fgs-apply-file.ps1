param(
  [Parameter(Mandatory=$true)]
  [string]$Path,

  [Parameter(Mandatory=$true)]
  [string]$Content,

  [switch]$NoBackup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Repo root = current location
$repoRoot = (Get-Location).Path

# Resolve target file under repo root
$target = Join-Path $repoRoot $Path
$targetFull = [System.IO.Path]::GetFullPath($target)

if (-not $targetFull.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to write outside repo root. Target: $targetFull"
}

if (-not (Test-Path -LiteralPath $targetFull)) {
  throw "Target file not found: $targetFull"
}

# Backup alongside file (timestamped)
if (-not $NoBackup) {
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = "$targetFull.bak.$ts"
  Copy-Item -LiteralPath $targetFull -Destination $bak -Force
  Write-Host "Backup:" $bak
}

# Write content (UTF8)
Set-Content -LiteralPath $targetFull -Value $Content -Encoding utf8

# Verify
$len = (Get-Item -LiteralPath $targetFull).Length
if ($len -lt 10) {
  throw "Write verification failed (file too small): $targetFull"
}

Write-Host "Wrote:" $targetFull
Get-Item -LiteralPath $targetFull | Select-Object FullName, Length, LastWriteTime
