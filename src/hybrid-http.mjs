import {readJson} from './http-body.mjs';
import {assert,canonical,ROLES} from './workbench.mjs';
import {hash} from './core.mjs';
import {HYBRID_PROFILE} from './hybrid-core.mjs';
import {executeHybridIntent} from './hybrid-intent.mjs';
import {resolve} from 'node:path';
export function validateHybridProfile(root,data,cfg){
 assert(cfg.mode==='HYBRID_NATIVE'&&cfg.profileId===HYBRID_PROFILE&&cfg.databaseFile==='hybrid-workbench.sqlite','hybrid_explicit_profile_required');
 assert(data===resolve(root,'data',HYBRID_PROFILE)||data.startsWith(resolve(root,'test-output')+'\\'),'hybrid_isolated_data_directory_required');
 assert(cfg.hybridWorkerTokens&&ROLES.every(r=>typeof cfg.hybridWorkerTokens[r]==='string'&&cfg.hybridWorkerTokens[r].length>=32)&&new Set([cfg.token,...Object.values(cfg.hybridWorkerTokens)]).size===4,'hybrid_distinct_worker_tokens_required');
}
export async function hybridHttp({req,res,u,path,w,principal,reply,stop}){
 const owner=()=>assert(principal.id==='local-owner','owner_permission_required'),isWorker=principal.kind==='worker';
 const enforceRole=r=>{assert(ROLES.includes(r),'hybrid_role_required');if(isWorker)assert(principal.role===r,'hybrid_worker_role_permission_denied');return r;};
 const workers=()=>Object.fromEntries(ROLES.map(r=>[r,w.worker(r)])),health={ready:true,candidateId:'hybrid-desktop-relay-002',desktopRelayProtocol:'TRB_DSH_DESKTOP_RELAY_002',mode:'HYBRID_NATIVE',profileId:HYBRID_PROFILE,independentRuntime:false,formalReviewAvailable:false,autonomousActionsAvailable:false,attachmentsAvailable:false,realAdaptersAuthorized:false};
 if(req.method==='GET'){
  if(path==='/api/hybrid/peek'||path==='/api/hybrid/status'){const r=enforceRole(u.searchParams.get('role'));return reply(res,200,w.status(r));}
  owner();if(path==='/health'||path==='/api/capabilities')return reply(res,200,{...health,workers:workers()});
  if(path==='/api/projects')return reply(res,200,w.navigationFor(principal));
  const page=path.match(/^\/api\/workspaces\/([A-Za-z0-9-]+)\/messages$/);if(page){const ctx={projectId:u.searchParams.get('projectId'),workspaceId:page[1]};w.scope(ctx);w.access(principal,ctx,'read');return reply(res,200,w.messagePage(ctx,{before:u.searchParams.get('before')||undefined,limit:u.searchParams.has('limit')?Number(u.searchParams.get('limit')):undefined}));}const m=path.match(/^\/api\/workspaces\/([A-Za-z0-9-]+)$/);if(m){const ctx={projectId:u.searchParams.get('projectId'),workspaceId:m[1]},v=w.viewFor(principal,ctx),c=w.control();v.collaborationPlans=[];v.governanceWarnings=[];v.controlSummary={paused:c.paused,rolePaused:Object.fromEntries(ROLES.map(r=>[r,w.roleState(r).paused||!!c.rolePaused?.[r]]))};return reply(res,200,v);}
  return reply(res,404,{error:'hybrid_route_not_supported'});
 }
 assert(req.method==='POST','hybrid_method_not_supported');let b;try{b=await readJson(req,path==='/api/hybrid/receipt'?512000:128000);}catch(e){if(e.message==='payload_too_large'){res.shouldKeepAlive=false;req.resume();}throw e;}
 if(path==='/api/service/stop'){owner();return stop(res);}
 if(path.startsWith('/api/hybrid/')){
  enforceRole(b.role);const op=path.slice('/api/hybrid/'.length);
  if(op==='role-control')return reply(res,200,w.roleControl(b,principal));
  const methods={peek:'status',status:'status',begin:'begin',submitted:'submitted',receipt:'receipt',unknown:'unknown',heartbeat:'heartbeat'};
  assert(methods[op],'hybrid_route_not_supported');assert(isWorker,'hybrid_worker_principal_required');
  return reply(res,200,['peek','status'].includes(op)?w.status(b.role):w[methods[op]](b));
 }
 owner();const key=req.headers['idempotency-key']||b.requestId;
 if(key!==undefined)assert(typeof key==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(key),'invalid_idempotency_key');
 const reqHash=hash(canonical({path,body:b}));
 const mutate=()=>{
  if(path==='/api/projects')return w.project(b.name,b.description);
  const p=path.match(/^\/api\/projects\/([A-Za-z0-9-]+)\/(workspaces|rename|archive|settings)$/);
  if(p){if(p[2]==='workspaces')return w.workspace(p[1],b.name,b.participants);if(p[2]==='rename')w.renameProject(p[1],b.name);if(p[2]==='archive')w.archiveProject(p[1]);if(p[2]==='settings')w.projectSettings(p[1],b.description);return {updated:true};}
  const m=path.match(/^\/api\/workspaces\/([A-Za-z0-9-]+)\/([a-z-]+)$/);assert(m,'hybrid_route_not_supported');const ctx={projectId:b.projectId,workspaceId:m[1]};w.scope(ctx,true);
  assert(!b.attachments?.length&&!b.knowledgeRefs?.length&&!b.parentCaseId,'hybrid_attachments_knowledge_autonomous_locked');
  switch(m[2]){
   case 'bind-hybrid':return w.bindHybrid(ctx,b.role||b.agentId);
   case 'configure':return w.configure(ctx,b);
   case 'pause-binding':return w.pauseBinding(ctx,b.role||b.agentId,b.paused)||{updated:true};
   case 'chat':assert(key,'hybrid_request_id_required');return w.chat(ctx,{text:b.text,targets:b.recipients,replyTo:b.replyTo});
   case 'reply':assert(key,'hybrid_request_id_required');return w.reply(ctx,b.messageId,{text:b.text,targets:b.recipients});
   case 'tasks':assert(key,'hybrid_request_id_required');return w.textTask(ctx,{sourceMessageId:b.sourceMessageId,title:b.title,body:b.body,executor:b.executor,deadline:b.deadline,limits:b.limits});
   case 'task-accept':return w.acceptTextTask(ctx,b.itemId,b,principal);
   case 'intent':assert(key,'hybrid_request_id_required');return executeHybridIntent(w,principal,ctx,b);
   case 'cancel':return w.cancel(ctx,b.itemId);
   default:throw Error('hybrid_route_not_supported_or_locked');
  }
 };
 const result=w.transaction(()=>{if(key){const old=w.db.prepare('SELECT * FROM api_idempotency WHERE principal_id=? AND request_key=?').get(principal.id,key);if(old){assert(old.request_hash===reqHash,'idempotency_key_reused_with_different_request');return JSON.parse(old.response);}}const result=mutate();if(key)w.db.prepare('INSERT INTO api_idempotency VALUES(?,?,?,?,?)').run(principal.id,key,reqHash,JSON.stringify(result),new Date().toISOString());return result;});return reply(res,200,result);
}

