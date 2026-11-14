$ErrorActionPreference='Stop'
$platformRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $platformRoot
& (Join-Path $platformRoot 'runtime\node.exe') (Join-Path $PSScriptRoot 'open-ux-workbench.mjs')
if($LASTEXITCODE -ne 0){throw 'UX candidate did not start'}
