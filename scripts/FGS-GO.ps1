$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app'
$dev  = 'C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app\scripts\fgs-dev.ps1'

# Always spawn the dev window using PowerShell 7 (pwsh), not Windows PowerShell (powershell.exe)
$pwsh = (Get-Command pwsh -ErrorAction Stop).Source

Start-Process -FilePath $pwsh -WorkingDirectory $repo -ArgumentList @(
  '-NoExit',
  '-ExecutionPolicy','Bypass',
  '-File', $dev
)

# Open the app
Start-Sleep -Seconds 2
Start-Process 'http://localhost:3000/rods'
