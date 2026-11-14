param([switch]$ValidateOnly)
$ErrorActionPreference='Stop'
$toolRoot='D:\TriReviewBridge\tools\secure-mcp-canary-001'
$stateRoot='D:\TriReviewBridge\evidence\secure-mcp-canary-001'
$client=Join-Path $toolRoot 'vendor\v0.0.20\tunnel-client.exe'
$profile=Join-Path $toolRoot 'profiles\trb-fictional-canary-001.yaml'
$required=[ordered]@{
 'material.mjs'='f4437645a9e7c9e6107bb3ba08654db0e4f786838c0a633a518695e02abd470b'
 'server.mjs'='28b052fc7b34faa95f7cfdc8e315db15efe8c064184c8f23b374b8e3444fc0dc'
 'vendor\v0.0.20\tunnel-client.exe'='92812d43cbbf030f2bee30d9ad1bef26884dcf12d2ccaefc60c40fa8122501db'
}
foreach($entry in $required.GetEnumerator()){
 $file=Join-Path $toolRoot $entry.Key
 $item=Get-Item -LiteralPath $file
 if(($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-or$item.PSIsContainer){throw 'nonplain_executable_source'}
 if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()-ne$entry.Value){throw 'frozen_source_mismatch'}
}
$profileBytes=Get-Content -LiteralPath $profile -Raw
if($profileBytes -match 'sk-[A-Za-z0-9]' -or -not $profileBytes.Contains('env:TRB_CANARY_RUNTIME_KEY')){throw 'profile_must_only_reference_secret'}
$expectedProfileHash='9a49258f93dfca267c6ab820135666e5628adfa7a821bf2ea0f511d5c531caa5'
if((Get-FileHash -LiteralPath $profile -Algorithm SHA256).Hash.ToLowerInvariant()-ne$expectedProfileHash){throw 'profile_changed'}
if($ValidateOnly){Write-Output 'VALIDATED_OFFLINE_NO_PROMPT_NO_NETWORK';exit 0}
$mutex=[Threading.Mutex]::new($false,'Local\TRB-TUNNEL-CANARY-001')
$held=$false
$process=$null
$secureKey=$null
$pointer=[IntPtr]::Zero
$plainKey=$null
$startInfo=$null
try {
 $held=$mutex.WaitOne(0)
 if(-not$held){throw 'canary_runtime_already_open'}
 New-Item -ItemType Directory -Path (Join-Path $stateRoot 'client-temp') -Force|Out-Null
 Write-Host 'TriReviewBridge: fixed FICTIONAL material tunnel only.'
 Write-Host 'Create the 1-day key with ONLY Tunnels Read + Use. Paste it HERE, not into chat.'
 Write-Host 'Key is held only in process memory/environment; no key file or key command argument.'
 $secureKey=Read-Host 'Runtime key (hidden input)' -AsSecureString
 if($secureKey.Length-lt20-or$secureKey.Length-gt2048){throw 'key_length_invalid_no_echo'}
 $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
 $plainKey=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
 if(-not$plainKey.StartsWith('sk-')){throw 'key_format_invalid_no_echo'}
 $startInfo=[Diagnostics.ProcessStartInfo]::new()
 $startInfo.FileName=$client
 $startInfo.WorkingDirectory=$toolRoot
 $startInfo.UseShellExecute=$false
 $startInfo.CreateNoWindow=$true
 $startInfo.EnvironmentVariables.Clear()
 foreach($name in @('SystemRoot','WINDIR')){if([Environment]::GetEnvironmentVariable($name)){$startInfo.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
 $startInfo.EnvironmentVariables['TEMP']=Join-Path $stateRoot 'client-temp'
 $startInfo.EnvironmentVariables['TMP']=Join-Path $stateRoot 'client-temp'
 $startInfo.EnvironmentVariables['TRB_CANARY_RUNTIME_KEY']=$plainKey
 $startInfo.Arguments='run --config "'+$profile+'" --control-plane.base-url https://api.openai.com --control-plane.api-key env:TRB_CANARY_RUNTIME_KEY --control-plane.tunnel-id tunnel_6af6f626679c81919ec09e9d153ca0dc --control-plane.organization-id org-SnJGF0n848af4LjVeFFw7Z6a --health.listen-addr 127.0.0.1:0 --health.url-file "'+(Join-Path $stateRoot 'health-url.txt')+'" --pid.file "'+(Join-Path $stateRoot 'client.pid')+'" --allow-remote-ui=false --log.http-raw-unsafe=false --tracing.enabled=false --harpoon.capture-payloads=false --mcp.stdio-failure-policy exit --log.level warn --log.file "'+(Join-Path $stateRoot 'client.log')+'"'
 $process=[Diagnostics.Process]::Start($startInfo)
 $startInfo.EnvironmentVariables.Remove('TRB_CANARY_RUNTIME_KEY')
 $plainKey=$null
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
 $pointer=[IntPtr]::Zero
 $secureKey.Dispose()
 $secureKey=$null
 Write-Host 'Client started. Keep this local window open. Setup is not verified until the tool call succeeds.'
 Write-Host 'Keep this launcher open: it stops the client after 30 minutes while the launcher stays alive. Use Ctrl+C to stop normally; force-closing may require stopping the recorded client PID.'
 if(-not$process.WaitForExit(1800000)){$process.Kill();Write-Host 'Trial deadline reached; client stopped.'}
 else{Write-Host ('Client exited with code '+$process.ExitCode)}
} catch {
 Write-Host 'Canary setup stopped. Key and exception details are not printed. No automatic retry.'
 exit 1
} finally {
 if($process-and-not$process.HasExited){try{$process.Kill()}catch{}}
 if($startInfo){$startInfo.EnvironmentVariables.Remove('TRB_CANARY_RUNTIME_KEY')}
 $plainKey=$null
 if($pointer-ne[IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
 if($secureKey){$secureKey.Dispose()}
 if($held){$mutex.ReleaseMutex()}
 $mutex.Dispose()
}
