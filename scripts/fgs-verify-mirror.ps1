Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

"--- FGS MIRROR VERIFY ---"

$saveZip  = "C:\Users\lsphi\OneDrive\AI_Workspace\_SAVES\FGS\LATEST\FGS_LATEST.zip"
$zipLocal = Join-Path $env:USERPROFILE "Desktop\FGS_LATEST.zip"
$zipOD    = Join-Path $env:USERPROFILE "OneDrive\Desktop\FGS_LATEST.zip"

"SaveZip : $saveZip"
"Local  : $zipLocal"
"OneDrv : $zipOD"

foreach ($p in @($saveZip, $zipLocal, $zipOD)) {
  if ([string]::IsNullOrWhiteSpace($p)) { throw "Path is empty/null." }
  if (-not (Test-Path -LiteralPath $p)) { throw "Missing file: $p" }
}

$info = Get-Item -LiteralPath $saveZip, $zipLocal, $zipOD | Select-Object FullName, Length, LastWriteTime
""
"--- FILE INFO ---"
$info | Format-Table -AutoSize

"--- HASH (SHA256) ---"
$hSave  = (Get-FileHash -LiteralPath $saveZip  -Algorithm SHA256 -ErrorAction Stop).Hash
$hLocal = (Get-FileHash -LiteralPath $zipLocal -Algorithm SHA256 -ErrorAction Stop).Hash
$hOD    = (Get-FileHash -LiteralPath $zipOD    -Algorithm SHA256 -ErrorAction Stop).Hash

"Save   : $hSave"
"Local  : $hLocal"
"OneDrv : $hOD"

if ($hSave -ne $hLocal -or $hSave -ne $hOD) { throw "Mirror hash mismatch. STOP." }

"OK: Mirror hash matches canonical zip."
