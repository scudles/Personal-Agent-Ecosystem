$ErrorActionPreference='Stop'
$platformRoot=Split-Path -Parent $PSScriptRoot
$info=Get-Content -LiteralPath (Join-Path $platformRoot 'data\workbench-service.json') -Raw|ConvertFrom-Json
$cfg=Get-Content -LiteralPath (Join-Path $platformRoot 'data\workbench-config.json') -Raw|ConvertFrom-Json
$p=Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $info.pid)
if(!$p){Write-Host '工作台后台已停止。';exit 0}
if($p.ExecutablePath -ne (Join-Path $platformRoot 'runtime\node.exe') -or $p.CommandLine -notlike '*TriReviewBridge*workbench-server.mjs*'){throw '后台进程身份不符，不停止。'}
Invoke-RestMethod -Method Post -Uri ("http://127.0.0.1:{0}/api/service/stop" -f $info.port) -Headers @{Authorization="Bearer $($cfg.token)"} -ContentType 'application/json' -Body '{}' -TimeoutSec 3|Out-Null
for($n=0;$n -lt 150;$n++){if(!(Get-Process -Id $info.pid -ErrorAction SilentlyContinue)){Write-Host '已排空模拟队列并停止后台。';exit 0};Start-Sleep -Milliseconds 200}
throw '停止等待超时，未强制终止后台。'