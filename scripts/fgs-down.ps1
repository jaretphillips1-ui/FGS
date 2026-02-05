#@FGS_DOWN_HEADER
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo = "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
if (-not (Test-Path $repo)) { throw "Repo missing: $repo" }

Write-Host ""
Write-Host "=== FGS DOWN ==="
Write-Host "Repo: $repo"
Write-Host ""

# Kill only node.exe processes whose command line includes the repo path
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -and ($_.CommandLine -like "*$repo*") }

if (-not $procs) {
  Write-Host "No repo-scoped node.exe processes found."
} else {
  $count = @($procs).Count
  Write-Host "Stopping $count node.exe process(es) scoped to repo:"
  $procs | ForEach-Object { "  PID $($_.ProcessId) :: $($_.CommandLine)" }
  foreach ($p in $procs) {
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {}
  }
  Write-Host "Stopped."
}

# Clear Next.js dev lock
$lock = Join-Path $repo ".next\dev\lock"
if (Test-Path $lock) {
  Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue
  Write-Host "Cleared: $lock"
}

Write-Host "Done."
