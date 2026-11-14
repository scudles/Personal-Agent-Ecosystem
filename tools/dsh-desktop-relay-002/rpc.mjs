import {existsSync,readFileSync,lstatSync,realpathSync,unlinkSync,mkdirSync,openSync,closeSync,fstatSync,writeSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join,relative,isAbsolute,parse,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const configFile=join(root,'data','hybrid-native-001','workbench-config.json');
const OPS=Object.freeze({peek:['GET','/api/hybrid/peek'],status:['GET','/api/hybrid/status'],begin:['POST','/api/hybrid/begin'],submitted:['POST','/api/hybrid/submitted'],receipt:['POST','/api/hybrid/receipt'],unknown:['POST','/api/hybrid/unknown'],heartbeat:['POST','/api/hybrid/heartbeat'],identity:['POST','/api/hybrid/role-control'],unsafe:['POST','/api/hybrid/role-control']});
function demand(ok,message){if(!ok)throw Error(message);}
const sha=value=>createHash('sha256').update(value).digest('hex');
function readConfig(){
 const stat=lstatSync(configFile);demand(stat.isFile()&&!stat.isSymbolicLink(),'relay_config_not_regular_file');
 const canonicalRoot=realpathSync(root),canonicalConfig=realpathSync(configFile),inside=relative(canonicalRoot,canonicalConfig);demand(inside&&!inside.startsWith('..')&&!isAbsolute(inside),'relay_config_outside_platform');
 const c=JSON.parse(readFileSync(configFile,'utf8').replace(/^\uFEFF/,''));
 demand(c.mode==='HYBRID_NATIVE'&&c.profileId==='hybrid-native-001'&&c.databaseFile==='hybrid-workbench.sqlite','relay_profile_required');
 demand(c.port===48738,'relay_port_invalid');
 const token=c.hybridWorkerTokens?.deepseek;demand(typeof token==='string'&&token.length>=32,'relay_worker_credential_missing');
 return{port:c.port,token};
}
function config(){try{return readConfig();}catch{throw Error('relay_config_unavailable_or_invalid');}}
export async function call(op,input={}){
 demand(Object.hasOwn(OPS,op),'relay_worker_operation_not_allowed');
 demand(input&&typeof input==='object'&&!Array.isArray(input),'relay_worker_input_object_required');
 if(op==='identity')demand(input.action==='identity-report','dsh_identity_report_only');if(op==='unsafe')demand(input.action==='desktop-unsafe','dsh_unsafe_pause_only');
 const [method,path]=OPS[op],c=config();
 if(method==='GET')demand(Object.keys(input).length===0,'relay_worker_read_has_no_parameters');
 demand(!Object.hasOwn(input,'role')||input.role==='deepseek','hybrid_cross_role_input');const body=JSON.stringify({...input,role:'deepseek'});demand(Buffer.byteLength(body)<=512000,'relay_worker_payload_too_large');
 const response=await fetch('http://127.0.0.1:'+c.port+path+(method==='GET'?'?role=deepseek':''),{method,redirect:'error',headers:{Authorization:'Bearer '+c.token,...method==='POST'?{'Content-Type':'application/json'}:{}},...method==='POST'?{body}:{},signal:AbortSignal.timeout(10000)});
 const value=await response.json();
 if(response.ok&&['peek','status'].includes(op))demand(value.mode==='HYBRID_NATIVE'&&value.profileId==='hybrid-native-001'&&value.role==='deepseek'&&value.desktopRelay?.protocol==='TRB_DSH_DESKTOP_RELAY_002','dsh_desktop_relay_backend_protocol_required');
 if(response.ok&&op==='identity')return{ok:true,status:response.status,value:{...value,identityAccepted:value.identityReportAccepted===true&&value.verification==='USER_BOUND_WINDOW_TITLE_AND_ORIGINAL_ANCHOR'}};
 if(response.ok&&['submitted','receipt','unknown'].includes(op))return{ok:true,status:response.status,value:{id:value.id||value.jobId,state:value.state,cancelRequested:value.cancelRequested||false}};
 if(response.ok&&['peek','status'].includes(op)&&Array.isArray(value.inflight))value.inflight=value.inflight.map(j=>({id:j.id,state:j.state,cancelRequested:!!j.cancelRequested}));
 return{ok:response.ok,status:response.status,value};
}

async function envelope(request){
 const id=request?.id;
 try{
  demand(request&&typeof request==='object'&&!Array.isArray(request)&&Object.keys(request).every(k=>['id','op','input'].includes(k)),'relay_worker_envelope_invalid');
  demand(typeof id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(id),'relay_worker_request_id_invalid');
  if(request.op==='close')return{id,ok:true,closed:true};
  const out=await call(request.op,request.input===undefined?{}:request.input);
  return{id,...out};
 }catch(error){return{id:id||null,ok:false,status:0,error:String(error.message).slice(0,180)};}
}
function decodeRequest(encoded){
 demand(typeof encoded==='string'&&encoded.length<=700000&&/^[A-Za-z0-9_-]+$/.test(encoded),'relay_worker_encoding_invalid');
 try{const raw=Buffer.from(encoded,'base64url');demand(raw.length<=520000,'relay_worker_payload_too_large');return JSON.parse(raw.toString('utf8'));}catch{throw Error('relay_worker_request_invalid');}
}

const spoolFolder=join(root,'tools','dsh-desktop-relay-002','spool');
const fixedPath=p=>process.platform==='win32'?resolve(p).toLowerCase():resolve(p);
function spoolId(id){demand(typeof id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(id),'relay_worker_spool_id_invalid');return join(spoolFolder,id+'.request.b64');}
function directoryChain(){
 const volume=parse(spoolFolder).root,parts=relative(volume,spoolFolder).split(sep).filter(Boolean),paths=[volume];let cursor=volume;
 for(const part of parts){cursor=join(cursor,part);paths.push(cursor);}return paths;
}
function noWindowsReparse(paths){
 if(process.platform!=='win32')return;
 const encoded=Buffer.from(JSON.stringify(paths),'utf8').toString('base64');
 const script="$ErrorActionPreference='Stop';$trbChain=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+encoded+"'))|ConvertFrom-Json;foreach($trbPath in $trbChain){if(([IO.File]::GetAttributes($trbPath) -band [IO.FileAttributes]::ReparsePoint) -ne 0){exit 42}}";
 try{execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:10000,stdio:['ignore','pipe','pipe']});}
 catch{throw Error('relay_worker_spool_reparse_or_attributes_unavailable');}
}
// Check the entire lexical chain, including platform ancestors, on every use.
// realpath must equal the fixed path, not merely remain somewhere in platform.
function spoolDirectory(create=false){
 const paths=directoryChain();
 for(const p of paths){let st;try{st=lstatSync(p);}catch(error){
  if(error.code==='ENOENT'&&create&&p===spoolFolder){
   noWindowsReparse(paths.slice(0,-1));mkdirSync(p);st=lstatSync(p);
  }else throw error;
 }
 demand(st.isDirectory()&&!st.isSymbolicLink(),'relay_worker_spool_directory_not_plain');
 demand(fixedPath(realpathSync(p))===fixedPath(p),'relay_worker_spool_directory_redirected');
 }
 noWindowsReparse(paths);return spoolFolder;
}
function fileInfo(file){
 const st=lstatSync(file);demand(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1,'relay_worker_spool_not_regular_file');
 demand(fixedPath(realpathSync(file))===fixedPath(file),'relay_worker_spool_file_redirected');
 noWindowsReparse([file]);return st;
}
function sameFile(a,b){return a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs;}
export function spoolChunk(id,offset,chunk){
 const file=spoolId(id);demand(Number.isSafeInteger(offset)&&offset>=0&&offset<=700000,'relay_worker_spool_offset_invalid');
 demand(typeof chunk==='string'&&chunk.length>0&&chunk.length<=6000&&/^[A-Za-z0-9_-]+$/.test(chunk)&&offset+chunk.length<=700000,'relay_worker_spool_chunk_invalid');
 spoolDirectory(true);let fd;
 try{
  const before=offset===0?null:fileInfo(file);if(before)demand(before.size===offset,'relay_worker_spool_offset_mismatch');
  fd=openSync(file,offset===0?'wx':'r+');const opened=fstatSync(fd);
  demand(opened.isFile()&&opened.nlink===1&&opened.size===offset&&(!before||sameFile(before,opened)),'relay_worker_spool_file_changed');
  spoolDirectory();demand(sameFile(fileInfo(file),opened),'relay_worker_spool_file_changed');
  const bytes=Buffer.from(chunk,'ascii');demand(writeSync(fd,bytes,0,bytes.length,offset)===bytes.length,'relay_worker_spool_short_write');
  return{id,offset:offset+chunk.length};
 }finally{if(fd!==undefined)closeSync(fd);}
}
function spoolRead(id){
 const file=spoolId(id);spoolDirectory();const before=fileInfo(file);demand(before.size<=700000,'relay_worker_spool_too_large');let fd;
 try{
  fd=openSync(file,'r');const opened=fstatSync(fd);demand(sameFile(before,opened),'relay_worker_spool_file_changed');
  spoolDirectory();demand(sameFile(fileInfo(file),opened),'relay_worker_spool_file_changed');
  const encoded=readFileSync(fd,'utf8');demand(sameFile(fstatSync(fd),opened),'relay_worker_spool_file_changed');
  const request=decodeRequest(encoded);demand(request.id===id,'relay_worker_spool_request_id_mismatch');
  return{file,stat:opened,encoded,request};
 }finally{if(fd!==undefined)closeSync(fd);}
}
function removeOwnSpool(own){
 // A changed chain or file is retained. Never follow a replacement to cleanup.
 try{
  spoolDirectory();demand(sameFile(fileInfo(own.file),own.stat),'relay_worker_spool_cleanup_file_changed');
  demand(sha(readFileSync(own.file,'utf8'))===sha(own.encoded),'relay_worker_spool_cleanup_content_changed');
  spoolDirectory();demand(sameFile(fileInfo(own.file),own.stat),'relay_worker_spool_cleanup_file_changed');
  unlinkSync(own.file);
 }catch{}
}
export async function runSpoolRequest(id){
 const own=spoolRead(id);
 try{return await envelope(own.request);}finally{removeOwnSpool(own);}
}

async function main(){
 const mode=process.argv[2];
 if(mode==='--spool-chunk'){
  demand(process.argv.length===6&&/^(?:0|[1-9][0-9]{0,6})$/.test(process.argv[4]),'relay_worker_spool_chunk_arguments_invalid');
  process.stdout.write(JSON.stringify({ok:true,...spoolChunk(process.argv[3],Number(process.argv[4]),process.argv[5])})+'\n');return;
 }
 if(mode==='--rpc'||mode==='--rpc-file'){
  demand(process.argv.length===4,'relay_worker_rpc_argument_required');
  if(mode==='--rpc-file')process.stdout.write(JSON.stringify(await runSpoolRequest(process.argv[3]))+'\n');
  else{demand(process.argv[3].length<=6000,'relay_worker_inline_payload_too_large');process.stdout.write(JSON.stringify(await envelope(decodeRequest(process.argv[3])))+'\n');}
  return;
 }
 throw Error('dsh_rpc_requires_non_tty_one_shot');
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(()=>{process.stdout.write(JSON.stringify({id:null,ok:false,status:0,error:'relay_worker_start_failed'})+'\n');process.exitCode=1;});


