Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-SectionHeader([Parameter(Mandatory)][string]$Title) {
  $line = ("=" * 72)
  ""
  Write-Host $line
  Write-Host ("=== " + $Title + " ===")
  Write-Host $line
}

function Write-ContextRefresh {
  param(
    [Parameter(Mandatory)][string]$Repo
  )

  $sop     = Join-Path $Repo "docs\FGS_SOP.md"
  $lessons = Join-Path $Repo "docs\LESSONS_LEARNED.md"

  Write-SectionHeader "FGS CONTEXT REFRESH (auto)"
  Write-Host ("Time : {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
  Write-Host ("PWD  : {0}" -f (Get-Location).Path)
  Write-Host ("Repo : {0}" -f $Repo)
  ""
  Write-Host "Non-negotiable rule: Relative repo scripts only work from repo root."
  Write-Host "Safe entrypoints (work from anywhere):"
  Write-Host ('  - & "{0}"' -f (Join-Path $Repo "scripts\fgs-resume.ps1"))
  Write-Host ('  - & "{0}"' -f (Join-Path $Repo "scripts\fgs-save-shutdown.ps1"))
  Write-Host '  - Use the shortcut: FGS - SAVE + SHUTDOWN.lnk (runner)'
  ""
  Write-Host "If you see a path error like '.\scripts\...' from C:\Users\lsphi>, that is PWD drift."
  ""

  if (Test-Path -LiteralPath $sop) {
    Write-Host ("SOP:     {0}" -f $sop)
    Select-String -Path $sop -Pattern "Non-negotiable working-directory rule" -SimpleMatch -Context 0,12 -ErrorAction SilentlyContinue |
      ForEach-Object { $_.Line; $_.Context.PostContext } | Out-Host
  } else {
    Write-Host ("SOP missing: {0}" -f $sop)
  }

  ""

  if (Test-Path -LiteralPath $lessons) {
    Write-Host ("Lessons: {0}" -f $lessons)
    Select-String -Path $lessons -Pattern "Relative paths / PWD drift" -SimpleMatch -Context 0,14 -ErrorAction SilentlyContinue |
      ForEach-Object { $_.Line; $_.Context.PostContext } | Out-Host
  } else {
    Write-Host ("Lessons missing: {0}" -f $lessons)
  }

  ""
  Write-Host "Proceeding..."
}

$repo = "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
Set-Location $repo

Write-ContextRefresh -Repo $repo

# Hard truth check (non-destructive)
& "$PSScriptRoot\fgs-hard-truth.ps1" | Write-Host

# Kill stale Next dev lock if it exists
$lock = Join-Path $repo ".next\dev\lock"
if (Test-Path $lock) {
  Remove-Item -Force -LiteralPath $lock
  "✅ Cleared .next\dev\lock"
}

# Start dev server (PowerShell 7) in a dedicated window
"Starting dev server..."
Start-Process -FilePath "pwsh" -ArgumentList @(
  "-NoExit",
  "-Command",
  "`$Host.UI.RawUI.WindowTitle='FGS SERVER'; Set-Location '$repo'; npm run dev"
)

# Open rods page after a short moment (browser handles the rest)
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000/rods"
