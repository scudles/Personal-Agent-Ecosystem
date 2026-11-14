$ErrorActionPreference='Stop'
$platformRoot=Split-Path -Parent $PSScriptRoot
& (Join-Path $platformRoot 'runtime\node.exe') (Join-Path $PSScriptRoot 'open-offline-workbench.mjs')
if($LASTEXITCODE -ne 0){throw 'Offline candidate failed; existing workbench is unchanged.'}