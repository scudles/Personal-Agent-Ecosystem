param([ValidateSet('inspect','bind','probe')][string]$Mode='inspect')
$ErrorActionPreference='Stop'
$platformRoot=Split-Path -Parent $PSScriptRoot
$env:PYTHONDONTWRITEBYTECODE='1'
$python='D:\HermesAgent\Data\installs\83877ba9c77f9088\environments\5bc19e6f42ea45dabc55719dcad90d00\venv\Scripts\python.exe'
& $python -B (Join-Path $platformRoot 'native\hermes-session.py') $Mode
exit $LASTEXITCODE
