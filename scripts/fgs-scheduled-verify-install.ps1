
[CmdletBinding()]
param(
  [ValidateSet("Daily","Hourly")][string]$Frequency = "Daily",
  [int]$EveryHours = 6,
  [int]$DailyHour = 9,
  [switch]$AlsoAtLogon
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo = "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
if (-not (Test-Path -LiteralPath $repo)) { throw "Repo missing: $repo" }

$pwsh = "C:\Program Files\PowerShell\7\pwsh.exe"
if (-not (Test-Path -LiteralPath $pwsh)) { throw "pwsh.exe not found: $pwsh" }

# Prefer ProgramData (system-wide stable location). If blocked, fall back to LocalAppData.
$root = Join-Path $env:ProgramData "FGS"
try {
  New-Item -ItemType Directory -Force -Path $root | Out-Null
} catch {
  $root = Join-Path $env:LOCALAPPDATA "FGS"
  New-Item -ItemType Directory -Force -Path $root | Out-Null
}

$bin  = Join-Path $root "bin"
$logs = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $bin  | Out-Null
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$runner = Join-Path $bin "fgs-scheduled-verify-run.ps1"

@"
Set-StrictMode -Version Latest
`$ErrorActionPreference = "Stop"

`$repo = "$repo"
`$pwsh = "$pwsh"
`$logs = "$logs"

if (-not (Test-Path -LiteralPath `$repo)) { throw "Repo missing: `$repo" }

`$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
`$logPath = Join-Path `$logs ("verify_{0}.log" -f `$stamp)

# Simple concurrency guard
`$lockPath = Join-Path `$logs "verify.lock"
if (Test-Path -LiteralPath `$lockPath) {
  # If lock is stale (> 2 hours), clear it
  try {
    `$age = (Get-Date) - (Get-Item -LiteralPath `$lockPath).LastWriteTime
    if (`$age.TotalHours -gt 2) { Remove-Item -Force -LiteralPath `$lockPath }
  } catch { }
}

if (Test-Path -LiteralPath `$lockPath) {
  Add-Content -LiteralPath `$logPath -Encoding UTF8 -Value "[`$(Get-Date -Format o)] WARN verify already running; exiting."
  exit 0
}

New-Item -ItemType File -Force -Path `$lockPath | Out-Null

try {
  Push-Location `$repo

  `$cmd = @(
    "-NoProfile",
    "-ExecutionPolicy","Bypass",
    "-File", (Join-Path `$repo "scripts\fgs-verify.ps1"),
    "-Plain"
  )

  & `$pwsh @cmd 2>&1 | Tee-Object -FilePath `$logPath

} finally {
  Pop-Location
  try { Remove-Item -Force -LiteralPath `$lockPath } catch { }
}
"@ | Set-Content -LiteralPath $runner -Encoding UTF8

$taskName = "FGS Scheduled Verify"

$action = New-ScheduledTaskAction `
  -Execute $pwsh `
  -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"{0}`"" -f $runner)

$triggers = @()

if ($Frequency -eq "Hourly") {
  if ($EveryHours -lt 1) { $EveryHours = 1 }
  $triggers += New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(5) `
    -RepetitionInterval (New-TimeSpan -Hours $EveryHours) `
    -RepetitionDuration ([TimeSpan]::MaxValue)
} else {
  $at = (Get-Date).Date.AddHours($DailyHour)
  if ($at -lt (Get-Date)) { $at = $at.AddDays(1) }
  $triggers += New-ScheduledTaskTrigger -Daily -At $at
}

if ($AlsoAtLogon) {
  $triggers += New-ScheduledTaskTrigger -AtLogOn
}

# Match your system enums:
# LogonTypeEnum: None, Password, S4U, Interactive, Group, ServiceAccount, InteractiveOrPassword
# RunLevelEnum : Limited, Highest
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable

$task = New-ScheduledTask -Action $action -Trigger $triggers -Principal $principal -Settings $settings

# Replace if exists
try { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue } catch { }

Register-ScheduledTask -TaskName $taskName -InputObject $task | Out-Null

Write-Host "✅ Installed Scheduled Task: $taskName" -ForegroundColor Green
Write-Host "  Runner: $runner"
Write-Host "  Logs  : $logs"
