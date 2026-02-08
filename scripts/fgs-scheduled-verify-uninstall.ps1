[CmdletBinding()]
param(
  [switch]$PurgeRuntime
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$taskName = "FGS Scheduled Verify"
try {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop | Out-Null
  Write-Host "✅ Removed Scheduled Task: $taskName" -ForegroundColor Green
} catch {
  Write-Warning "Task not found (or already removed): $taskName"
}

if ($PurgeRuntime) {
  $paths = @(
    (Join-Path $env:ProgramData "FGS"),
    (Join-Path $env:LOCALAPPDATA "FGS")
  ) | Select-Object -Unique

  foreach ($p in $paths) {
    if (Test-Path -LiteralPath $p) {
      try {
        Remove-Item -Recurse -Force -LiteralPath $p
        Write-Host "🧹 Purged runtime folder: $p" -ForegroundColor Yellow
      } catch {
        Write-Warning "Could not purge: $p ($($_.Exception.Message))"
      }
    }
  }
}
