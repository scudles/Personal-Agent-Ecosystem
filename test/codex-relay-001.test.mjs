import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {RelayCore,RELAY_SOURCE} from '../src/relay-core.mjs';
import {CollaborationCore} from '../src/collaboration-core.mjs';
import {hash} from '../src/core.mjs';

const base=()=>{mkdirSync('test-output',{recursive:true});return mkdtempSync(resolve('test-output/codex-relay-unit-'));};
function fixture(){const dir=base(),file=join(dir,'relay-workbench.sqlite'),w=new RelayCore(file);w.control({paused:false});const p=w.project('虚构接力项目'),ws=w.workspace(p.id,'虚构窗口'),ctx={projectId:p.id,workspaceId:ws.id};w.bindRelay(ctx);w.configure(ctx,{paused:false,recipients:['chatgpt']});return {w,file,ctx};}
const chat=f=>f.w.chat(f.ctx,{text:'虚构普通消息',targets:['chatgpt']});
function startJob(f){const i=chat(f),j=f.w.status().next;assert.equal(j.caseId,i.id);return f.w.begin({jobId:j.id,workerId:'fiction-worker'});}
function receipt(j,suffix='a'){const turnId='fiction-turn-'+suffix,userId=turnId,replyId='fiction-reply-'+suffix,text='虚构回复完整正文\n第二行';return {jobId:j.id,attemptToken:j.attemptToken,threadId:j.threadId,nativeTurnId:turnId,nativeUserMessageId:userId,requestText:j.requestText,requestSha256:j.requestSha256,replyIds:[replyId],replyText:text,replySha256:hash(text),completed:true,nativeTurn:{id:turnId,threadId:j.threadId,status:'completed',user:{id:userId,threadId:j.threadId,turnId,text:j.requestText},replies:[{id:replyId,threadId:j.threadId,turnId,text}]}};}

