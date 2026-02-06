Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

"--- FGS MIRROR VERIFY (Desktop mirrors) ---"

# Canonical zip (ONE TRUE SAVE root) - REQUIRED
$saveZip = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST\FGS_LATEST.zip"

# Desktop dirs
$desktopLocalDir    = Join-Path $env:USERPROFILE "Desktop"
$desktopOneDriveDir = Join-Path $env:USERPROFILE "OneDrive\Desktop"

# Targets list:
# - Canonical required
# - OneDrive Desktop required IF folder exists
# - Local Desktop optional (warn if missing)
$targets = New-Object System.Collections.Generic.List[string]
$targets.Add($saveZip)

$oneDriveZip = $null
if (Test-Path -LiteralPath $desktopOneDriveDir) {
  $oneDriveZip = Join-Path $desktopOneDriveDir "FGS_LATEST.zip"
  $targets.Add($oneDriveZip)
}

$localZip = $null
if (Test-Path -LiteralPath $desktopLocalDir) {
  $localZip = Join-Path $desktopLocalDir "FGS_LATEST.zip"
  # NOTE: we do NOT add localZip yet. We only add it if the file exists.
}

"SaveZip : $saveZip"
if ($oneDriveZip) { "OneDrv  : $oneDriveZip" }
if ($localZip)    { "Local  : $localZip" }

# Validate canonical
if ([string]::IsNullOrWhiteSpace($saveZip)) { throw "Canonical path is empty/null." }
if (-not (Test-Path -LiteralPath $saveZip)) { throw "Missing canonical zip: $saveZip" }

# Validate OneDrive Desktop mirror (required IF folder exists)
if ($oneDriveZip) {
  if (-not (Test-Path -LiteralPath $oneDriveZip)) {
    throw "Missing required OneDrive Desktop mirror: $oneDriveZip"
  }
}

# Local Desktop mirror is OPTIONAL
$useLocal = $false
if ($localZip) {
  if (Test-Path -LiteralPath $localZip) {
    $targets.Add($localZip)
    $useLocal = $true
  } else {
    Write-Warning "Local Desktop mirror missing (optional): $localZip"
  }
}

# De-dupe targets (simple + safe)
$unique = @()
foreach ($p in $targets) {
  if ($unique -notcontains $p) { $unique += $p }
}
$targets = $unique

""
"--- FILE INFO ---"
Get-Item -LiteralPath $targets |
  Select-Object FullName, Length, LastWriteTime |
  Format-Table -AutoSize

"--- HASH (SHA256) ---"
$hashes = @{}
foreach ($p in $targets) {
  $hashes[$p] = (Get-FileHash -LiteralPath $p -Algorithm SHA256 -ErrorAction Stop).Hash
}

$hashes.GetEnumerator() |
  Sort-Object Name |
  ForEach-Object { "{0} : {1}" -f $_.Key, $_.Value }

# Compare everyone to canonical
$hSave = $hashes[$saveZip]
foreach ($p in $targets) {
  if ($p -eq $saveZip) { continue }
  if ($hashes[$p] -ne $hSave) {
    throw "Mirror hash mismatch vs canonical. STOP.`nCanonical: $saveZip`nMirror: $p"
  }
}

if ($oneDriveZip) {
  "OK: OneDrive Desktop mirror hash matches canonical zip."
} else {
  Write-Warning "OneDrive Desktop folder not found; mirror check skipped."
}

if ($useLocal) {
  "OK: Local Desktop mirror hash matches canonical zip."
} else {
  "OK: Local Desktop mirror not enforced."
}

"OK: Mirror verify complete."
