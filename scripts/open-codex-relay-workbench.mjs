import{mkdirSync,existsSync,writeFileSync,readFileSync,openSync,closeSync,unlinkSync,lstatSync}from'node:fs';
import{resolve,join}from'node:path';import{fileURLToPath}from'node:url';import{spawn}from'node:child_process';import{randomBytes}from'node:crypto';import{createConnection}from'node:net';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),folder=join(root,'data','codex-relay-001'),cfgPath=join(folder,'workbench-config.json'),statePath=join(folder,'relay-workspace.json'),lockPath=join(folder,'launcher.lock'),exe=join(root,'runtime','codex-relay-001','TriReviewBridge.UX.Collab.exe'),port=48737,sessionId='6af098fa-46bc-83e8-97c5-418f00e213b9';
const requireThat=(ok,message)=>{if(!ok)throw Error(message);},readJson=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,'')),options=new Set(process.argv.slice(2));
for(const option of options)requireThat(['--prepare-only','--backend-only'].includes(option),'Unknown relay launcher option: '+option);
for(const path of [join(root,'data'),folder])if(existsSync(path))requireThat(!lstatSync(path).isSymbolicLink(),'Relay data path cannot be a link.');
mkdirSync(folder,{recursive:true});
if(!existsSync(cfgPath)){requireThat(!existsSync(join(folder,'relay-workbench.sqlite'))&&!existsSync(statePath),'Relay config missing beside existing state; no recovery/reset attempted.');writeFileSync(cfgPath,JSON.stringify({port,token:randomBytes(32).toString('hex'),mode:'CODEX_RELAY',profileId:'codex-relay-001',databaseFile:'relay-workbench.sqlite'},null,2),{flag:'wx'});}
const cfg=readJson(cfgPath);
requireThat(cfg.port===port&&cfg.mode==='CODEX_RELAY'&&cfg.profileId==='codex-relay-001'&&cfg.databaseFile==='relay-workbench.sqlite'&&typeof cfg.token==='string'&&cfg.token.length>=32,'Unexpected relay profile; existing data and services were not changed.');
if(options.has('--prepare-only')){console.log(JSON.stringify({profileId:cfg.profileId,folder,config:cfgPath,port,mode:cfg.mode,prepared:true,backendStarted:false,uiStarted:false,originalSessionOperations:0},null,2));process.exit(0);}
if(!options.has('--backend-only'))requireThat(existsSync(exe),'Build runtime/codex-relay-001/TriReviewBridge.UX.Collab.exe before opening the relay workbench.');
const lock=openSync(lockPath,'wx');
try{
 const api=async(path,body)=>{const response=await fetch('http://127.0.0.1:'+port+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+cfg.token,'Content-Type':'application/json',...(body===undefined?{}:{'Idempotency-Key':randomBytes(16).toString('hex')})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(4000)}),value=await response.json();requireThat(response.ok,value.error||'Relay request failed.');return value;};
 const healthy=async()=>{try{const h=await api('/health');return h.ready===true&&h.mode==='CODEX_RELAY'&&h.profileId==='codex-relay-001'&&h.independentRuntime===false&&h.formalReviewAvailable===false;}catch{return false;}};
 const occupied=()=>new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port});socket.setTimeout(1200);socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));socket.once('timeout',()=>{socket.destroy();resolve(true);});});
 if(!await healthy()){
  requireThat(!await occupied(),'Port 48737 is occupied by a different or unhealthy service. No process was stopped or reconfigured.');
  const out=openSync(join(folder,'backend.stdout.log'),'a'),err=openSync(join(folder,'backend.stderr.log'),'a');let backend;
  try{backend=spawn(join(root,'runtime','node.exe'),[join(root,'src','workbench-server.mjs')],{cwd:root,windowsHide:true,detached:true,env:{...process.env,TRB_WORKBENCH_DATA_DIR:folder,TRB_WORKBENCH_MODE:'CODEX_RELAY',TRB_WORKBENCH_PROFILE:'codex-relay-001',TRB_WORKBENCH_EMPTY:'1'},stdio:['ignore',out,err]});}finally{closeSync(out);closeSync(err);}
  let startupError;backend.once('error',error=>{startupError=error;});backend.unref();let ready=false;
  for(let n=0;n<80;n++){await new Promise(r=>setTimeout(r,200));if(startupError)throw startupError;if(backend.exitCode!==null)throw Error('Relay backend exited; inspect isolated logs. No other service was stopped.');if(await healthy()){ready=true;break;}}
  requireThat(ready,'Relay backend did not become ready; existing services were not stopped.');
 }
 let state;
 if(existsSync(statePath)){state=readJson(statePath);requireThat(state.profileId==='codex-relay-001'&&state.sessionId===sessionId,'Relay workspace identity mismatch; no reset attempted.');}
 else{
  let projects=await api('/api/projects');requireThat(projects.length<=1,'Relay bootstrap has multiple projects; inspect without resetting.');
  const project=projects[0]||await api('/api/projects',{name:'虚构试用｜ChatGPT原会话·Codex接力',description:'仅文字接力试用；非独立常驻，不连接Hermes或DSH。'});
  projects=await api('/api/projects');const spaces=projects.find(p=>p.id===project.id).workspaces;requireThat(spaces.length<=1,'Relay bootstrap has multiple workspaces; inspect without resetting.');
  const ws=spaces[0]||await api('/api/projects/'+project.id+'/workspaces',{name:'ChatGPT文字接力',participants:['chatgpt']});
  const view=await api('/api/workspaces/'+ws.id+'?projectId='+encodeURIComponent(project.id)),members=view.participants.filter(p=>p.status!=='inactive');
  requireThat(members.length===1&&members[0].id==='chatgpt','Relay workspace must contain only ChatGPT.');
  if(members[0].kind!=='codex_relay')await api('/api/workspaces/'+ws.id+'/bind-relay',{projectId:project.id,agentId:'chatgpt'});
  await api('/api/workspaces/'+ws.id+'/configure',{projectId:project.id,recipients:['chatgpt'],paused:false});
  state={profileId:'codex-relay-001',projectId:project.id,workspaceId:ws.id,sessionId,createdAt:new Date().toISOString()};writeFileSync(statePath,JSON.stringify(state,null,2),{flag:'wx'});
 }
 const view=await api('/api/workspaces/'+state.workspaceId+'?projectId='+encodeURIComponent(state.projectId)),members=view.participants.filter(p=>p.status!=='inactive');
 requireThat(view.mode==='CODEX_RELAY'&&members.length===1&&members[0].id==='chatgpt'&&members[0].kind==='codex_relay'&&members[0].sessionId===sessionId,'Relay binding identity mismatch; no activation or rebinding attempted.');
 if(!options.has('--backend-only')){const ui=spawn(exe,['--config',cfgPath,'--project-id',state.projectId,'--workspace-id',state.workspaceId],{cwd:root,detached:true,windowsHide:false,stdio:'ignore'});ui.once('error',error=>{console.error(error.message);process.exitCode=1;});ui.unref();}
 console.log(JSON.stringify({profileId:'codex-relay-001',mode:'CODEX_RELAY',port,projectId:state.projectId,workspaceId:state.workspaceId,independentRuntime:false,uiStarted:!options.has('--backend-only'),worker:'on-demand; queue waits while worker is offline',originalSessionOperations:0},null,2));
}finally{closeSync(lock);unlinkSync(lockPath);}
