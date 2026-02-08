Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

"--- FGS MIRROR VERIFY (Desktop mirrors) ---"

# Canonical zip (ONE TRUE SAVE root) - REQUIRED
$saveZip = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST\FGS_LATEST.zip"

# Desktop dirs
$desktopLocalDir        = Join-Path $env:USERPROFILE "Desktop"
$desktopOneDriveDesktop = Join-Path $env:USERPROFILE "OneDrive\Desktop"
$desktopOneDriveFGSDir  = Join-Path $desktopOneDriveDesktop "FGS"

# Targets list:
# - Canonical required
# - OneDrive Desktop\FGS\FGS_LATEST.zip required IF OneDrive Desktop\FGS folder exists
# - OneDrive Desktop root zip optional (compat)
# - Local Desktop root zip optional
$targets = New-Object System.Collections.Generic.List[string]
$targets.Add($saveZip)

$oneDriveFolderZip = $null
$oneDriveRootZip   = $null
$localZip          = $null

# Print paths we care about
"SaveZip : $saveZip"

# Validate canonical
if ([string]::IsNullOrWhiteSpace($saveZip)) { throw "Canonical path is empty/null." }
if (-not (Test-Path -LiteralPath $saveZip)) { throw "Missing canonical zip: $saveZip" }

# OneDrive folder-only mirror (preferred + required if folder exists)
if (Test-Path -LiteralPath $desktopOneDriveFGSDir) {
  $oneDriveFolderZip = Join-Path $desktopOneDriveFGSDir "FGS_LATEST.zip"
  "OneDrv(Folder) : $oneDriveFolderZip"

  if (-not (Test-Path -LiteralPath $oneDriveFolderZip)) {
    throw "Missing required OneDrive folder mirror: $oneDriveFolderZip"
  }

  $targets.Add($oneDriveFolderZip)
} else {
  Write-Warning "OneDrive Desktop\FGS folder not found; folder-mirror check skipped."
}

# Optional: OneDrive Desktop root zip (compat only; do NOT require)
if (Test-Path -LiteralPath $desktopOneDriveDesktop) {
  $oneDriveRootZip = Join-Path $desktopOneDriveDesktop "FGS_LATEST.zip"
  "OneDrv(Root opt) : $oneDriveRootZip"

  if (Test-Path -LiteralPath $oneDriveRootZip) {
    $targets.Add($oneDriveRootZip)
  } else {
    "OK: OneDrive Desktop root zip not present (optional)."
  }
} else {
  Write-Warning "OneDrive Desktop folder not found; root-zip check skipped."
}

# Optional: Local Desktop root zip (compat only; do NOT require)
if (Test-Path -LiteralPath $desktopLocalDir) {
  $localZip = Join-Path $desktopLocalDir "FGS_LATEST.zip"
  "Local(Root opt) : $localZip"

  if (Test-Path -LiteralPath $localZip) {
    $targets.Add($localZip)
  } else {
    "OK: Local Desktop root zip not present (optional)."
  }
} else {
  Write-Warning "Local Desktop folder not found; local-zip check skipped."
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

# Compare everyone included to canonical
$hSave = $hashes[$saveZip]
foreach ($p in $targets) {
  if ($p -eq $saveZip) { continue }
  if ($hashes[$p] -ne $hSave) {
    throw "Mirror hash mismatch vs canonical. STOP.`nCanonical: $saveZip`nMirror: $p"
  }
}

if ($oneDriveFolderZip) {
  "OK: OneDrive folder mirror hash matches canonical zip."
} else {
  "OK: OneDrive folder mirror not enforced (folder missing)."
}

if ($oneDriveRootZip -and (Test-Path -LiteralPath $oneDriveRootZip)) {
  "OK: OneDrive root zip hash matches canonical zip. (optional)"
} else {
  "OK: OneDrive root zip not enforced."
}

if ($localZip -and (Test-Path -LiteralPath $localZip)) {
  "OK: Local Desktop root zip hash matches canonical zip. (optional)"
} else {
  "OK: Local Desktop root zip not enforced."
}

"OK: Mirror verify complete."
