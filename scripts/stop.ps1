$ErrorActionPreference = 'Stop'
$platformRoot = Split-Path -Parent $PSScriptRoot
$info = Get-Content -LiteralPath (Join-Path $platformRoot 'data\service.json') -Raw | ConvertFrom-Json
$cfg = Get-Content -LiteralPath (Join-Path $platformRoot 'data\local-config.json') -Raw | ConvertFrom-Json
$expected = Join-Path $platformRoot 'runtime\node.exe'
$p = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $info.pid)
if (!$p) { Write-Host '本平台服务已经停止。'; exit 0 }
if ($p.ExecutablePath -ne $expected -or $p.CommandLine -notlike '*TriReviewBridge*server.mjs*') { throw '进程身份不符，未停止任何进程。' }
$response = Invoke-RestMethod -Method Post -Uri ("http://127.0.0.1:{0}/api/shutdown" -f $cfg.port) -Headers @{Authorization="Bearer $($cfg.token)"} -ContentType 'application/json' -Body '{}' -TimeoutSec 3
if (!$response.stopping) { throw '服务尚未支持安全停止；保持当前进程，不强制终止桌面投递。' }
for ($attempt=0; $attempt -lt 220; $attempt++) {
 if (!(Get-Process -Id $info.pid -ErrorAction SilentlyContinue)) { Write-Host '已排空传输并停止本平台服务。'; exit 0 }
 Start-Sleep -Milliseconds 200
}
throw '安全停止等待超时；未强制终止进程。请查看平台状态。'
