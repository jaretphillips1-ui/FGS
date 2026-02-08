Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-FgsHeartbeat {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][ValidateSet("OK","WARN","FAIL")] [string]$Status,
    [Parameter(Mandatory)][string]$Message,
    [string]$Repo = "",
    [string]$FallbackLogPath = "C:\ProgramData\FGS\logs\heartbeat.log"
  )

  $ts = Get-Date -Format o
  $line = "[{0}] {1} {2}" -f $ts, $Status, $Message

  if (-not [string]::IsNullOrWhiteSpace($Repo)) {
    $line += " | Repo: $Repo"
  }

  # Prefer Event Log if possible. Creating a new Source usually requires admin.
  # Strategy:
  # 1) If "FGS" source exists, use it.
  # 2) Else fall back to an existing common source: "Windows PowerShell".
  # 3) If Event Log write fails, fall back to file log.
  $logName = "Application"
  $sourcePreferred = "FGS"
  $sourceFallback  = "Windows PowerShell"

  $entryType = "Information"
  $eventId   = 3001

  switch ($Status) {
    "OK"   { $entryType = "Information"; $eventId = 3001 }
    "WARN" { $entryType = "Warning";     $eventId = 3002 }
    "FAIL" { $entryType = "Error";       $eventId = 3003 }
  }

  $didEventLog = $false
  try {
    $srcToUse = $null

    if ([System.Diagnostics.EventLog]::SourceExists($sourcePreferred)) {
      $srcToUse = $sourcePreferred
    } elseif ([System.Diagnostics.EventLog]::SourceExists($sourceFallback)) {
      $srcToUse = $sourceFallback
    }

    if ($srcToUse) {
      Write-EventLog -LogName $logName -Source $srcToUse -EventId $eventId -EntryType $entryType -Message $line
      $didEventLog = $true
    }
  } catch {
    $didEventLog = $false
  }

  if (-not $didEventLog) {
    $dir = Split-Path -Parent $FallbackLogPath
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Add-Content -LiteralPath $FallbackLogPath -Encoding UTF8 -Value $line
  }

  return $didEventLog
}
