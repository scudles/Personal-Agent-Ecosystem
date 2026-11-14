import {readFileSync,lstatSync,realpathSync,unlinkSync,mkdirSync,openSync,closeSync,fstatSync,writeSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join,relative,isAbsolute,parse,sep} from 'node:path';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const configFile=join(root,'data','codex-relay-001','workbench-config.json');
const OPS=Object.freeze({peek:['GET','/api/relay/peek'],status:['GET','/api/relay/status'],begin:['POST','/api/relay/begin'],submitted:['POST','/api/relay/submitted'],receipt:['POST','/api/relay/receipt'],unknown:['POST','/api/relay/unknown'],heartbeat:['POST','/api/relay/heartbeat']});
function demand(ok,message){if(!ok)throw Error(message);}
function readConfig(){
 const stat=lstatSync(configFile);demand(stat.isFile()&&!stat.isSymbolicLink(),'relay_config_not_regular_file');
 const canonicalRoot=realpathSync(root),canonicalConfig=realpathSync(configFile),inside=relative(canonicalRoot,canonicalConfig);demand(inside&&!inside.startsWith('..')&&!isAbsolute(inside),'relay_config_outside_platform');
 const c=JSON.parse(readFileSync(configFile,'utf8').replace(/^\uFEFF/,''));
 demand(c.mode==='CODEX_RELAY'&&c.profileId==='codex-relay-001'&&c.databaseFile==='relay-workbench.sqlite','relay_profile_required');
 demand(Number.isInteger(c.port)&&c.port>0&&c.port<65536,'relay_port_invalid');
 const token=c.workerToken||c.token;demand(typeof token==='string'&&token.length>=32,'relay_worker_credential_missing');
 return{port:c.port,token};
}
function config(){try{return readConfig();}catch{throw Error('relay_config_unavailable_or_invalid');}}
export async function call(op,input={}){
 demand(Object.hasOwn(OPS,op),'relay_worker_operation_not_allowed');
 demand(input&&typeof input==='object'&&!Array.isArray(input),'relay_worker_input_object_required');
 const [method,path]=OPS[op],c=config();
 if(method==='GET')demand(Object.keys(input).length===0,'relay_worker_read_has_no_parameters');
 const body=JSON.stringify(input);demand(Buffer.byteLength(body)<=512000,'relay_worker_payload_too_large');
 const response=await fetch('http://127.0.0.1:'+c.port+path,{method,redirect:'error',headers:{Authorization:'Bearer '+c.token,...method==='POST'?{'Content-Type':'application/json'}:{}},...method==='POST'?{body}:{},signal:AbortSignal.timeout(10000)});
 const value=await response.json();
 if(response.ok&&['submitted','receipt','unknown'].includes(op))return{ok:true,status:response.status,value:{id:value.id||value.jobId,state:value.state,cancelRequested:value.cancelRequested||false}};
 if(response.ok&&['peek','status'].includes(op)&&Array.isArray(value.inflight))value.inflight=value.inflight.map(j=>({id:j.id,state:j.state,cancelRequested:!!j.cancelRequested}));
 return{ok:response.ok,status:response.status,value};
}

