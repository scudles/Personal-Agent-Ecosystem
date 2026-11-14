$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'start-workbench.ps1')
$platformRoot=Split-Path -Parent $PSScriptRoot
$exe=Join-Path $platformRoot 'runtime\native\TriReviewBridge.exe'
if(!(Test-Path -LiteralPath $exe)){& (Join-Path $PSScriptRoot 'build-desktop.ps1')}
Start-Process -FilePath $exe -WorkingDirectory $platformRoot
Write-Host '已打开WPF原生工作台；真实Adapter保持禁用，原会话与DeepSeek草稿未操作。'