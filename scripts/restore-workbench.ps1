param([Parameter(Mandatory=$true)][string]$BackupDirectory)
$ErrorActionPreference='Stop'
$platformRoot=Split-Path -Parent $PSScriptRoot
$resolved=[IO.Path]::GetFullPath((Resolve-Path -LiteralPath $BackupDirectory).ProviderPath)
$allowed=[IO.Path]::GetFullPath((Join-Path $platformRoot 'backups'))+[IO.Path]::DirectorySeparatorChar
if(!$resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Backup must stay inside the platform backups directory'}
$source=Join-Path $resolved 'workbench.sqlite'
$manifestFile=Join-Path $resolved 'manifest.json'
if(!(Test-Path -LiteralPath $manifestFile)){throw 'Verified manifest is required'}
$manifest=Get-Content -LiteralPath $manifestFile -Raw|ConvertFrom-Json
$expected=$manifest|Where-Object{$_.path -eq 'workbench.sqlite'}
if(!$expected -or (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $expected.sha256){throw 'Backup hash mismatch'}
& (Join-Path $PSScriptRoot 'backup-workbench.ps1')
$configPath=Join-Path $platformRoot 'data\workbench-config.json'
$cfg=Get-Content -LiteralPath $configPath -Raw|ConvertFrom-Json
$name='workbench-restored-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff')+'.sqlite'
$target=[IO.Path]::GetFullPath((Join-Path $platformRoot ('data\'+$name)))
$dataPrefix=[IO.Path]::GetFullPath((Join-Path $platformRoot 'data'))+[IO.Path]::DirectorySeparatorChar
if(!$target.StartsWith($dataPrefix,[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $target)){throw 'Restore target is unsafe or already exists'}
Copy-Item -LiteralPath $source -Destination $target
$validate='import{DatabaseSync}from"node:sqlite";const db=new DatabaseSync(process.argv[1],{readOnly:true});if(db.prepare("PRAGMA integrity_check").get().integrity_check!=="ok"||db.prepare("PRAGMA foreign_key_check").all().length)throw Error("Restored DB validation failed");db.close();'
& (Join-Path $platformRoot 'runtime\node.exe') --input-type=module -e $validate $target
if($LASTEXITCODE -ne 0){throw 'Restored database validation failed; config unchanged'}
$cfg|Add-Member -NotePropertyName databaseFile -NotePropertyValue $name -Force
[IO.File]::WriteAllText($configPath,($cfg|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
Write-Host ('已恢复到新的数据库副本 '+$target+'；旧库仍保留，后台未启动。')