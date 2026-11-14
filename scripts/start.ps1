$ErrorActionPreference = 'Stop'
$platformRoot = Split-Path -Parent $PSScriptRoot
$node = Join-Path $platformRoot 'runtime\node.exe'
$configFile = Join-Path $platformRoot 'data\local-config.json'
if (Test-Path -LiteralPath $configFile) {
 $cfg = Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
 try { $response = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/api/state" -f $cfg.port) -Headers @{Authorization="Bearer $($cfg.token)"} -TimeoutSec 2; Write-Host '验证服务已经运行。'; exit 0 } catch {}
}
$proc = Start-Process -FilePath $node -ArgumentList @((Join-Path $platformRoot 'src\server.mjs')) -WorkingDirectory $platformRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $platformRoot 'data\service.stdout.log') -RedirectStandardError (Join-Path $platformRoot 'data\service.stderr.log') -PassThru
for ($attempt=0; $attempt -lt 25; $attempt++) {
 Start-Sleep -Milliseconds 200
 $proc.Refresh()
 if ($proc.HasExited) { throw '服务未启动。请查看 D:\TriReviewBridge\data\service.stderr.log；不会停止占用端口的其它程序。' }
 if (Test-Path -LiteralPath $configFile) {
  $cfg = Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
  try {
   $response = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/api/state" -f $cfg.port) -Headers @{Authorization="Bearer $($cfg.token)"} -TimeoutSec 1
   if ($response.phase -in @(1,2)) { Write-Host ("验证服务已就绪，PID {0}。使用 open.ps1 打开验证台。" -f $proc.Id); exit 0 }
  } catch {}
 }
}
throw '等待服务就绪超时。没有打开或修改任何原会话。'
