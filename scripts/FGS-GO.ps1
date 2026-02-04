$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app'
$dev  = 'C:\Users\lsphi\OneDrive\AI_Workspace\FGS\fgs-app\scripts\fgs-dev.ps1'

# Start dev server in its own window (runs fgs-dev.ps1)
Start-Process -FilePath 'powershell.exe' -WorkingDirectory $repo -ArgumentList @(
  '-NoExit',
  '-ExecutionPolicy','Bypass',
  '-File', $dev
)

# Open the app
Start-Sleep -Seconds 2
Start-Process 'http://localhost:3000/rods'
