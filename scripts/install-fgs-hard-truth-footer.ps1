Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo        = "C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app"
$truthScript = Join-Path $repo "scripts\fgs-truth.ps1"

$begin = "# ===== BEGIN FGS_HARD_TRUTH_FOOTER ====="
$end   = "# ===== END FGS_HARD_TRUTH_FOOTER ====="

$profilePath = $PROFILE.CurrentUserAllHosts
if (-not (Test-Path $profilePath)) {
  $dir = Split-Path -Parent $profilePath
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  New-Item -ItemType File -Force -Path $profilePath | Out-Null
}

# Backup profile (guardrail)
$profileBak = "$profilePath.bak.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item -Force -LiteralPath $profilePath -Destination $profileBak

# Profile block (single here-string, no nesting)
# NOTE: Keep catch message static to avoid $_ expansion during install.
$block = @"
$begin
# Auto-installed by scripts\install-fgs-hard-truth-footer.ps1
# Shows the FGS footer after prompts when you're inside the FGS repo.

`$global:FGS_REPO = "$repo"

if (-not `$global:FGS_TruthCache) {
  `$global:FGS_TruthCache = @{
    LastRun         = Get-Date "2000-01-01"
    Text            = ""
    LastPrintedText = ""
  }
}

function global:Get-FgsTruthFooter {
  param([int]`$CacheSeconds = 10)
  try {
    `$cwd = (Get-Location).Path
    if (-not (`$cwd -like (`$global:FGS_REPO + "*"))) { return "" }

    `$now = Get-Date
    if ((`$now - `$global:FGS_TruthCache.LastRun).TotalSeconds -lt `$CacheSeconds -and `$global:FGS_TruthCache.Text) {
      if (`$global:FGS_TruthCache.LastPrintedText -eq `$global:FGS_TruthCache.Text) { return "" }
      `$global:FGS_TruthCache.LastPrintedText = `$global:FGS_TruthCache.Text
      return `$global:FGS_TruthCache.Text
    }

    # Refresh cache by calling the truth script (capture output)
    if (Test-Path "$truthScript") {
      `$t = & "$truthScript" -CacheSeconds `$CacheSeconds 2>`$null | Out-String
      `$t = `$t.TrimEnd()
      `$global:FGS_TruthCache.LastRun = `$now
      `$global:FGS_TruthCache.Text    = `$t
    }

    if (`$global:FGS_TruthCache.LastPrintedText -eq `$global:FGS_TruthCache.Text) { return "" }
    `$global:FGS_TruthCache.LastPrintedText = `$global:FGS_TruthCache.Text
    return `$global:FGS_TruthCache.Text
  } catch {
    return "[FGS HARD TRUTH FOOTER] (error generating footer)"
  }
}

if (-not `$global:FGS_OriginalPrompt) {
  `$global:FGS_OriginalPrompt = (Get-Command prompt).ScriptBlock
}

function global:prompt {
  `$footer = Get-FgsTruthFooter -CacheSeconds 10
  if (`$footer) { Write-Host `$footer }
  & `$global:FGS_OriginalPrompt
}

function global:fgs-truth {
  if (Test-Path "$truthScript") { & "$truthScript" } else { Write-Host "Missing: $truthScript" }
}

$end
"@

$profileText = Get-Content -LiteralPath $profilePath -Raw
$pattern = [regex]::Escape($begin) + "(?s).*?" + [regex]::Escape($end)

if ($profileText -match $pattern) {
  $profileText = [regex]::Replace($profileText, $pattern, $block, 1)
  Write-Host "Updated existing FGS footer block."
} else {
  if (-not $profileText.EndsWith("`r`n")) { $profileText += "`r`n" }
  $profileText += "`r`n" + $block + "`r`n"
  Write-Host "Appended new FGS footer block."
}

Set-Content -LiteralPath $profilePath -Value $profileText -Encoding UTF8
. $PROFILE.CurrentUserAllHosts

Write-Host "✅ Installed + reloaded: $profilePath"
Write-Host "✅ Backup: $profileBak"
Get-Command Get-FgsTruthFooter, fgs-truth, prompt | Select Name, CommandType | Format-Table -AutoSize
