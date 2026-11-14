$ErrorActionPreference='Stop'
$platformRoot=Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'stop-workbench.ps1')
$cfg=Get-Content -LiteralPath (Join-Path $platformRoot 'data\workbench-config.json') -Raw|ConvertFrom-Json
$db=if($cfg.databaseFile){$cfg.databaseFile}else{'workbench.sqlite'}
if($db -notmatch '^[A-Za-z0-9_-]+\.sqlite$'){throw 'Invalid database file'}
$target=Join-Path $platformRoot ('backups\workbench-snapshot-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
if(Test-Path -LiteralPath $target){throw 'Backup already exists'}
[IO.Directory]::CreateDirectory($target)|Out-Null
Copy-Item -LiteralPath (Join-Path $platformRoot ('data\'+$db)) -Destination (Join-Path $target 'workbench.sqlite')
Copy-Item -LiteralPath (Join-Path $platformRoot 'data\workbench-config.json') -Destination (Join-Path $target 'workbench-config.json')
Copy-Item -LiteralPath (Join-Path $platformRoot 'evidence') -Destination $target -Recurse
$manifest=Get-ChildItem -LiteralPath $target -File -Recurse|ForEach-Object{[pscustomobject]@{path=$_.FullName.Substring($target.Length+1);bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}}
$manifest|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $target 'manifest.json') -Encoding utf8
Write-Host ('已备份至 '+$target+'；后台保持停止。')