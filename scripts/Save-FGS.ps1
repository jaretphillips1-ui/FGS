param(
  [Parameter(Position=0)]
  [string]$Message = "CHECKPOINT"
)

$ErrorActionPreference = "Stop"

# Must be pwsh (PS7+)
if ($PSVersionTable.PSVersion.Major -lt 7) {
  Write-Host "❌ Save-FGS must be run in PowerShell 7+ (pwsh)." -ForegroundColor Red
  exit 1
}

$repo = "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
if (-not (Test-Path -LiteralPath $repo)) { throw "Repo not found: $repo" }
Set-Location $repo

# Ensure we're in a git repo
git rev-parse --is-inside-work-tree | Out-Null

# --- OneDrive authoritative save folders
$latestDir = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST"
New-Item -ItemType Directory -Path $latestDir -Force | Out-Null

# --- git facts
$commit = (git rev-parse --short HEAD).Trim()
$status = (git status --porcelain)

# --- write checkpoint (verifier expects: FGS_MASTER_CHECKPOINT.txt)
$chk = Join-Path $latestDir "FGS_MASTER_CHECKPOINT.txt"
@(
  "FGS MASTER CHECKPOINT"
  "====================="
  "Timestamp : $(Get-Date -Format o)"
  "Message   : $Message"
  "Repo      : $repo"
  "Commit    : $commit"
  "Dirty     : $([bool]$status)"
  ""
  "StatusPorc:"
  $status
) | Set-Content -LiteralPath $chk -Encoding UTF8

# --- Create zip reliably from git (tracked files)
$zip = Join-Path $latestDir "FGS_LATEST.zip"
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }

git archive --format=zip --output $zip HEAD

if (-not (Test-Path -LiteralPath $zip)) {
  throw "Zip was not created: $zip"
}

# --- also drop a copy on Desktop for quick access
$desktop = [Environment]::GetFolderPath("Desktop")
Copy-Item -LiteralPath $zip -Destination (Join-Path $desktop "FGS_LATEST.zip") -Force

Write-Host ""
Write-Host "✅ FGS SAVE COMPLETE" -ForegroundColor Green
Write-Host "Message : $Message"
Write-Host "Commit  : $commit"
Write-Host "Chk     : $chk"
Write-Host "Zip     : $zip"
Write-Host "Desktop : $(Join-Path $desktop "FGS_LATEST.zip")"