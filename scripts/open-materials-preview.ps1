$ErrorActionPreference='Stop'
$platformRoot=Split-Path -Parent $PSScriptRoot
& (Join-Path $platformRoot 'runtime\node.exe') (Join-Path $PSScriptRoot 'open-materials-preview.mjs')
if($LASTEXITCODE -ne 0){throw 'Isolated materials preview failed; existing backend is unchanged.'}