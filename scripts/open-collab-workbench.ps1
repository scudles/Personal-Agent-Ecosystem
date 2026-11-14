param([switch]$PrepareOnly,[switch]$BackendOnly)
$ErrorActionPreference='Stop'
$platformRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $platformRoot
$launcherArguments=@()
if($PrepareOnly){$launcherArguments+='--prepare-only'}
if($BackendOnly){$launcherArguments+='--backend-only'}
& (Join-Path $platformRoot 'runtime\node.exe') (Join-Path $PSScriptRoot 'open-collab-workbench.mjs') @launcherArguments
if($LASTEXITCODE -ne 0){throw 'New isolated collaboration candidate did not start; existing services were not stopped.'}
