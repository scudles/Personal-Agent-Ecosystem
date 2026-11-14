import {readFileSync,lstatSync,realpathSync,openSync,closeSync,fstatSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve,join,dirname,parse,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {PROFILE,MODE,HERMES_SESSION,HERMES_TITLE,demand,opaque,sha,checkJob,checkInspect,nativeEvidence} from './contract.mjs';
const ROOT=resolve(fileURLToPath(new URL('../..',import.meta.url))),DATA=join(ROOT,'data',PROFILE),CONFIG=join(DATA,'workbench-config.json');
const PYTHON='D:\\HermesAgent\\Data\\installs\\83877ba9c77f9088\\environments\\5bc19e6f42ea45dabc55719dcad90d00\\venv\\Scripts\\python.exe';
const fixed=p=>process.platform==='win32'?resolve(p).toLowerCase():resolve(p);
function plainPath(path){
 const root=parse(path).root,chain=[root];let p=root;
 for(const part of relative(root,path).split(sep).filter(Boolean)){p=join(p,part);chain.push(p);}
 for(const item of chain){const s=lstatSync(item);demand(!s.isSymbolicLink()&&fixed(realpathSync(item))===fixed(item),'native_fixed_path_redirected');if(item!==path)demand(s.isDirectory(),'native_fixed_ancestor_not_directory');}
 if(process.platform==='win32'){
  const encoded=Buffer.from(JSON.stringify(chain),'utf8').toString('base64');
  const script="$ErrorActionPreference='Stop';$trbPaths=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+encoded+"'))|ConvertFrom-Json;foreach($trbPath in $trbPaths){if(([IO.File]::GetAttributes($trbPath) -band [IO.FileAttributes]::ReparsePoint) -ne 0){exit 42}}";
  try{execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:10000,stdio:['ignore','pipe','pipe']});}catch{throw Error('native_fixed_path_reparse_or_unavailable');}
 }
 return path;
}
export function validateConfig(c,role){
 demand(c&&c.mode===MODE&&c.profileId===PROFILE&&c.port===48738&&c.databaseFile==='hybrid-workbench.sqlite','native_hybrid_profile_required');
 demand(['hermes','deepseek'].includes(role),'native_worker_role_unsupported');
 const token=c.hybridWorkerTokens?.[role];demand(typeof token==='string'&&token.length>=32,'native_role_credential_missing');return token;
}
function productionApi(role){
 plainPath(CONFIG);const stat=lstatSync(CONFIG);demand(stat.isFile()&&stat.nlink===1&&stat.size<=16000,'native_config_not_bounded_regular_file');
 let token;try{token=validateConfig(JSON.parse(readFileSync(CONFIG,'utf8').replace(/^\uFEFF/,'')),role);}catch{throw Error('native_config_unavailable_or_invalid');}
 return async(op,input={})=>{
  demand(['status','peek','begin','submitted','receipt','unknown','heartbeat','role-control'].includes(op),'native_operation_not_allowed');
  demand(!Object.hasOwn(input,'role')||input.role===role,'native_cross_role_forbidden');
  const read=['status','peek'].includes(op),body={...input,role};const url='http://127.0.0.1:48738/api/hybrid/'+op+(read?'?role='+role:'');
  const response=await fetch(url,{method:read?'GET':'POST',redirect:'error',headers:{Authorization:'Bearer '+token,...read?{}:{'Content-Type':'application/json'}},...read?{}:{body:JSON.stringify(body)},signal:AbortSignal.timeout(10000)});
  const out=await response.json();demand(response.ok,'native_api_'+response.status);return out;
 };
}
function child(request,{allowPolicyRefresh=false}={}){demand(allowPolicyRefresh===true,'native_policy_refresh_not_authorized');return new Promise((resolve,reject)=>{
 const child=spawn(PYTHON,['-B',join(ROOT,'tools',PROFILE,'hermes-gateway.py'),'--ack-native-session-access','--ack-native-policy-refresh'],{cwd:ROOT,windowsHide:true,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'},stdio:['pipe','pipe','pipe']});
 let out='',tooLarge=false;const timer=setTimeout(()=>{child.kill();reject(Error('native_helper_timeout_outcome_unknown'));},30000);
 child.stdout.setEncoding('utf8');child.stdout.on('data',b=>{out+=b.toString('utf8');if(Buffer.byteLength(out)>256000){tooLarge=true;child.kill();}});child.stderr.resume();child.stdin.on('error',()=>{});child.on('error',()=>{clearTimeout(timer);reject(Error('native_helper_unavailable'));});
 child.on('close',()=>{clearTimeout(timer);if(tooLarge)return reject(Error('native_helper_response_too_large'));try{resolve(JSON.parse(out));}catch{reject(Error('native_helper_reply_invalid'));}});child.stdin.end(JSON.stringify(request),'utf8');
});}
export function createFixedHermesAdapter({allowPolicyRefresh=false}={}){
 const guard=()=>demand(allowPolicyRefresh===true,'native_policy_refresh_not_authorized');
 return {inspect:()=>{guard();return child({operation:'inspect'},{allowPolicyRefresh:true});},send:j=>{guard();return child({operation:'submit',jobId:j.id,requestText:j.requestText,requestSha256:j.requestSha256,baseline:j.baseline},{allowPolicyRefresh:true});},receipt:admissionId=>{guard();return child({operation:'receipt',admissionId},{allowPolicyRefresh:true});}};
}
// Importing the candidate cannot silently authorize the native resume/refresh path.
export const fixedHermesAdapter=createFixedHermesAdapter();
export async function tick({role='hermes',api,adapter,identityOnly=false,workerId='hybrid-hermes-worker'}){
 demand(typeof api==='function'&&adapter,'native_worker_dependencies_missing');
 if(role==='deepseek')return {role,state:'UNSUPPORTED',reason:'DSH_desktop_candidate_not_real_app_verified',sent:0,completed:0};
 demand(role==='hermes','native_worker_role_unsupported');
 const report={role,sent:0,completed:0,unknown:0};
 const reportIdentity=async()=>{
  const o=checkInspect(await adapter.inspect());
  await api('role-control',{role,action:'identity-report',sessionId:HERMES_SESSION,title:HERMES_TITLE,source:'WORKER_REPORTED_NATIVE_SESSION_INSPECT',observedAt:new Date().toISOString(),raw:{sessionId:HERMES_SESSION,title:HERMES_TITLE,adapter:'hermes-gateway-shared-session'}});
  return {...report,state:'IDENTITY_REPORTED_ONLY',busy:o.busy,notEnabled:true};
 };
 if(identityOnly)return reportIdentity();
 await api('heartbeat',{role,workerId});
 const s=await api('peek',{role});demand(s.mode===MODE&&s.profileId===PROFILE,'native_host_identity_mismatch');
 if(s.roleControl?.preparationRequested)return reportIdentity();
 const j=s.next;if(!j)return {...report,state:'IDLE'};checkJob(j);
 if(['DISPATCHING','SUBMITTED','UNKNOWN'].includes(j.state)){
  if(!opaque(j.nativeAdmissionId)){
   if(j.state!=='UNKNOWN')await api('unknown',{role,jobId:j.id,attemptToken:j.attemptToken,reason:'native_admission_missing_no_resend'});
   return {...report,state:'UNKNOWN',unknown:1};
  }
  let got;try{got=await adapter.receipt(j.nativeAdmissionId);}catch{return {...report,state:j.state,waiting:1,reason:'native_receipt_unavailable_no_resend'};}
  let evidence;try{evidence=nativeEvidence(j,got);}catch{
   if(j.state!=='UNKNOWN')await api('unknown',{role,jobId:j.id,attemptToken:j.attemptToken,reason:'native_receipt_unverifiable_no_resend'});
   return {...report,state:'UNKNOWN',unknown:1};
  }
  if(!evidence)return {...report,state:j.state,waiting:1};
  const r=await api('receipt',evidence);return {...report,state:r.state,completed:r.state==='COMPLETED'?1:0};
 }
 if(j.state!=='QUEUED')return {...report,state:j.state};
 if(s.paused||j.blockReason)return {...report,state:'BLOCKED',reason:j.blockReason||'paused'};
 const baseline=checkInspect(await adapter.inspect());if(baseline.busy)return {...report,state:'BLOCKED',reason:'original_session_busy'};
 const job=checkJob(await api('begin',{role,jobId:j.id,workerId}));demand(job.state==='DISPATCHING'&&job.maySend===true&&opaque(job.attemptToken),'native_begin_not_authorized');
 const still=await api('peek',{role}),next=still.next;
 if(still.paused||!next||next.id!==job.id||next.role!==role||next.state!=='DISPATCHING'||next.attemptToken!==job.attemptToken||next.dispatchContinuationAllowed!==true||next.cancelRequested){
  await api('unknown',{role,jobId:job.id,attemptToken:job.attemptToken,reason:'native_pre_send_state_changed_no_send'});return {...report,state:'UNKNOWN',unknown:1};
 }
 let submitted;try{submitted=await adapter.send({...job,baseline:{tailHash:baseline.tailHash,profileId:baseline.profileId??null}});}catch{
  await api('unknown',{role,jobId:job.id,attemptToken:job.attemptToken,reason:'native_submit_outcome_unknown_no_resend'});return {...report,state:'UNKNOWN',unknown:1};
 }
 if(submitted?.ok!==true||submitted.submitted!==true||submitted.sessionId!==HERMES_SESSION||!opaque(submitted.admissionId)){
  await api('unknown',{role,jobId:job.id,attemptToken:job.attemptToken,reason:'native_submit_not_exactly_acknowledged_no_resend'});return {...report,state:'UNKNOWN',unknown:1};
 }
 await api('submitted',{role,jobId:job.id,attemptToken:job.attemptToken,accepted:true,nativeAdmissionId:submitted.admissionId});return {...report,state:'SUBMITTED',sent:1};
}
function lock(role){
 plainPath(DATA);const path=join(DATA,'native-worker-'+role+'.lock'),fd=openSync(path,'wx');
 let stamp;try{writeFileSync(fd,JSON.stringify({pid:process.pid,role,startedAt:new Date().toISOString()}));stamp=fstatSync(fd);}catch(e){closeSync(fd);throw e;}
 return ()=>{closeSync(fd);plainPath(path);const s=lstatSync(path);if(s.dev===stamp.dev&&s.ino===stamp.ino&&s.nlink===1&&s.size===stamp.size)unlinkSync(path);};
}
async function main(){
 const args=process.argv.slice(2),role=args.at(-1);demand(['--once','--watch','--identity'].includes(args[0])&&args[1]==='--ack-native-session-access'&&['hermes','deepseek'].includes(role),'explicit_fixed_native_mode_and_role_required');
 if(role==='deepseek'){demand(args.length===3,'deepseek_fixed_unsupported_mode_required');console.log(JSON.stringify({role,state:'UNSUPPORTED',reason:'DSH_desktop_candidate_not_real_app_verified',sent:0,completed:0}));return;}
 demand(args.length===4&&args[2]==='--ack-native-policy-refresh','explicit_native_policy_refresh_ack_required');
 // This second acknowledgement is an operator assertion, never a grant of user consent.
 const adapter=createFixedHermesAdapter({allowPolicyRefresh:true});
 const api=productionApi(role),release=lock(role);let stopped=false;process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
 try{do{const result=await tick({role,api,adapter,identityOnly:args[0]==='--identity'});console.log(JSON.stringify(result));if(args[0]!=='--watch'||stopped)break;await new Promise(r=>setTimeout(r,2500));}while(!stopped);}finally{release();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(()=>{console.log(JSON.stringify({state:'STOPPED',error:'native_worker_unavailable_or_invalid',noAutomaticResend:true}));process.exitCode=2;});