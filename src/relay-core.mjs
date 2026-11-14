import {CollaborationCore} from './collaboration-core.mjs';
import {assert,canonical} from './workbench.mjs';
import {PINNED} from './workflow.mjs';
import {hash} from './core.mjs';
import {randomBytes,randomUUID} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,basename,resolve,join} from 'node:path';

export const RELAY_PROFILE='codex-relay-001';
export const RELAY_SOURCE='WORKER_REPORTED_FIRST_PARTY_THREAD_READ';
const now=()=>new Date().toISOString();
const states={QUEUED:'queued',DISPATCHING:'sending',SUBMITTED:'submitted',UNKNOWN:'unknown',COMPLETED:'received',CANCELLED:'cancelled',EXPIRED:'expired'};
const inflight=new Set(['DISPATCHING','SUBMITTED','UNKNOWN']);
const locked=()=>{throw Error('relay_formal_review_and_autonomous_actions_locked');};
const opaque=(v,name)=>assert(typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=256,'invalid_'+name);

// The marker is required before any existing database is opened. This constructor
// never opens the baseline, legacy queues, or a pre-existing unmarked database.
function prepare(file){
 assert(file!==':memory:'&&basename(file)==='relay-workbench.sqlite','relay_dedicated_database_required');
 const marker=join(dirname(file),'codex-relay-profile.json');
 if(existsSync(file))assert(existsSync(marker),'relay_existing_unmarked_database_refused');
 mkdirSync(dirname(file),{recursive:true});
 if(existsSync(marker)){const m=JSON.parse(readFileSync(marker,'utf8'));assert(m.mode==='CODEX_RELAY'&&m.profileId===RELAY_PROFILE&&m.databasePath===resolve(file),'relay_profile_marker_mismatch');}
 else writeFileSync(marker,JSON.stringify({mode:'CODEX_RELAY',profileId:RELAY_PROFILE,databasePath:resolve(file),createdAt:now()},null,2),{flag:'wx'});
 return file;
}
export class RelayCore extends CollaborationCore {
 constructor(file){
  super(prepare(file));this.mode='CODEX_RELAY';
  this.transaction(()=>{
   this.db.exec(`
CREATE TABLE IF NOT EXISTS relay_profile(singleton INTEGER PRIMARY KEY CHECK(singleton=1),profile_id TEXT NOT NULL,mode TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS relay_binding(singleton INTEGER PRIMARY KEY CHECK(singleton=1),id TEXT NOT NULL UNIQUE,project_id TEXT NOT NULL,workspace_id TEXT NOT NULL,thread_id TEXT NOT NULL UNIQUE,paused INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(workspace_id,project_id) REFERENCES workspaces(id,project_id));
CREATE TABLE IF NOT EXISTS relay_jobs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,workspace_id TEXT NOT NULL,state TEXT NOT NULL,json TEXT NOT NULL,FOREIGN KEY(workspace_id,project_id) REFERENCES workspaces(id,project_id));
CREATE TABLE IF NOT EXISTS relay_receipts(job_id TEXT PRIMARY KEY,receipt_hash TEXT NOT NULL,json TEXT NOT NULL,FOREIGN KEY(job_id) REFERENCES relay_jobs(id));
CREATE TABLE IF NOT EXISTS relay_native_ids(kind TEXT NOT NULL,native_id TEXT NOT NULL UNIQUE,job_id TEXT NOT NULL,PRIMARY KEY(kind,native_id),FOREIGN KEY(job_id) REFERENCES relay_jobs(id));
CREATE TRIGGER IF NOT EXISTS relay_receipt_immutable_update BEFORE UPDATE ON relay_receipts BEGIN SELECT RAISE(ABORT,'immutable_relay_receipt');END;
CREATE TRIGGER IF NOT EXISTS relay_receipt_immutable_delete BEFORE DELETE ON relay_receipts BEGIN SELECT RAISE(ABORT,'immutable_relay_receipt');END;
`);
   const old=this.db.prepare('SELECT * FROM relay_profile').get();
   assert(!old||old.profile_id===RELAY_PROFILE&&old.mode==='CODEX_RELAY','relay_profile_database_mismatch');
   if(!old){
    assert(this.list('case').length===0&&this.list('delivery').length===0&&this.navigation().length===0,'relay_nonempty_database_refused');
    this.db.prepare('INSERT INTO relay_profile VALUES(1,?,?)').run(RELAY_PROFILE,'CODEX_RELAY');
   }
  });
 }
 workspace(pid,name,participants=['chatgpt']){assert(Array.isArray(participants)&&participants.length===1&&participants[0]==='chatgpt','relay_only_chatgpt_supported');return super.workspace(pid,name,participants);}
 configure(ctx,patch){
  assert(patch.discussion!==true,'relay_autonomous_discussion_locked');
  if(patch.participants!==undefined)assert(patch.participants.length===1&&patch.participants[0]==='chatgpt','relay_only_chatgpt_supported');
  return super.configure(ctx,patch);
 }
 bindRelay(ctx,role='chatgpt'){
  assert(role==='chatgpt','relay_only_chatgpt_supported');return this.within(ctx,()=>{
   assert(this.participants(ctx).some(p=>p.id==='chatgpt'&&p.enabled),'agent_not_participant');
   const old=this.db.prepare('SELECT * FROM relay_binding').get();
   if(old){assert(old.project_id===ctx.projectId&&old.workspace_id===ctx.workspaceId,'relay_original_thread_already_bound');return this.binding(ctx,'chatgpt');}
   const id=randomUUID();this.db.prepare('INSERT INTO relay_binding VALUES(1,?,?,?,?,0)').run(id,ctx.projectId,ctx.workspaceId,PINNED.chatgpt.id);
   this.log('relay.binding.created',{...ctx,id,threadId:PINNED.chatgpt.id,profileId:RELAY_PROFILE});return this.binding(ctx,'chatgpt');
  });
 }
 binding(ctx,role){
  this.scope(ctx);if(role!=='chatgpt')return null;
  if(!this.db.prepare("SELECT 1 FROM sqlite_schema WHERE name='relay_binding'").get())return null;
  const b=this.db.prepare('SELECT * FROM relay_binding WHERE project_id=? AND workspace_id=?').get(ctx.projectId,ctx.workspaceId);
  return b?{...b,kind:'codex_relay',title:PINNED.chatgpt.title,sessionId:b.thread_id,native_session_id:b.thread_id,agent_id:'chatgpt'}:null;
 }
 participants(ctx){return super.participants(ctx).map(p=>{const b=this.binding(ctx,p.id);return b?{...p,bindingId:b.id,kind:b.kind,title:b.title,sessionId:b.sessionId,paused:b.paused,status:!p.enabled?'inactive':b.paused?'paused':'relay_ready'}:p;});}
 pauseBinding(ctx,role,paused){assert(typeof paused==='boolean','explicit_pause_required');const b=this.binding(ctx,role);assert(b,'binding_not_found');if(!paused)this.collaborationGovernance.integrity(ctx);this.db.prepare('UPDATE relay_binding SET paused=? WHERE id=?').run(+paused,b.id);this.log('relay.binding.paused',{...ctx,role,paused});}
 targets(ctx,list){
  assert(Array.isArray(list)&&list.length===1&&list[0]==='chatgpt','relay_explicit_chatgpt_recipient_required');
  const b=this.binding(ctx,'chatgpt');assert(b&&!b.paused&&this.participants(ctx).some(p=>p.id==='chatgpt'&&p.enabled),'recipient_unbound_paused_or_real_locked');return ['chatgpt'];
 }
 createChat(input,author='user'){assert(author==='user','relay_autonomous_actions_locked');assert(!input.parentCaseId,'relay_autonomous_parent_locked');const i=super.createChat(input,author);this.seal(i);return i;}
 textTask(ctx,input){assert(!input.parentCaseId,'relay_autonomous_parent_locked');return this.transaction(()=>{const i=super.textTask(ctx,input);this.seal(i);return i;});}
 // Jobs use ordinary CollaborationCore item/message models, but the main
 // receive/ingest proof contracts are never weakened or called by this mode.
 _enqueue(i,role,kind){
  assert(role==='chatgpt'&&['chat','text_task'].includes(kind),'relay_delivery_kind_locked');
  this.targets(i,[role]);const id=hash(i.id+':'+i.revision+':'+role+':'+kind),existing=this.get('delivery',id);if(existing)return existing;
  const b=this.binding(i,role),job={id,caseId:i.id,projectId:i.projectId,workspaceId:i.workspaceId,bindingId:b.id,threadId:PINNED.chatgpt.id,threadTitle:PINNED.chatgpt.title,kind,state:'QUEUED',createdAt:now(),deadline:i.deadline,attempts:0,cancelRequested:false};
  this.db.prepare('INSERT INTO relay_jobs VALUES(?,?,?,?,?)').run(id,i.projectId,i.workspaceId,job.state,JSON.stringify(job));
  const d={id,caseId:i.id,revision:i.revision,artifactHash:i.artifactHash,role,sessionId:job.threadId,bindingId:b.id,kind,nonce:randomBytes(16).toString('hex'),state:'queued',relayState:'QUEUED',simulation:false,createdAt:job.createdAt,attempts:0};
  this.put('delivery',id,d);this.log('relay.queued',{id,caseId:i.id,...this.owner('case',i.id)});return d;
 }
 seal(item){
  for(const job of this.jobs().filter(j=>j.caseId===item.id)){
   const d=this.get('delivery',job.id);const requestText=super.render(d);
   assert(job.state==='QUEUED'&&!job.requestText,'relay_request_already_frozen');job.requestText=requestText;job.requestSha256=hash(requestText);job.userText=item.body;job.userTextSha256=hash(item.body);this.saveJob(job);
   d.prompt=requestText;d.promptHash=job.requestSha256;this.put('delivery',d.id,d);
  }
 }
 jobs(){return this.db.prepare('SELECT json FROM relay_jobs ORDER BY rowid').all().map(r=>JSON.parse(r.json));}
 job(id){const r=this.db.prepare('SELECT json FROM relay_jobs WHERE id=?').get(id);assert(r,'relay_job_not_found');return JSON.parse(r.json);}
 saveJob(j){
  this.db.prepare('UPDATE relay_jobs SET state=?,json=? WHERE id=?').run(j.state,JSON.stringify(j),j.id);
  const d=this.get('delivery',j.id);if(d){Object.assign(d,{state:states[j.state],relayState:j.state,attempts:j.attempts,cancelRequested:j.cancelRequested,reason:j.reason||'',sentAt:j.dispatchingAt||null,sourceUserId:j.nativeUserMessageId||null});this.put('delivery',d.id,d);}
  return j;
 }
 admissionReason(d){
  if(d.relayState==='UNKNOWN')return '结果不确定，仅回收确切原回合；禁止自动重发';
  if(d.relayState==='SUBMITTED')return '工具已接受，尚未确切确认原回合完成';
  if(d.relayState==='DISPATCHING')return '发送动作已登记，等待工具结果；禁止重复发送';
  if(d.relayState!=='QUEUED')return '';
  const j=this.job(d.id),control=this.control(),s=this.scope(j),b=this.binding(j,'chatgpt'),item=this.get('case',j.caseId);
  if(j.cancelRequested||item.cancelled)return '用户已取消，不发送';if(control.paused||control.rolePaused?.chatgpt)return '接力暂停';
  if(s.paused||s.archived||s.project_archived||!b||b.paused)return '空间或接入暂停';
  if(!this.participants(j).some(p=>p.id==='chatgpt'&&p.enabled))return '接收方已退出';
  if(Date.parse(j.deadline)<=Date.now())return '事项已超时';
  if(this.rateCount()>=control.maxPerHour)return '每小时投递额度已到';
  return '';
 }
 countsTowardRate(d){return d.simulation===false&&!!d.relayState;}
 worker(){const v=this.get('relay_worker','codex');return v&&Date.now()-Date.parse(v.lastSeenAt)<120000?{...v,status:'REPORTED_ACTIVE',independentRuntime:false}:{status:'UNKNOWN',lastSeenAt:v?.lastSeenAt||null,independentRuntime:false};}
 touchWorker(workerId){if(workerId!==undefined){opaque(workerId,'worker_id');this.put('relay_worker','codex',{workerId,lastSeenAt:now()});}}
 expire(){
  for(const j of this.jobs())if(Date.parse(j.deadline)<=Date.now()){
   if(j.state==='QUEUED'){j.state='EXPIRED';j.reason='deadline_expired_before_dispatch';this.saveJob(j);this.log('relay.expired',{jobId:j.id,reason:j.reason});}
   else if(['DISPATCHING','SUBMITTED'].includes(j.state)){j.state='UNKNOWN';j.reason='deadline_expired_no_retry';this.saveJob(j);this.log('relay.unknown',{jobId:j.id,reason:j.reason});}
  }
 }
 dispatchContinuationAllowed(j){
  try{
   if(j.state!=='DISPATCHING'||j.cancelRequested||!j.attemptToken)return false;
   const control=this.control(),scope=this.scope(j),binding=this.binding(j,'chatgpt'),item=this.get('case',j.caseId),delivery=this.get('delivery',j.id);
   if(control.paused||control.rolePaused?.chatgpt||scope.paused||scope.archived||scope.project_archived)return false;
   if(!binding||binding.paused||binding.id!==j.bindingId||binding.sessionId!==j.threadId||j.threadId!==PINNED.chatgpt.id)return false;
   if(!this.participants(j).some(p=>p.id==='chatgpt'&&p.enabled))return false;
   if(!item||item.cancelled||item.suspended||item.legacy||!['text_only_chat','text_only_task'].includes(item.scope))return false;
   if(!delivery||delivery.state!=='sending'||delivery.relayState!=='DISPATCHING'||delivery.bindingId!==j.bindingId||delivery.sessionId!==j.threadId||delivery.revision!==item.revision)return false;
   if(Date.parse(j.deadline)<=Date.now()||Date.parse(item.deadline)<=Date.now())return false;
   if(hash(item.body)!==j.userTextSha256||item.body!==j.userText||hash(j.requestText)!==j.requestSha256||delivery.prompt!==j.requestText||delivery.promptHash!==j.requestSha256||delivery.artifactHash!==item.artifactHash)return false;
   const root=this.get('case',item.rootId),budget=this.db.prepare('SELECT * FROM item_budgets WHERE root_id=?').get(item.rootId);
   if(!root||root.cancelled||root.suspended||Date.parse(root.deadline)<=Date.now()||!budget||budget.attempts>root.limits.maxDeliveries||budget.transitions>=root.limits.maxTransitions||this.rateCount()>control.maxPerHour)return false;
   this.collaborationGovernance.dispatch(j,item,j.kind);
   return true;
  }catch{return false;}
 }
 heartbeat(b){opaque(b.workerId,'worker_id');this.touchWorker(b.workerId);return this.worker();}
 status(){return this.transaction(()=>{
  this.expire();const jobs=this.jobs(),active=jobs.filter(j=>inflight.has(j.state)),queued=jobs.filter(j=>j.state==='QUEUED');
  const next=active[0]||queued[0]||null;
  return {mode:'CODEX_RELAY',profileId:RELAY_PROFILE,threadId:PINNED.chatgpt.id,threadTitle:PINNED.chatgpt.title,worker:this.worker(),paused:this.control().paused,inflight:active,next:next?{...next,maySend:false,dispatchContinuationAllowed:this.dispatchContinuationAllowed(next),blockReason:this.admissionReason(this.get('delivery',next.id))}:null,queued:queued.length,counts:Object.fromEntries(Object.keys(states).map(s=>[s,jobs.filter(j=>j.state===s).length])),formalReviewAvailable:false,autonomousActionsAvailable:false,independentRuntime:false};
 });}
 begin({jobId,workerId}){
  opaque(workerId,'worker_id');return this.transaction(()=>{
   this.touchWorker(workerId);this.expire();assert(!this.jobs().some(j=>inflight.has(j.state)),'relay_inflight_requires_reconciliation');
   const j=this.job(jobId),first=this.jobs().find(x=>x.state==='QUEUED');assert(j.state==='QUEUED'&&first?.id===j.id,'relay_job_not_next_queued');
   this.collaborationGovernance.integrity(j);assert(!this.admissionReason(this.get('delivery',j.id)),'relay_paused_expired_or_cancelled');
   assert(j.requestText&&hash(j.requestText)===j.requestSha256,'relay_frozen_request_mismatch');
   j.state='DISPATCHING';j.workerId=workerId;j.attemptToken=randomBytes(24).toString('hex');j.attempts=1;j.dispatchingAt=now();this.saveJob(j);
   this.db.prepare('UPDATE item_budgets SET attempts=attempts+1 WHERE root_id=?').run(this.get('case',j.caseId).rootId);
   this.log('relay.dispatching',{jobId:j.id,workerId,threadId:j.threadId,requestSha256:j.requestSha256});
   return {...j,maySend:true};
  });
 }
 attempt(b){const j=this.job(b.jobId);assert(typeof b.attemptToken==='string'&&j.attemptToken===b.attemptToken,'relay_attempt_mismatch');return j;}
 submitted(b){return this.transaction(()=>{
  this.expire();const j=this.attempt(b);assert(b.accepted===true,'relay_accepted_required');if(b.nativeTurnId!==undefined)opaque(b.nativeTurnId,'native_turn_id');
  if(j.submittedAt){assert((j.acceptedNativeTurnId||null)===(b.nativeTurnId||null),'relay_submitted_conflict');return j;}
  assert(['DISPATCHING','UNKNOWN'].includes(j.state),'relay_not_dispatching');const late=j.state==='UNKNOWN';if(!late)j.state='SUBMITTED';j.submittedAt=now();j.acceptedNativeTurnId=b.nativeTurnId||null;this.saveJob(j);this.log(late?'relay.late_accepted_no_resend':'relay.submitted_accepted_only',{jobId:j.id,nativeTurnId:j.acceptedNativeTurnId,state:j.state,cancelRequested:j.cancelRequested});return j;
 });}
 unknown(b){return this.transaction(()=>{const j=this.attempt(b);assert(inflight.has(j.state),'relay_job_not_inflight');assert(typeof b.reason==='string'&&b.reason.trim()&&b.reason.length<=1000,'relay_unknown_reason_required');if(j.state!=='UNKNOWN'){j.state='UNKNOWN';j.reason=b.reason;this.saveJob(j);this.log('relay.unknown',{jobId:j.id,reason:b.reason});}return j;});}
 pause(b){return this.transaction(()=>{assert(typeof b.paused==='boolean','explicit_pause_required');this.control({paused:b.paused,reason:b.reason||'relay_owner_pause'});return {paused:b.paused};});}
 cancel(ctx,id){return this.transaction(()=>{
  this.scope(ctx);const item=this.owned(ctx,'case',id);item.cancelled=true;item.state='cancelled';this.put('case',item.id,item);
  for(const j of this.jobs().filter(j=>j.caseId===id)){if(j.state==='COMPLETED')continue;j.cancelRequested=true;if(j.state==='QUEUED')j.state='CANCELLED';else if(inflight.has(j.state))j.state='UNKNOWN';j.reason='user_cancelled_no_resend';this.saveJob(j);this.log('relay.cancelled',{jobId:j.id,state:j.state});}return item;
 });}
 cancelJob(b){const j=this.job(b.jobId);return this.cancel(j,j.caseId);}
 receipt(b){return this.transaction(()=>{
  const j=this.attempt(b);assert(b.threadId===j.threadId&&b.completed===true,'relay_completed_original_thread_required');
  for(const [name,val] of Object.entries({nativeTurnId:b.nativeTurnId,nativeUserMessageId:b.nativeUserMessageId}))opaque(val,name);
  assert(b.requestText===j.requestText&&b.requestSha256===j.requestSha256&&hash(b.requestText)===b.requestSha256,'relay_request_text_or_hash_mismatch');
  assert(typeof b.replyText==='string'&&b.replyText.trim()&&b.replyText.length<=30000&&hash(b.replyText)===b.replySha256,'relay_reply_text_or_hash_mismatch');
  assert(Array.isArray(b.replyIds)&&b.replyIds.length>0&&new Set(b.replyIds).size===b.replyIds.length,'relay_reply_ids_required');b.replyIds.forEach(id=>opaque(id,'reply_id'));
  const turn=b.nativeTurn;assert(turn&&turn.id===b.nativeTurnId&&turn.threadId===j.threadId&&turn.status==='completed','relay_exact_native_turn_required');
  const user=turn.user;assert(user&&user.id===b.nativeUserMessageId&&user.turnId===turn.id&&user.threadId===j.threadId&&user.text===j.requestText,'relay_exact_native_user_turn_required');
  assert(Array.isArray(turn.replies)&&turn.replies.length===b.replyIds.length&&turn.replies.every((r,n)=>r.id===b.replyIds[n]&&r.threadId===j.threadId&&r.turnId===turn.id&&typeof r.text==='string')&&turn.replies.map(r=>r.text).join('\n\n')===b.replyText,'relay_exact_native_reply_turn_required');
  assert(!j.acceptedNativeTurnId||j.acceptedNativeTurnId===b.nativeTurnId,'relay_accepted_turn_mismatch');
  const clean={jobId:j.id,threadId:b.threadId,nativeTurnId:b.nativeTurnId,nativeUserMessageId:b.nativeUserMessageId,requestText:b.requestText,requestSha256:b.requestSha256,replyIds:b.replyIds,replyText:b.replyText,replySha256:b.replySha256,completed:true,nativeTurn:turn};
  const receiptHash=hash(canonical(clean)),old=this.db.prepare('SELECT * FROM relay_receipts WHERE job_id=?').get(j.id);
  if(old){assert(old.receipt_hash===receiptHash,'relay_receipt_conflict');return {...this.job(j.id),receiptHash,idempotent:true};}
  assert(inflight.has(j.state),'relay_receipt_without_dispatch');
  const identities=b.nativeTurnId===b.nativeUserMessageId?[['turn+user',b.nativeTurnId]]:[['turn',b.nativeTurnId],['user',b.nativeUserMessageId]];const ids=[...identities,...b.replyIds.map(id=>['reply',id])];
  assert(new Set(ids.map(x=>x[1])).size===ids.length,'relay_native_ids_must_be_distinct');
  for(const [kind,id] of ids){const used=this.db.prepare('SELECT job_id FROM relay_native_ids WHERE native_id=?').get(id);assert(!used,'relay_native_id_already_used');this.db.prepare('INSERT INTO relay_native_ids VALUES(?,?,?)').run(kind,id,j.id);}
  const late=j.cancelRequested||Date.parse(j.deadline)<=Date.now(),source={type:RELAY_SOURCE,source:RELAY_SOURCE,simulation:false,toolActivity:'NOT_OBSERVED',fullToolTraceVerified:false,independentAuthentication:false,threadId:j.threadId,nativeTurnId:b.nativeTurnId,nativeUserMessageId:b.nativeUserMessageId,replyIds:b.replyIds,requestSha256:j.requestSha256,replySha256:b.replySha256,receiptHash};
  this.db.prepare('INSERT INTO relay_receipts VALUES(?,?,?)').run(j.id,receiptHash,JSON.stringify({...clean,source,late,ignored:late,at:now()}));
  j.state=j.cancelRequested?'CANCELLED':late?'EXPIRED':'COMPLETED';Object.assign(j,{nativeTurnId:b.nativeTurnId,nativeUserMessageId:b.nativeUserMessageId,replyIds:b.replyIds,replySha256:b.replySha256,receiptHash,completedAt:now(),late,ignored:late});this.saveJob(j);const delivery=this.get('delivery',j.id);delivery.proof=source;delivery.receivedAt=j.completedAt;this.put('delivery',j.id,delivery);
  if(!late){
   const item=this.get('case',j.caseId);if(j.kind==='chat'){item.chatResponses={chatgpt:{text:b.replyText,source}};item.state='chat_replied';}else{item.taskResult={text:b.replyText,raw:b.replyText,source,receivedAt:now()};item.state='awaiting_user_acceptance';}item.updatedAt=now();this.put('case',item.id,item);
   this.addMessage(j,{id:'answer:'+j.id,author:'chatgpt',recipients:['user'],body:b.replyText,kind:j.kind==='chat'?'chat':'task_result',caseId:j.caseId,replyTo:'request:'+j.caseId,source});
  }
  this.log(late?'relay.late_receipt_ignored':'relay.receipt.completed',{jobId:j.id,...source,ignored:late});return {...j,source};
 });}
 recover(){return this.transaction(()=>{for(const j of this.jobs())if(j.state==='DISPATCHING'){j.state='UNKNOWN';j.reason='restart_no_resend';this.saveJob(j);this.log('relay.restart_unknown',{jobId:j.id});}});}
 view(ctx){const v=super.view(ctx);return {...v,mode:'CODEX_RELAY',profileId:RELAY_PROFILE,worker:this.worker(),independentRuntime:false,formalReviewAvailable:false,autonomousActionsAvailable:false,realAdaptersAuthorized:false,relayJobs:this.jobs().filter(j=>j.projectId===ctx.projectId&&j.workspaceId===ctx.workspaceId).map(({attemptToken,...j})=>j),participants:v.participants.map(p=>({...p,verificationLevel:p.kind==='codex_relay'?'worker_relay_binding_only':p.verificationLevel,connectionStatus:p.status}))};}
 canSend(){return false;}
 bindSimulation(){return locked();} issueSimulationToken(){return locked();}
 create(){return locked();} createReview(){return locked();} revise(){return locked();} reviseReview(){return locked();} authorize(){return locked();} beginCross(){return locked();} recordReview(){return locked();}
 agentDirected(){return locked();} ingest(){return locked();} receive(){return locked();} observe(){return locked();} forward(){return locked();}
}





