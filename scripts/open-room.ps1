$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'start.ps1')
$platformRoot=Split-Path -Parent $PSScriptRoot
$cfg=Get-Content -LiteralPath (Join-Path $platformRoot 'data\local-config.json') -Raw | ConvertFrom-Json
$url="http://127.0.0.1:$($cfg.port)/#$($cfg.token)"
$edge='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if(Test-Path -LiteralPath $edge){Start-Process -FilePath $edge -ArgumentList @("--app=$url",'--window-size=1420,940')}else{Start-Process $url}
Write-Host '已打开三方协作窗口；投递暂停状态保持不变。'