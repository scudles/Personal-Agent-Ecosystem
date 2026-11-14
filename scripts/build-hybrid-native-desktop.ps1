$ErrorActionPreference='Stop'
$platformRoot=Split-Path -Parent $PSScriptRoot
$framework='C:\Windows\Microsoft.NET\Framework64\v4.0.30319'
$csc=Join-Path $framework 'csc.exe'
$targetFolder=Join-Path $platformRoot 'runtime\hybrid-native-001'
New-Item -ItemType Directory -Path $targetFolder -Force | Out-Null
$out=Join-Path $targetFolder 'TriReviewBridge.UX.Collab.exe'
$refs=@('System.dll','System.Core.dll','System.Xaml.dll','System.Web.Extensions.dll','System.Security.dll')|ForEach-Object{Join-Path $framework $_}
$refs+=@('PresentationCore.dll','PresentationFramework.dll','WindowsBase.dll')|ForEach-Object{Join-Path (Join-Path $framework 'WPF') $_}
$compilerArguments=@('/nologo','/target:winexe','/platform:x64',"/out:$out")+@($refs|ForEach-Object{"/reference:$_"})+@(Get-ChildItem -LiteralPath (Join-Path $platformRoot 'desktop') -Filter '*.cs'|ForEach-Object{$_.FullName})
& $csc @compilerArguments
if($LASTEXITCODE -ne 0){throw 'Isolated hybrid native WPF build failed'}
Write-Host $out
