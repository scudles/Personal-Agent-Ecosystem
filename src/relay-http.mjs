import {readJson} from './http-body.mjs';
import {assert,canonical} from './workbench.mjs';
import {hash} from './core.mjs';
import {RELAY_PROFILE} from './relay-core.mjs';
import {executeRelayIntent} from './relay-intent.mjs';
import {resolve,join,relative} from 'node:path';
import {existsSync,readdirSync,realpathSync,lstatSync} from 'node:fs';

export function validateRelayProfile(root,data,cfg){
 assert(cfg.mode==='CODEX_RELAY'&&cfg.profileId===RELAY_PROFILE,'relay_explicit_profile_required');
 assert(cfg.databaseFile==='relay-workbench.sqlite','relay_dedicated_database_required');
 const standard=resolve(root,'data',RELAY_PROFILE),testRoot=resolve(root,'test-output');
 assert(data===standard||data.startsWith(testRoot+'\\'),'relay_isolated_data_directory_required');
 const actual=realpathSync(data),actualRoot=realpathSync(root),rel=relative(actualRoot,actual);
 assert(rel&&!rel.startsWith('..')&&!resolve(actualRoot,rel).startsWith('\\\\'),'relay_data_junction_escape');
 if(!existsSync(join(data,'codex-relay-profile.json'))){
  const startupFiles=new Set(['workbench-config.json','launcher.lock','backend.stdout.log','backend.stderr.log']);assert(readdirSync(data).every(n=>startupFiles.has(n)&&lstatSync(join(data,n)).isFile()),'relay_fresh_directory_required');
 }
}
export async function relayHttp({req,res,u,path,w,principal,reply,stop}){
 assert(principal.id==='local-owner','owner_permission_required');
 const health={ready:true,version:'1.0.0-preview',mode:'CODEX_RELAY',profileId:RELAY_PROFILE,realAdaptersAuthorized:false,independentRuntime:false,formalReviewAvailable:false,autonomousActionsAvailable:false,worker:w.worker()};
 if(req.method==='GET'){
  if(path==='/health')return reply(res,200,health);
  if(path==='/api/capabilities')return reply(res,200,{...health,adapters:{chatgpt:{mode:'CODEX_RELAY',source:'WORKER_REPORTED_FIRST_PARTY_THREAD_READ',toolActivity:'NOT_OBSERVED',independentRuntime:false}}});
  if(path==='/api/projects')return reply(res,200,w.navigationFor(principal));
  if(path==='/api/relay/peek'||path==='/api/relay/status')return reply(res,200,w.status());
  const m=path.match(/^\/api\/workspaces\/([A-Za-z0-9-]+)$/);
  if(m){const ctx={projectId:u.searchParams.get('projectId'),workspaceId:m[1]},v=w.viewFor(principal,ctx);v.collaborationPlans=[];v.governanceWarnings=[];const c=w.control();v.controlSummary={paused:c.paused===true,rolePaused:{chatgpt:c.rolePaused?.chatgpt===true,hermes:true,deepseek:true}};return reply(res,200,v);}
  return reply(res,404,{error:'relay_route_not_supported'});
 }
 assert(req.method==='POST','relay_method_not_supported');let b;try{b=await readJson(req,path==='/api/relay/receipt'?512000:128000);}catch(error){if(error.message==='payload_too_large'){res.shouldKeepAlive=false;req.resume();}throw error;}
 if(path==='/api/service/stop')return stop(res);
 if(path.startsWith('/api/relay/')){
  const op=path.slice('/api/relay/'.length),methods={heartbeat:'heartbeat',begin:'begin',submitted:'submitted',receipt:'receipt',unknown:'unknown',pause:'pause',cancel:'cancelJob'};
  assert(methods[op],'relay_route_not_supported');return reply(res,200,w[methods[op]](b));
 }
 const key=req.headers['idempotency-key']||b.requestId;
 if(key!==undefined)assert(typeof key==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(key),'invalid_idempotency_key');
 const requestHash=hash(canonical({path,body:b}));
 const mutate=()=>{
  if(path==='/api/projects')return w.project(b.name,b.description);
  const pm=path.match(/^\/api\/projects\/([A-Za-z0-9-]+)\/(rename|archive|workspaces|settings)$/);
  if(pm){if(pm[2]==='workspaces')return w.workspace(pm[1],b.name,b.participants);if(pm[2]==='rename')w.renameProject(pm[1],b.name);if(pm[2]==='archive')w.archiveProject(pm[1]);if(pm[2]==='settings')w.projectSettings(pm[1],b.description);return {updated:true};}
  const m=path.match(/^\/api\/workspaces\/([A-Za-z0-9-]+)\/([a-z-]+)$/);assert(m,'relay_route_not_supported');const ctx={projectId:b.projectId,workspaceId:m[1]};w.scope(ctx,true);
  switch(m[2]){
   case 'bind-relay':return w.bindRelay(ctx,b.agentId||'chatgpt');
   case 'configure':return w.configure(ctx,b);
   case 'pause-binding':return w.pauseBinding(ctx,b.agentId,b.paused)||{updated:true};
   case 'chat':assert(key,'relay_request_id_required');return w.chat(ctx,{text:b.text,targets:b.recipients,replyTo:b.replyTo,knowledgeRefs:b.knowledgeRefs});
   case 'reply':assert(key,'relay_request_id_required');return w.reply(ctx,b.messageId,{text:b.text,targets:b.recipients,knowledgeRefs:b.knowledgeRefs});
   case 'tasks':assert(key,'relay_request_id_required');return w.textTask(ctx,{sourceMessageId:b.sourceMessageId,title:b.title,body:b.body,executor:b.executor,deadline:b.deadline,limits:b.limits,knowledgeRefs:b.knowledgeRefs});
   case 'intent':assert(key,'relay_request_id_required');return executeRelayIntent(w,principal,ctx,b);
   case 'cancel':return w.cancel(ctx,b.itemId);
   default:throw Error('relay_route_not_supported_or_locked');
  }
 };
 const result=w.transaction(()=>{
  if(key){const old=w.db.prepare('SELECT * FROM api_idempotency WHERE principal_id=? AND request_key=?').get(principal.id,key);if(old){assert(old.request_hash===requestHash,'idempotency_key_reused_with_different_request');return JSON.parse(old.response);}}
  const out=mutate();if(key)w.db.prepare('INSERT INTO api_idempotency VALUES(?,?,?,?,?)').run(principal.id,key,requestHash,JSON.stringify(out),new Date().toISOString());return out;
 });return reply(res,200,result);
}