test('relay ordinary chat and pure text task recycle exact native turn without weakening source proofs',()=>{
 const f=fixture();try{
  const j=startJob(f);assert.equal(j.state,'DISPATCHING');assert.equal(j.maySend,true);assert.equal(f.w.worker().status,'REPORTED_ACTIVE');
  const sent=f.w.submitted({jobId:j.id,attemptToken:j.attemptToken,accepted:true,nativeTurnId:'fiction-turn-a'});assert.equal(sent.state,'SUBMITTED');
  assert.equal(f.w.status().next.state,'SUBMITTED');assert.equal(f.w.view(f.ctx).messages.length,1);
  const r=receipt(j);assert.equal(f.w.receipt(r).state,'COMPLETED');assert.equal(f.w.receipt(r).idempotent,true);
  const v=f.w.view(f.ctx),answer=v.messages.find(m=>m.author==='chatgpt');assert.equal(answer.body,r.replyText);assert.equal(answer.source.source,RELAY_SOURCE);assert.equal(answer.source.simulation,false);assert.equal(answer.source.toolActivity,'NOT_OBSERVED');assert.equal(answer.source.fullToolTraceVerified,false);assert.equal(answer.source.noToolCalls,undefined);
  const t=f.w.textTask(f.ctx,{body:'虚构纯文字任务',executor:'chatgpt'});const tj=f.w.begin({jobId:f.w.status().next.id,workerId:'fiction-worker'});f.w.receipt(receipt(tj,'task'));
  assert.equal(f.w.get('case',t.id).state,'awaiting_user_acceptance');assert.equal(v.formalReviewAvailable,false);
 }finally{f.w.close();}
});
test('wrong thread, prompt, unfinished turn, mismatched user/reply/accepted turn and reused native IDs fail closed',()=>{
 const f=fixture();try{
  const j=startJob(f),r=receipt(j);
  for(const b of [{...r,threadId:'other'}, {...r,requestText:r.requestText+'x'}, {...r,replySha256:hash('wrong')}, {...r,completed:false}, {...r,nativeTurn:{...r.nativeTurn,status:'running'}}, {...r,nativeTurn:{...r.nativeTurn,user:{...r.nativeTurn.user,turnId:'other'}}}, {...r,nativeTurn:{...r.nativeTurn,replies:[{...r.nativeTurn.replies[0],turnId:'other'}]}}])assert.throws(()=>f.w.receipt(b));
  assert.equal(f.w.job(j.id).state,'DISPATCHING');f.w.receipt(r);
  assert.throws(()=>f.w.receipt({...r,replyText:'different',replySha256:hash('different'),nativeTurn:{...r.nativeTurn,replies:[{...r.nativeTurn.replies[0],text:'different'}]}}),/receipt_conflict/);
  const j2=startJob(f),r2=receipt(j2);assert.throws(()=>f.w.receipt(r2),/native_id_already_used/);
  assert.equal(f.w.job(j2.id).state,'DISPATCHING');
  f.w.submitted({jobId:j2.id,attemptToken:j2.attemptToken,accepted:true,nativeTurnId:'accepted-only'});
  assert.throws(()=>f.w.receipt(receipt(j2,'wrong-accepted')),/accepted_turn_mismatch/);
 }finally{f.w.close();}
});
test('one fixed original thread binds one workspace and no implicit project routing or simulated/autonomous/review actions',()=>{
 const f=fixture();try{
  const p=f.w.project('另一个虚构项目'),ws=f.w.workspace(p.id,'另一个窗口'),other={projectId:p.id,workspaceId:ws.id};
  assert.throws(()=>f.w.bindRelay(other),/already_bound/);assert.throws(()=>f.w.chat(other,{text:'虚构串线',targets:['chatgpt']}));
  assert.throws(()=>f.w.workspace(p.id,'错误参与者',['hermes']),/only_chatgpt/);
  assert.throws(()=>f.w.chat(f.ctx,{text:'虚构群发',targets:['all']}));
  for(const op of ['bindSimulation','issueSimulationToken','createReview','beginCross','recordReview','authorize','ingest','agentDirected','receive'])assert.throws(()=>f.w[op](),/locked/);
  assert.throws(()=>f.w.configure(f.ctx,{discussion:true}),/locked/);
 }finally{f.w.close();}
});
test('pause prevents new dispatch but preserves receipt recycling; UNKNOWN takes priority and never retries',()=>{
 const f=fixture();try{
  const j=startJob(f);chat(f);f.w.pause({paused:true});f.w.submitted({jobId:j.id,attemptToken:j.attemptToken,accepted:true});f.w.unknown({jobId:j.id,attemptToken:j.attemptToken,reason:'fiction timeout'});
  assert.equal(f.w.status().next.id,j.id);assert.equal(f.w.status().next.maySend,false);assert.throws(()=>f.w.begin({jobId:f.w.jobs()[1].id,workerId:'fiction-worker'}),/inflight/);
  f.w.receipt(receipt(j));const next=f.w.status().next;assert.equal(next.state,'QUEUED');assert.throws(()=>f.w.begin({jobId:next.id,workerId:'fiction-worker'}),/paused/);
  f.w.pause({paused:false});assert.equal(f.w.begin({jobId:next.id,workerId:'fiction-worker'}).state,'DISPATCHING');
 }finally{f.w.close();}
});
test('restart converts only DISPATCHING to UNKNOWN and retains SUBMITTED for read-only reconciliation',()=>{
 for(const submitted of [false,true]){
  const f=fixture(),j=startJob(f);if(submitted)f.w.submitted({jobId:j.id,attemptToken:j.attemptToken,accepted:true});f.w.close();
  const w=new RelayCore(f.file);try{w.recover();assert.equal(w.job(j.id).state,submitted?'SUBMITTED':'UNKNOWN');assert.throws(()=>w.begin({jobId:j.id,workerId:'fiction-worker'}),/inflight/);assert.equal(w.receipt(receipt(j,submitted?'s':'d')).state,'COMPLETED');}finally{w.close();}
 }
});
test('queued cancellation is terminal; in-flight cancellation and expired late receipt are audited and never applied',()=>{
 const f=fixture();try{
  const i=chat(f),queued=f.w.status().next;f.w.cancel(f.ctx,i.id);assert.equal(f.w.job(queued.id).state,'CANCELLED');
  const j=startJob(f);f.w.cancel(f.ctx,j.caseId);assert.equal(f.w.job(j.id).state,'UNKNOWN');assert.equal(f.w.receipt(receipt(j)).state,'CANCELLED');assert.equal(f.w.view(f.ctx).messages.filter(m=>m.author==='chatgpt').length,0);
  const j2=startJob(f);const expired=f.w.job(j2.id);expired.deadline='2001-01-01T00:00:00.000Z';f.w.saveJob(expired);assert.equal(f.w.status().next.state,'UNKNOWN');
  const result=f.w.receipt(receipt(j2,'expired'));assert.equal(result.state,'EXPIRED');assert.equal(result.ignored,true);
  assert.equal(f.w.db.prepare("SELECT count(*) n FROM audit WHERE kind='relay.late_receipt_ignored'").get().n,2);
 }finally{f.w.close();}
});
test('relay refuses existing unmarked database before opening it; normal core never adds relay tables',()=>{
 const dir=base(),file=join(dir,'relay-workbench.sqlite');writeFileSync(file,'fixture bytes');assert.throws(()=>new RelayCore(file),/unmarked/);assert.equal(readFileSync(file,'utf8'),'fixture bytes');
 const ordinary=join(base(),'normal.sqlite'),w=new CollaborationCore(ordinary);try{assert.equal(w.db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name LIKE 'relay_%'").get().n,0);const p=w.project('虚构主模式'),ws=w.workspace(p.id,'模拟');w.bindSimulation({projectId:p.id,workspaceId:ws.id},'hermes','虚构原模拟');assert.equal(w.view({projectId:p.id,workspaceId:ws.id}).mode,'SIMULATION_ONLY');}finally{w.close();}
});

const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function service(mode='CODEX_RELAY',folder){const dir=folder||base();const child=spawn(resolve('runtime/node.exe'),['src/workbench-server.mjs'],{windowsHide:true,env:{...process.env,TRB_WORKBENCH_DATA_DIR:dir,TRB_WORKBENCH_PORT:'0',TRB_WORKBENCH_EMPTY:'1',TRB_WORKBENCH_MODE:mode,TRB_WORKBENCH_PROFILE:'codex-relay-001'},stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',v=>log+=v);child.stderr.on('data',v=>log+=v);
 for(let n=0;n<100;n++){await delay(50);const infoFile=join(dir,'workbench-service.json');if(existsSync(infoFile)){const info=JSON.parse(readFileSync(infoFile,'utf8'));if(info.pid!==child.pid)continue;const cfg=JSON.parse(readFileSync(join(dir,'workbench-config.json'),'utf8'));const call=async(path,body,key,token=cfg.token)=>{const response=await fetch(info.url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...body===undefined?{}:{'Content-Type':'application/json'},...key?{'Idempotency-Key':key}:{}},...body===undefined?{}:{body:JSON.stringify(body)},signal:AbortSignal.timeout(5000)});return {status:response.status,body:await response.json()};};return {dir,child,call,stop:async()=>{await call('/api/service/stop',{});for(let k=0;k<100&&child.exitCode===null;k++)await delay(50);assert.equal(child.exitCode,0);}};}if(child.exitCode!==null)throw Error(log);}child.kill();throw Error(log||'startup timeout');}
test('HTTP relay supports WPF intent/chat/task with idempotency and locks all unsupported generic routes',async()=>{
 const s=await service();try{
  assert.equal((await s.call('/health')).body.mode,'CODEX_RELAY');assert.equal((await s.call('/api/relay/peek?workerId=fake')).body.worker.status,'UNKNOWN');
  assert.equal((await s.call('/api/relay/heartbeat',{workerId:'fiction-worker'})).body.status,'REPORTED_ACTIVE');
  const p=(await s.call('/api/projects',{name:'虚构HTTP'})).body,ws=(await s.call('/api/projects/'+p.id+'/workspaces',{name:'虚构空间',participants:['chatgpt']})).body,path='/api/workspaces/'+ws.id;
  assert.equal((await s.call(path+'/bind-relay',{projectId:p.id,agentId:'chatgpt'})).status,200);assert.equal((await s.call(path+'/configure',{projectId:p.id,paused:false,recipients:['chatgpt']})).status,200);
  const body={projectId:p.id,text:'@ChatGPT 虚构普通问候',recipients:['chatgpt']},one=await s.call(path+'/intent',body,'fiction-intent-0001');assert.equal(one.status,200);assert.equal(one.body.status,'EXECUTED');assert.equal(one.body.result.mode,'CODEX_RELAY');
  assert.deepEqual((await s.call(path+'/intent',body,'fiction-intent-0001')).body,one.body);assert.equal((await s.call(path+'/intent',{...body,text:'different'},'fiction-intent-0001')).status,400);
  assert.equal((await s.call(path+'/intent',{...body,text:'@ChatGPT 分析虚构文字'},'fiction-intent-0002')).body.intent,'delegate_task');
  for(const text of ['@ChatGPT 正式审批：虚构材料','@Hermes 虚构问候','@ChatGPT @DeepSeek 虚构群发','@ChatGPT 分析虚构文字完成后让Hermes复核']){const result=await s.call(path+'/intent',{...body,text},'unsupported-'+hash(text).slice(0,16));assert.equal(result.body.status,'UNSUPPORTED');}
  for(const op of ['bind-simulation','issue-simulation-token','reviews','agent-message','simulate-agent','simulate-fault','begin-cross','user-authorize','materials-receive','forward','plan-cancel'])assert.equal((await s.call(path+'/'+op,{projectId:p.id})).status,400,op);
  const v=(await s.call(path+'?projectId='+p.id)).body;assert.equal(v.items.length,2);assert.equal(v.participants[0].status,'relay_ready');assert.equal(v.participants[0].kind,'codex_relay');assert.equal(v.formalReviewAvailable,false);
  const j=(await s.call('/api/relay/peek')).body.next,begun=await s.call('/api/relay/begin',{jobId:j.id,workerId:'fiction-worker'});assert.equal(begun.body.state,'DISPATCHING');
  assert.equal((await s.call('/api/relay/begin',{jobId:j.id,workerId:'fiction-worker'})).status,400);
  assert.equal((await s.call('/api/relay/submitted',{jobId:j.id,attemptToken:begun.body.attemptToken,accepted:true})).body.state,'SUBMITTED');
  assert.equal((await s.call('/api/relay/receipt',receipt(begun.body,'http'))).body.state,'COMPLETED');
  assert.equal((await s.call('/api/relay/status',undefined,undefined,'bad-token')).status,401);
 }finally{await s.stop();}
});
test('default HTTP simulation mode and real adapter hard lock remain unchanged',async()=>{
 const s=await service('SIMULATION_ONLY');try{const h=(await s.call('/health')).body;assert.equal(h.mode,'SIMULATION_ONLY');assert.equal(h.realAdaptersAuthorized,false);assert.equal((await s.call('/api/relay/peek')).status,404);assert.equal(existsSync(join(s.dir,'codex-relay-profile.json')),false);}finally{await s.stop();}
});


test('turn and native user may share an ID; repeated reply IDs across different native turns are rejected',()=>{
 const f=fixture();try{
  const j=startJob(f),r=receipt(j,'shared-native');assert.equal(r.nativeTurnId,r.nativeUserMessageId);assert.equal(f.w.receipt(r).state,'COMPLETED');
  const j2=startJob(f),r2=receipt(j2,'different-turn');r2.replyIds=r.replyIds;r2.nativeTurn.replies[0].id=r.replyIds[0];assert.throws(()=>f.w.receipt(r2),/native_id_already_used/);
  const malformed=receipt(j2,'duplicate-as-user');malformed.replyIds=[malformed.nativeUserMessageId];malformed.nativeTurn.replies[0].id=malformed.nativeUserMessageId;assert.throws(()=>f.w.receipt(malformed),/native_ids_must_be_distinct/);
 }finally{f.w.close();}
});
test('late accepted acknowledgement after cancellation is audited without reopening dispatch',()=>{
 const f=fixture();try{
  const j=startJob(f);f.w.cancel(f.ctx,j.caseId);
  const b={jobId:j.id,attemptToken:j.attemptToken,accepted:true,nativeTurnId:'fiction-turn-late-accepted'};
  assert.equal(f.w.submitted(b).state,'UNKNOWN');assert.equal(f.w.submitted(b).state,'UNKNOWN');
  assert.throws(()=>f.w.submitted({...b,nativeTurnId:'conflicting-turn'}),/submitted_conflict/);
  assert.equal(f.w.db.prepare("SELECT count(*) n FROM audit WHERE kind='relay.late_accepted_no_resend'").get().n,1);
  assert.equal(f.w.receipt(receipt(j,'late-accepted')).state,'CANCELLED');
 }finally{f.w.close();}
});


test('post-begin continuation is read-only and fails closed after scope, binding, role/global pauses and expiry',()=>{
 const changes=[
  f=>f.w.configure(f.ctx,{paused:true}),
  f=>f.w.pauseBinding(f.ctx,'chatgpt',true),
  f=>f.w.control({paused:false,rolePaused:{chatgpt:true}}),
  f=>f.w.pause({paused:true}),
  (f,j)=>{const expired=f.w.job(j.id);expired.deadline='2001-01-01T00:00:00.000Z';f.w.saveJob(expired);},
  f=>f.w.configure(f.ctx,{participants:[]}),
  f=>f.w.archiveProject(f.ctx.projectId),
  (f,j)=>{const item=f.w.get('case',j.caseId);item.body+='changed';f.w.put('case',item.id,item);},
  (f,j)=>f.w.recover()
 ];
 // Participant removal is exercised through its explicit scoped setting,
 // since relay configure deliberately rejects unsupported participant arrays.
 changes[5]=f=>f.w.put('participant_setting',f.ctx.workspaceId+':chatgpt',{...f.ctx,role:'chatgpt',enabled:false});
 for(const change of changes){
  const f=fixture();try{const j=startJob(f),before=f.w.status().next;assert.equal(before.state,'DISPATCHING');assert.equal(before.maySend,false);assert.equal(before.dispatchContinuationAllowed,true);assert.equal(before.attemptToken,j.attemptToken);
   change(f,j);const after=f.w.status().next;assert.equal(after.dispatchContinuationAllowed,false);assert.equal(after.maySend,false);assert.equal(f.w.job(j.id).attempts,1);assert.equal(after.attemptToken,j.attemptToken);
  }finally{f.w.close();}
 }
});
test('post-begin continuation is false for SUBMITTED, UNKNOWN and changed frozen request or binding',()=>{
 const changes=[
  (f,j)=>f.w.submitted({jobId:j.id,attemptToken:j.attemptToken,accepted:true}),
  (f,j)=>f.w.unknown({jobId:j.id,attemptToken:j.attemptToken,reason:'fiction unknown'}),
  (f,j)=>{const d=f.w.get('delivery',j.id);d.prompt+='changed';f.w.put('delivery',d.id,d);},
  (f,j)=>f.w.db.prepare('UPDATE relay_binding SET id=?').run('changed-fiction-binding')
 ];
 for(const change of changes){const f=fixture();try{const j=startJob(f);assert.equal(f.w.status().next.dispatchContinuationAllowed,true);change(f,j);assert.equal(f.w.status().next.dispatchContinuationAllowed,false);}finally{f.w.close();}}
});


test('real HTTP preserves >128KB Chinese receipt under 512KB and rejects oversized replies or transport without truncation',async()=>{
 const s=await service();try{
  const p=(await s.call('/api/projects',{name:'虚构长中文HTTP'})).body,ws=(await s.call('/api/projects/'+p.id+'/workspaces',{name:'虚构空间',participants:['chatgpt']})).body,path='/api/workspaces/'+ws.id;
  await s.call(path+'/bind-relay',{projectId:p.id});await s.call(path+'/configure',{projectId:p.id,paused:false,recipients:['chatgpt']});
  await s.call(path+'/chat',{projectId:p.id,text:'虚构输入：'+'树'.repeat(5900),recipients:['chatgpt']},'long-chinese-fixture');
  const j=(await s.call('/api/relay/peek')).body.next,begin=(await s.call('/api/relay/begin',{jobId:j.id,workerId:'fiction-worker'})).body,proof=receipt(begin,'long-unicode');
  proof.replyText='虚构回复：'+'果'.repeat(20000);proof.replySha256=hash(proof.replyText);proof.nativeTurn.replies[0].text=proof.replyText;
  const bytes=Buffer.byteLength(JSON.stringify(proof));assert.ok(bytes>128000&&bytes<512000);
  const oversized={...proof,padding:'x'.repeat(512001)};assert.equal((await s.call('/api/relay/receipt',oversized)).body.error,'payload_too_large');
  const tooLong=structuredClone(proof);tooLong.replyText='果'.repeat(30001);tooLong.replySha256=hash(tooLong.replyText);tooLong.nativeTurn.replies[0].text=tooLong.replyText;
  assert.equal((await s.call('/api/relay/receipt',tooLong)).body.error,'relay_reply_text_or_hash_mismatch');assert.equal((await s.call('/api/relay/peek')).body.next.state,'DISPATCHING');
  assert.equal((await s.call('/api/relay/receipt',proof)).body.state,'COMPLETED');
  const v=(await s.call(path+'?projectId='+p.id)).body;assert.equal(v.messages.find(m=>m.author==='chatgpt').body,proof.replyText);
  assert.equal((await s.call('/api/relay/heartbeat',{workerId:'fiction-worker',padding:'x'.repeat(128001)})).body.error,'payload_too_large');
 }finally{await s.stop();}
});