const THREAD='6af098fa-46bc-83e8-97c5-418f00e213b9',TITLE='Nagi（继承的你1）';
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
export async function observe(input){
 demand(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>['jobId','native'].includes(k)),'relay_observation_envelope_invalid');
 const status=await call('peek');if(!status.ok)return status;
 const j=status.value.next,n=input.native;
 demand(j&&j.id===input.jobId&&['DISPATCHING','SUBMITTED','UNKNOWN'].includes(j.state)&&typeof j.attemptToken==='string','relay_observation_job_not_inflight');
 demand(j.threadId===THREAD&&status.value.threadId===THREAD&&n?.thread?.id===THREAD&&n.thread.kind==='chatgpt'&&n.thread.title===TITLE,'relay_observation_original_thread_mismatch');
 const matches=(n.turns||[]).filter(t=>Array.isArray(t.items)&&t.items.some(i=>i.type==='userMessage'&&Array.isArray(i.content)&&i.content.filter(c=>c.type==='text').map(c=>c.text).join('\n')===j.requestText));
 demand(matches.length<=1,'relay_observation_multiple_matching_turns');
 const t=matches[0];
 if(!t||t.status!=='completed'||t.error)return{ok:true,status:200,value:{matched:false,state:j.state}};
 demand(!t.truncated&&!t.isTruncated,'relay_native_turn_truncated');
 const users=t.items.filter(i=>i.type==='userMessage'),replies=t.items.filter(i=>i.type==='agentMessage');
 demand(users.length===1&&replies.length>0&&replies.length<=16,'relay_native_turn_shape_unsupported');
 const user=users[0],requestText=user.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
 demand(typeof t.id==='string'&&typeof user.id==='string'&&replies.every(i=>typeof i.id==='string'&&typeof i.text==='string'&&!i.truncated&&!i.isTruncated&&i.text.length<20000),'relay_native_ids_or_text_unavailable');
 const replyText=replies.map(i=>i.text).join('\n\n');
 demand(replyText.trim()&&replyText.length<=30000,'relay_native_reply_empty_or_too_large');
 const body={jobId:j.id,attemptToken:j.attemptToken,threadId:THREAD,nativeTurnId:t.id,nativeUserMessageId:user.id,requestText,requestSha256:sha(requestText),replyIds:replies.map(i=>i.id),replyText,replySha256:sha(replyText),completed:true,nativeTurn:{id:t.id,threadId:THREAD,status:'completed',user:{id:user.id,threadId:THREAD,turnId:t.id,text:requestText},replies:replies.map(i=>({id:i.id,threadId:THREAD,turnId:t.id,text:i.text}))}};
 return call('receipt',body);
}

async function envelope(request){
 const id=request?.id;
 try{
  demand(request&&typeof request==='object'&&!Array.isArray(request)&&Object.keys(request).every(k=>['id','op','input'].includes(k)),'relay_worker_envelope_invalid');
  demand(typeof id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(id),'relay_worker_request_id_invalid');
  if(request.op==='close')return{id,ok:true,closed:true};
  const out=request.op==='observe'?await observe(request.input):await call(request.op,request.input===undefined?{}:request.input);
  return{id,...out};
 }catch(error){return{id:id||null,ok:false,status:0,error:String(error.message).slice(0,180)};}
}
function decodeRequest(encoded){
 demand(typeof encoded==='string'&&encoded.length<=700000&&/^[A-Za-z0-9_-]+$/.test(encoded),'relay_worker_encoding_invalid');
 try{const raw=Buffer.from(encoded,'base64url');demand(raw.length<=520000,'relay_worker_payload_too_large');return JSON.parse(raw.toString('utf8'));}catch{throw Error('relay_worker_request_invalid');}
}

const spoolFolder=join(root,'tools','codex-relay-001','spool');
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
 demand(process.argv.length===3&&mode==='--pipe','relay_worker_requires_rpc_or_jsonl');
 if(process.stdin.isTTY)process.stdin.setRawMode(true);
 const rl=createInterface({input:process.stdin,crlfDelay:Infinity,terminal:false});
 for await(const line of rl){
  if(!line.trim())continue;let result;
  try{demand(Buffer.byteLength(line)<=520000,'relay_worker_line_too_large');let request;try{request=JSON.parse(line);}catch{throw Error('relay_worker_request_invalid');}result=await envelope(request);}
  catch(error){result={id:null,ok:false,status:0,error:String(error.message).slice(0,180)};}
  process.stdout.write(JSON.stringify(result)+'\n');
  if(result.closed){rl.close();if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();break;}
 }
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(()=>{process.stdout.write(JSON.stringify({id:null,ok:false,status:0,error:'relay_worker_start_failed'})+'\n');process.exitCode=1;});


