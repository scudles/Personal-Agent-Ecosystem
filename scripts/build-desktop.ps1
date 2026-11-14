param([string]$OutputName='TriReviewBridge.exe')
$ErrorActionPreference='Stop'
$platformRoot=Split-Path -Parent $PSScriptRoot
$framework='C:\Windows\Microsoft.NET\Framework64\v4.0.30319'
$csc=Join-Path $framework 'csc.exe'
if($OutputName -notmatch '^TriReviewBridge(?:\.(?:Offline|UX(?:\.(?:Theme|Collab))?))?\.exe$'){throw 'Invalid desktop output name'}
$out=Join-Path $platformRoot ("runtime\native\"+$OutputName)
$refs=@('System.dll','System.Core.dll','System.Xaml.dll','System.Web.Extensions.dll','System.Security.dll')|ForEach-Object{Join-Path $framework $_}
$refs+=@('PresentationCore.dll','PresentationFramework.dll','WindowsBase.dll')|ForEach-Object{Join-Path (Join-Path $framework 'WPF') $_}
$args=@('/nologo','/target:winexe','/platform:x64',"/out:$out")+@($refs|ForEach-Object{"/reference:$_"})+@(Get-ChildItem -LiteralPath (Join-Path $platformRoot 'desktop') -Filter '*.cs'|ForEach-Object{$_.FullName})
& $csc @args
if($LASTEXITCODE -ne 0){throw 'WPF native build failed'}
Write-Host 'WPF原生桌面编译完成（不使用浏览器/WebView）。'