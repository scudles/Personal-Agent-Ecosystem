import{mkdirSync,existsSync,writeFileSync,readFileSync,openSync,closeSync,unlinkSync,lstatSync}from'node:fs';
import{resolve,join}from'node:path';import{fileURLToPath}from'node:url';import{spawn}from'node:child_process';import{randomBytes}from'node:crypto';import{createConnection}from'node:net';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),profileId='hybrid-native-001',folder=join(root,'data',profileId),cfgPath=join(folder,'workbench-config.json'),statePath=join(folder,'hybrid-workspace.json'),lockPath=join(folder,'launcher.lock'),exe=join(root,'runtime',profileId,'TriReviewBridge.UX.Collab.exe'),port=48738,roles=['hermes','deepseek','chatgpt'];
const sessions={hermes:'local-6f275933587b3c068cdbe3bea5633785fb8cacfb3a4c298855c66d931b6946d7',deepseek:'session-ebd654d5-1bf8-419c-bc2a-d9be1ed023fc',chatgpt:'6af098fa-46bc-83e8-97c5-418f00e213b9'};
const requireThat=(ok,message)=>{if(!ok)throw Error(message);},readJson=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,'')),options=new Set(process.argv.slice(2));
for(const option of options)requireThat(['--prepare-only','--backend-only'].includes(option),'Unknown hybrid launcher option: '+option);
for(const path of [join(root,'data'),folder])if(existsSync(path))requireThat(!lstatSync(path).isSymbolicLink(),'Hybrid data path cannot be a link.');
mkdirSync(folder,{recursive:true});
if(!existsSync(cfgPath)){requireThat(!existsSync(join(folder,'hybrid-workbench.sqlite'))&&!existsSync(statePath),'Hybrid config missing beside existing state; no reset attempted.');writeFileSync(cfgPath,JSON.stringify({port,token:randomBytes(32).toString('hex'),mode:'HYBRID_NATIVE',profileId,databaseFile:'hybrid-workbench.sqlite',hybridWorkerTokens:Object.fromEntries(roles.map(role=>[role,randomBytes(32).toString('hex')]))},null,2),{flag:'wx'});}
const cfg=readJson(cfgPath),tokens=[cfg.token,...roles.map(role=>cfg.hybridWorkerTokens?.[role])];
requireThat(cfg.port===port&&cfg.mode==='HYBRID_NATIVE'&&cfg.profileId===profileId&&cfg.databaseFile==='hybrid-workbench.sqlite'&&tokens.every(token=>typeof token==='string'&&/^[a-f0-9]{64}$/.test(token))&&new Set(tokens).size===4,'Unexpected hybrid profile; existing data and services were not changed.');
if(options.has('--prepare-only')){console.log(JSON.stringify({profileId,folder,config:cfgPath,port,mode:cfg.mode,prepared:true,backendStarted:false,uiStarted:false,originalSessionOperations:0},null,2));process.exit(0);}
if(!options.has('--backend-only'))requireThat(existsSync(exe),'Build runtime/hybrid-native-001/TriReviewBridge.UX.Collab.exe before opening this candidate.');
const lock=openSync(lockPath,'wx');
try{
 const api=async(path,body)=>{const response=await fetch('http://127.0.0.1:'+port+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+cfg.token,'Content-Type':'application/json',...(body===undefined?{}:{'Idempotency-Key':randomBytes(16).toString('hex')})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(4000)}),value=await response.json();requireThat(response.ok,value.error||'Hybrid request failed.');return value;};
 const healthy=async()=>{try{const h=await api('/health');return h.ready===true&&h.mode==='HYBRID_NATIVE'&&h.profileId===profileId&&h.independentRuntime===false&&h.formalReviewAvailable===false;}catch{return false;}};
 const occupied=()=>new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port});socket.setTimeout(1200);socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));socket.once('timeout',()=>{socket.destroy();resolve(true);});});
 if(!await healthy()){
  requireThat(!await occupied(),'Port 48738 is occupied by a different or unhealthy service. No process was stopped or reconfigured.');
  const out=openSync(join(folder,'backend.stdout.log'),'a'),err=openSync(join(folder,'backend.stderr.log'),'a');let backend;
  try{backend=spawn(join(root,'runtime','node.exe'),[join(root,'src','workbench-server.mjs')],{cwd:root,windowsHide:true,detached:true,env:{...process.env,TRB_WORKBENCH_DATA_DIR:folder,TRB_WORKBENCH_MODE:'HYBRID_NATIVE',TRB_WORKBENCH_PROFILE:profileId,TRB_WORKBENCH_EMPTY:'1'},stdio:['ignore',out,err]});}finally{closeSync(out);closeSync(err);}
  let startupError;backend.once('error',error=>{startupError=error;});backend.unref();let ready=false;
  for(let n=0;n<80;n++){await new Promise(r=>setTimeout(r,200));if(startupError)throw startupError;if(backend.exitCode!==null)throw Error('Hybrid backend exited; inspect isolated logs. No other service was stopped.');if(await healthy()){ready=true;break;}}
  requireThat(ready,'Hybrid backend did not become ready; existing services were not stopped.');
 }
 let state;
 if(existsSync(statePath)){state=readJson(statePath);requireThat(state.profileId===profileId&&roles.every(role=>state.sessions?.[role]===sessions[role]),'Hybrid workspace identity mismatch; no reset attempted.');}
 else{
  let projects=await api('/api/projects');requireThat(projects.length<=1,'Hybrid bootstrap has multiple projects; inspect without resetting.');
  const project=projects[0]||await api('/api/projects',{name:'虚构试用｜三方原会话协作候选',description:'仅文字候选；角色默认暂停，真实身份和日常接入等待独立验证。'});
  projects=await api('/api/projects');const spaces=projects.find(p=>p.id===project.id).workspaces;requireThat(spaces.length<=1,'Hybrid bootstrap has multiple workspaces; inspect without resetting.');
  const createdWorkspace=spaces.length===0,ws=spaces[0]||await api('/api/projects/'+project.id+'/workspaces',{name:'三方文字协作',participants:roles});
  for(const role of roles){const view=await api('/api/workspaces/'+ws.id+'?projectId='+encodeURIComponent(project.id)),member=view.participants.find(p=>p.id===role);requireThat(member&&member.status!=='inactive','Hybrid workspace must contain all three designated participants.');if(member.kind!=='hybrid_native')await api('/api/workspaces/'+ws.id+'/bind-hybrid',{projectId:project.id,role});}
  if(createdWorkspace)await api('/api/workspaces/'+ws.id+'/configure',{projectId:project.id,recipients:[]});
  state={profileId,projectId:project.id,workspaceId:ws.id,sessions,createdAt:new Date().toISOString()};writeFileSync(statePath,JSON.stringify(state,null,2),{flag:'wx'});
 }
 const view=await api('/api/workspaces/'+state.workspaceId+'?projectId='+encodeURIComponent(state.projectId)),members=view.participants.filter(p=>p.status!=='inactive');
 requireThat(view.mode==='HYBRID_NATIVE'&&members.length===3&&roles.every(role=>members.some(p=>p.id===role&&p.kind==='hybrid_native'&&p.sessionId===sessions[role])),'Hybrid binding identity mismatch; no activation or rebinding attempted.');
 if(!options.has('--backend-only')){const ui=spawn(exe,['--config',cfgPath,'--project-id',state.projectId,'--workspace-id',state.workspaceId],{cwd:root,detached:true,windowsHide:false,stdio:'ignore'});ui.once('error',error=>{console.error(error.message);process.exitCode=1;});ui.unref();}
 console.log(JSON.stringify({profileId,mode:'HYBRID_NATIVE',port,projectId:state.projectId,workspaceId:state.workspaceId,uiStarted:!options.has('--backend-only'),independentRuntime:false,roles:members.map(p=>({role:p.id,paused:p.paused,verificationLevel:p.verificationLevel,queueAvailable:p.queueAvailable})),originalSessionOperations:0},null,2));
}finally{closeSync(lock);unlinkSync(lockPath);}
