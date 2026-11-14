import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,cpSync,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {Workbench} from '../src/workbench.mjs';
import {CollaborationCore} from '../src/collaboration-core.mjs';
import {executeCollaborationIntent} from '../src/collaboration-intent.mjs';
import {SimulationAdapter,WorkbenchSupervisor} from '../src/simulation-adapter.mjs';
import {EngineeringContext} from '../engineering/context.mjs';
import {EngineeringDesktopApi} from '../engineering/desktop-api.mjs';
import {Workflow} from '../src/workflow.mjs';

const owner={id:'local-owner',kind:'user'};
function fixture(Core=CollaborationCore,options={}){
  mkdirSync('test-output',{recursive:true});const dir=mkdtempSync(resolve('test-output','collaboration-governance-'));
  const w=new Core(join(dir,'fiction.sqlite'),options),p=w.project('虚构统一治理'),ws=w.workspace(p.id,'虚构会话'),ctx={projectId:p.id,workspaceId:ws.id};
  for(const role of ['hermes','deepseek','chatgpt'])w.bindSimulation(ctx,role,'虚构 '+role);
  w.configure(ctx,{paused:false});w.control({paused:false,maxPerHour:30});
  const supervisor=new WorkbenchSupervisor(w,new SimulationAdapter(w),{evidenceDir:join(dir,'simulated-evidence')});
  return {w,ctx,dir,supervisor};
}
const reviewInput={title:'虚构正式文字审批',body:'虚构算式2+3=5',reviewers:['hermes','deepseek','chatgpt'],assignee:'hermes'};
async function pump(f){for(const role of ['hermes','deepseek','chatgpt'])await f.supervisor.step(role,f.ctx);}
function engineering(){
  const f=fixture(),source=join(f.dir,'sources');mkdirSync(source);writeFileSync(join(source,'fiction.js'),'export const fiction = 42;\n');
  const e=new EngineeringContext(f.w,{storePath:join(f.dir,'store'),allowedSourceRoots:[source]}),api=new EngineeringDesktopApi(e);
  const task=f.w.textTask(f.ctx,{title:'虚构工程Task',body:'仅处理虚构材料；不执行项目代码。',executor:'hermes'});
  const s=e.registerSource(owner,f.ctx,{path:source,repositoryType:'directory'}),snapshot=e.snapshot(owner,f.ctx,s.id);
  const pkg=e.createPackage(owner,f.ctx,{taskId:task.id,snapshotId:snapshot.id,objective:'虚构字节检查',acceptanceCriteria:['原文完整'],recipients:[]});
  const definition={ownerId:'hermes',riskLevel:'L1',riskBasis:'虚构独立模块流程',kind:'api_change',reviewerIds:['deepseek'],goal:'虚构材料检查',scope:'仅当前虚构材料',acceptanceCriteria:['包版本准确']};
  assert.equal(api.governance.register(owner,f.ctx,{taskId:task.id,definition}).blocked,false);
  return {...f,e,api,task,pkg};
}

test('ordinary chat has no invented risk or mandatory reviewers; text tasks have one actual owner',()=>{
  const f=fixture();try{
    const chat=f.w.chat(f.ctx,{text:'普通虚构说明',targets:['all']});assert.equal(chat.scope,'text_only_chat');assert.deepEqual(chat.reviewers,[]);
    const task=f.w.textTask(f.ctx,{body:'虚构单负责人任务',executor:'hermes'});assert.equal(task.governanceOwnerId,'hermes');assert.deepEqual(task.reviewers,[]);assert.equal(task.riskLevel,undefined);
    for(const input of [{executor:['hermes','deepseek']},{executor:'hermes',owners:['hermes','deepseek']},{executor:'hermes',ownerId:'deepseek'}])assert.throws(()=>f.w.textTask(f.ctx,{body:'无效任务',...input}),/one_owner/);
    assert.equal(f.w.list('case').length,2);
  }finally{f.w.close();}
});

test('raw public review/create paths reject duplicate or invalid reviewers and actual author self-review',()=>{
  const f=fixture();try{
    for(const reviewers of [['deepseek','deepseek'],['unknown'],[],['hermes']])assert.throws(()=>f.w.within(f.ctx,()=>f.w.create({...reviewInput,reviewers},'hermes')),/invalid_reviewers|self_review/);
    assert.throws(()=>f.w.createReview(f.ctx,{...reviewInput,ownerId:'deepseek'}),/self_review/);
    assert.throws(()=>f.w.createReview(f.ctx,{...reviewInput,owners:['user','hermes']}),/one_owner/);
    assert.equal(f.w.list('case').length,0);
  }finally{f.w.close();}
});

test('legacy user-authored all-vote approval keeps its post-approval text executor semantics',async()=>{
  const f=fixture();try{
    const item=f.w.createReview(f.ctx,reviewInput);assert.equal(item.governanceOwnerId,'user');assert.equal(item.snapshot.governance_owner,'user');
    await f.supervisor.step('hermes',f.ctx);await f.supervisor.step('deepseek',f.ctx);
    assert.equal(f.w.get('case',item.id).state,'reviewing');assert.throws(()=>f.w.authorize(f.ctx,item.id,{snapshotHash:item.artifactHash,note:'用户不能补票'}));
    await f.supervisor.step('chatgpt',f.ctx);assert.equal(f.w.get('case',item.id).state,'task_queued');
    assert.equal(f.w.db.prepare('SELECT count(*) n FROM authorizations').get().n,0);
    await f.supervisor.step('hermes',f.ctx);assert.equal(f.w.get('case',item.id).state,'awaiting_user_acceptance');
    assert.equal(f.w.authorize(f.ctx,item.id,{snapshotHash:item.artifactHash,note:'仅记录当前虚构文字决定'}).executionAvailable,false);
  }finally{f.w.close();}
});

test('all-vote checks ignore an approved state flag, stale votes and conditional approvals',async()=>{
  const f=fixture();try{
    const item=f.w.createReview(f.ctx,{...reviewInput,assignee:null});await pump(f);
    const real=f.w.get('case',item.id);assert.equal(real.state,'approved');
    for(const mutate of [i=>{delete i.votes.chatgpt;},i=>{i.votes.hermes.conditions=['仍有条件'];},i=>{i.votes.deepseek.revision=0;}]){
      const altered=structuredClone(real);mutate(altered);f.w.put('case',item.id,altered);
      assert.throws(()=>f.w.authorize(f.ctx,item.id,{snapshotHash:real.artifactHash,note:'不能覆盖缺票或旧票'}),/all_votes_required/);
    }
    assert.equal(f.w.db.prepare('SELECT count(*) n FROM authorizations').get().n,0);
  }finally{f.w.close();}
});

test('new material revisions invalidate old votes and authorization without discarding historical evidence',async()=>{
  const f=fixture();try{
    const item=f.w.createReview(f.ctx,{...reviewInput,assignee:null});await pump(f);
    f.w.authorize(f.ctx,item.id,{snapshotHash:item.artifactHash,note:'虚构第一版决定'});
    const revised=f.w.reviseReview(f.ctx,item.id,{expectedRevision:1,body:'虚构第二版：明确单位'});
    assert.equal(revised.revision,2);assert.deepEqual(revised.votes,{});assert.equal(revised.userAuthorized,false);assert.equal(revised.history[0].votes.hermes.verdict,'approve');
    assert.throws(()=>f.w.authorize(f.ctx,item.id,{snapshotHash:item.artifactHash,note:'不能继承旧授权'}));
    assert.throws(()=>f.w.reviseReview(f.ctx,item.id,{expectedRevision:2,reviewers:['hermes','hermes']}),/invalid_reviewers/);
    assert.throws(()=>f.w.reviseReview(f.ctx,item.id,{expectedRevision:2,ownerId:'deepseek'}),/frozen_owner/);
    assert.equal(f.w.get('case',item.id).revision,2);assert.equal(f.w.db.prepare('SELECT count(*) n FROM authorizations WHERE revision=2').get().n,0);
  }finally{f.w.close();}
});

test('direct revise is scope-aware and cannot preserve old review votes via the inherited Workflow entry',()=>{
  const f=fixture();try{
    const item=f.w.createReview(f.ctx,{...reviewInput,assignee:null});const next=f.w.revise(item.id,'虚构直接修订');assert.equal(next.revision,2);assert.deepEqual(next.votes,{});
    const changed={...next,parentCaseId:'invented-parent'};assert.throws(()=>f.w.put('case',item.id,changed),/frozen_owner_or_parent/);
  }finally{f.w.close();}
});

test('associated text task author cannot review their own work through direct core or NL',()=>{
  const f=fixture();try{
    const task=f.w.textTask(f.ctx,{body:'虚构被审工作',executor:'hermes'});
    assert.throws(()=>f.w.createReview(f.ctx,{...reviewInput,reviewers:['hermes'],parentCaseId:task.id}),/self_review/);
    assert.throws(()=>f.w.createReview(f.ctx,{...reviewInput,reviewers:['hermes'],parentCaseId:task.id,ownerId:'user'}),/frozen_owner/);
    const result=executeCollaborationIntent(f.w,owner,f.ctx,{text:'让Hermes独立检查这个修改',selectedItemId:task.id});assert.equal(result.status,'CLARIFICATION_REQUIRED');
    assert.equal(f.w.list('case').length,1);
    const proper=f.w.createReview(f.ctx,{...reviewInput,reviewers:['deepseek'],parentCaseId:task.id,assignee:null});assert.equal(proper.governanceOwnerId,'hermes');
  }finally{f.w.close();}
});

test('integrity corruption fails closed for chat, task, review, direct revision, authorization and dispatch',()=>{
  mkdirSync('test-output',{recursive:true});const folder=mkdtempSync(resolve('test-output','collaboration-policy-')),copy=join(folder,'governance');cpSync(resolve('governance'),copy,{recursive:true});
  const f=fixture(Workbench,{governanceRoot:copy});try{
    const chat=f.w.chat(f.ctx,{text:'虚构待发文字',targets:['hermes']}),item=f.w.createReview(f.ctx,{...reviewInput,assignee:null});
    writeFileSync(join(copy,'PROTECTED_RULES.md'),readFileSync(join(copy,'PROTECTED_RULES.md'),'utf8')+'\n虚构完整性破坏。');
    for(const action of [()=>f.w.chat(f.ctx,{text:'不继续',targets:['hermes']}),()=>f.w.textTask(f.ctx,{body:'不继续',executor:'hermes'}),()=>f.w.createReview(f.ctx,reviewInput),()=>f.w.revise(item.id,'不继续'),()=>f.w.authorize(f.ctx,item.id,{snapshotHash:item.artifactHash,note:'不能越过损坏规则'})])assert.throws(action,/governance_integrity_failure/);
    const delivery=f.w.list('delivery').find(d=>d.caseId===chat.id);assert.equal(f.w.canSend(delivery),false);assert.match(f.w.admissionReason(delivery),/治理阻断/);
    assert.equal(f.w.list('case').length,2);assert.ok(f.w.db.prepare("SELECT count(*) n FROM audit WHERE kind='collaboration.governance.blocked'").get().n>0);
  }finally{f.w.close();}
});

test('nested HTTP-style transaction rollback preserves a four-field refusal audit outside the mutation',()=>{
  const f=fixture();try{
    assert.throws(()=>f.w.transaction(()=>f.w.createReview(f.ctx,{...reviewInput,reviewers:['deepseek','deepseek']})),/invalid_reviewers/);
    const row=f.w.db.prepare("SELECT json FROM audit WHERE kind='collaboration.governance.blocked' ORDER BY seq DESC LIMIT 1").get();assert.ok(row);
    const audit=JSON.parse(row.json);for(const field of ['request','rule','impact','alternative'])assert.equal(typeof audit[field],'string');assert.equal(audit.executionAuthorized,false);assert.equal(f.w.list('case').length,0);
  }finally{f.w.close();}
});

test('registered engineering task cannot bypass Host scope, review rounds or issues by creating text descendants',()=>{
  const f=engineering();try{
    const before=f.w.list('case').length;
    assert.throws(()=>f.w.textTask(f.ctx,{body:'暗中扩大范围',executor:'hermes',parentCaseId:f.task.id}),/engineering_host_required/);
    assert.throws(()=>f.w.createReview(f.ctx,{...reviewInput,reviewers:['deepseek'],parentCaseId:f.task.id}),/engineering_host_required/);
    assert.equal(f.w.list('case').length,before);
    const chat=f.w.chat(f.ctx,{text:'只讨论当前虚构工程，不改变范围或审查',targets:['hermes'],parentCaseId:f.task.id});assert.equal(f.w.canSend(f.w.list('delivery').find(d=>d.caseId===chat.id)),true);
    const started=executeCollaborationIntent(f.w,owner,f.ctx,{text:'让DSH独立检查这个修改',selectedItemId:f.task.id},{materials:f.api});
    assert.equal(started.status,'EXECUTED');assert.equal(started.result.round.round,1);assert.equal(started.result.attempts[0].state,'QUEUED');
    assert.equal(f.w.db.prepare('SELECT count(*) n FROM uec_exchange_receipts').get().n,0);
    assert.throws(()=>f.api.governance.startReview(owner,f.ctx,{taskId:f.task.id,packageId:f.pkg.id,version:1}),/previous_round_reviewer_opinions_required/);
  }finally{f.w.close();}
});

test('P1-COLLAB-ENTRY-001 known engineering messages retain their task link and cannot bypass Host through legacy entries',()=>{
  const f=engineering();try{
    const sourceMessageId='request:'+f.task.id,beforeCases=f.w.list('case').length,beforeDeliveries=f.w.list('delivery').length;
    assert.throws(()=>f.w.textTask(f.ctx,{body:'由已知工程消息创建后续',executor:'hermes',sourceMessageId}),/engineering_host_required/);
    assert.throws(()=>f.w.createReview(f.ctx,{...reviewInput,reviewers:['deepseek'],assignee:null,sourceMessageId}),/engineering_host_required/);
    assert.equal(f.w.list('case').length,beforeCases);assert.equal(f.w.list('delivery').length,beforeDeliveries);
  }finally{f.w.close();}
});

test('P1-COLLAB-ENTRY-001 source messages are scope-bound, conflict-checked and independent from caller author claims',()=>{
  const f=fixture();try{
    const parent=f.w.chat(f.ctx,{text:'虚构原始对话',targets:['hermes']}),other=f.w.chat(f.ctx,{text:'虚构另一事项',targets:['hermes']});
    const sourceMessageId='fiction-hermes-source';f.w.addMessage(f.ctx,{id:sourceMessageId,author:'hermes',recipients:['user'],body:'Hermes虚构原文',kind:'chat',caseId:parent.id});
    const p=f.w.project('虚构隔离项目'),ws=f.w.workspace(p.id,'虚构隔离窗口'),foreign={projectId:p.id,workspaceId:ws.id};
    const before=f.w.list('case').length;
    for(const invoke of [
      ()=>f.w.textTask(foreign,{body:'不能跨scope引用',executor:'hermes',sourceMessageId}),
      ()=>f.w.createReview(foreign,{...reviewInput,reviewers:['deepseek'],assignee:null,sourceMessageId})
    ])assert.throws(invoke,/message_outside_workspace/);
    for(const invoke of [
      ()=>f.w.textTask(f.ctx,{body:'不能伪造父项',executor:'hermes',sourceMessageId,parentCaseId:other.id}),
      ()=>f.w.createReview(f.ctx,{...reviewInput,reviewers:['deepseek'],assignee:null,sourceMessageId,parentCaseId:other.id})
    ])assert.throws(invoke,/source_message_parent_conflict/);
    assert.throws(()=>f.w.createReview(f.ctx,{...reviewInput,reviewers:['hermes'],assignee:null,sourceMessageId,sourceAuthorId:'deepseek'}),/self_review/);
    assert.throws(()=>f.w.textTask(f.ctx,{body:'来源必须存在',executor:'hermes',sourceMessageId:'missing-source-message'}),/message_outside_workspace/);
    assert.equal(f.w.list('case').length,before);
    const legal=f.w.createReview(f.ctx,{...reviewInput,reviewers:['deepseek'],assignee:null,sourceMessageId,sourceAuthorId:'deepseek'});
    assert.equal(legal.parentCaseId,parent.id);assert.deepEqual(legal.reviewers,['deepseek']);
    const request=f.w.view(f.ctx).messages.find(m=>m.case_id===legal.id&&m.author==='user');
    assert.equal(request.source.sourceMessageId,sourceMessageId);assert.equal(request.source.parentCaseId,parent.id);
    const followup=f.w.textTask(f.ctx,{body:'合法文字后续',executor:'deepseek',sourceMessageId});assert.equal(followup.parentCaseId,parent.id);
    assert.equal(f.w.view(f.ctx).messages.find(m=>m.case_id===followup.id).source.sourceMessageId,sourceMessageId);
  }finally{f.w.close();}
});

test('known default-independent first opinions cannot be disclosed through message-based legacy task or review creation',()=>{
  const f=fixture();try{
    const item=f.w.createReview(f.ctx,{title:'虚构初始意见隔离',body:'虚构审查文字',reviewers:['hermes','deepseek']});
    item.votes.deepseek={verdict:'approve',raw:'DSH虚构独立首轮意见'};f.w.put('case',item.id,item);
    const sourceMessageId='fiction-incomplete-opinion';f.w.addMessage(f.ctx,{id:sourceMessageId,author:'deepseek',recipients:['user'],body:'DSH虚构独立首轮意见',kind:'review_result',caseId:item.id});
    const before=f.w.list('case').length;
    assert.throws(()=>f.w.textTask(f.ctx,{body:'不能提前转交初始意见',executor:'hermes',sourceMessageId}),/initial_opinion_disclosure_forbidden/);
    assert.throws(()=>f.w.createReview(f.ctx,{...reviewInput,reviewers:['hermes'],assignee:null,sourceMessageId}),/initial_opinion_disclosure_forbidden/);
    assert.equal(f.w.list('case').length,before);
  }finally{f.w.close();}
});

test('P1-COLLAB-ENTRY-001 source identity survives revision and cannot be laundered into author self-review',()=>{
  const f=fixture();try{
    const parent=f.w.chat(f.ctx,{text:'虚构修订来源对话',targets:['hermes']}),sourceMessageId='fiction-frozen-source',otherMessageId='fiction-other-source';
    f.w.addMessage(f.ctx,{id:sourceMessageId,author:'hermes',recipients:['user'],body:'Hermes虚构来源原文',kind:'chat',caseId:parent.id});
    f.w.addMessage(f.ctx,{id:otherMessageId,author:'chatgpt',recipients:['user'],body:'不同虚构来源',kind:'chat',caseId:parent.id});
    const item=f.w.createReview(f.ctx,{...reviewInput,reviewers:['deepseek'],assignee:null,sourceMessageId});
    assert.equal(item.sourceMessageId,sourceMessageId);assert.equal(item.sourceAuthorId,'hermes');
    assert.match(item.sourceBodyHash,/^[a-f0-9]{64}$/);assert.deepEqual(item.snapshot.source_message,{message_id:sourceMessageId,author:'hermes',body_sha256:item.sourceBodyHash});
    const old=f.w.db.prepare('SELECT payload,sha256 FROM snapshots WHERE item_id=? AND revision=1').get(item.id),beforeDeliveries=f.w.list('delivery').length;
    assert.throws(()=>f.w.reviseReview(f.ctx,item.id,{expectedRevision:1,reviewers:['hermes']}),/self_review/);
    for(const replacement of [null,otherMessageId])assert.throws(()=>f.w.reviseReview(f.ctx,item.id,{expectedRevision:1,reviewers:['deepseek'],sourceMessageId:replacement}),/frozen_message_source/);
    assert.throws(()=>f.w.reviseReview(f.ctx,item.id,{expectedRevision:1,sourceAuthorId:'chatgpt'}),/frozen_message_source/);
    for(const changed of [{sourceMessageId:null},{sourceMessageId:otherMessageId},{sourceAuthorId:'chatgpt'},{sourceBodyHash:'0'.repeat(64)}])assert.throws(()=>f.w.put('case',item.id,{...f.w.get('case',item.id),...changed}),/frozen_owner_or_parent/);
    assert.equal(f.w.get('case',item.id).revision,1);assert.equal(f.w.list('delivery').length,beforeDeliveries);
    const revised=f.w.reviseReview(f.ctx,item.id,{expectedRevision:1,body:'虚构合法第二版',reviewers:['deepseek']});
    assert.equal(revised.revision,2);assert.equal(revised.sourceMessageId,sourceMessageId);assert.equal(revised.sourceAuthorId,'hermes');assert.equal(revised.sourceBodyHash,item.sourceBodyHash);
    assert.deepEqual(revised.snapshot.source_message,item.snapshot.source_message);assert.deepEqual(f.w.db.prepare('SELECT payload,sha256 FROM snapshots WHERE item_id=? AND revision=1').get(item.id),old);
    assert.equal(f.w.db.prepare('SELECT count(*) n FROM snapshots WHERE item_id=?').get(item.id).n,2);assert.equal(revised.userAuthorized,false);
  }finally{f.w.close();}
});

test('P1-COLLAB-ENTRY-001 actual source author is excluded from initial and cross reviewers, including revision',()=>{
  const f=fixture();try{
    const parent=f.w.chat(f.ctx,{text:'虚构交叉复核来源',targets:['hermes']}),sourceMessageId='fiction-cross-source';
    f.w.addMessage(f.ctx,{id:sourceMessageId,author:'hermes',recipients:['user'],body:'Hermes虚构源材料',kind:'chat',caseId:parent.id});
    const base={...reviewInput,assignee:null,sourceMessageId,reviewPlan:'independent_then_cross'};
    assert.throws(()=>f.w.createReview(f.ctx,{...base,reviewers:['hermes'],crossReviewers:['chatgpt']}),/self_review|invalid_reviewers/);
    assert.throws(()=>f.w.createReview(f.ctx,{...base,reviewers:['deepseek'],crossReviewers:['hermes']}),/self_review|invalid_reviewers/);
    const legal=f.w.createReview(f.ctx,{...base,reviewers:['deepseek'],crossReviewers:['chatgpt']});assert.deepEqual(legal.crossReviewers,['chatgpt']);
    assert.throws(()=>f.w.reviseReview(f.ctx,legal.id,{expectedRevision:1,crossReviewers:['hermes']}),/self_review|invalid_reviewers/);
    const revised=f.w.reviseReview(f.ctx,legal.id,{expectedRevision:1,body:'虚构交叉材料第二版',reviewers:['deepseek'],crossReviewers:['chatgpt']});
    assert.equal(revised.sourceAuthorId,'hermes');assert.deepEqual(revised.crossReviewers,['chatgpt']);assert.equal(revised.snapshot.source_message.message_id,sourceMessageId);
  }finally{f.w.close();}
});

test('P1-COLLAB-ENTRY-001 an ingested review cannot replace the trusted message parent with a different task',()=>{
  const f=fixture();try{
    const sourceParent=f.w.chat(f.ctx,{text:'虚构消息父项',targets:['hermes']}),ingestParent=f.w.chat(f.ctx,{text:'虚构不同Agent链父项',targets:['hermes']});
    const sourceMessageId='fiction-ingest-source';f.w.addMessage(f.ctx,{id:sourceMessageId,author:'hermes',recipients:['user'],body:'虚构Agent来源原文',kind:'chat',caseId:sourceParent.id});
    const before=f.w.list('case').length;
    assert.throws(()=>f.w.within(f.ctx,()=>f.w.create({...reviewInput,reviewers:['deepseek'],assignee:null,sourceMessageId},'user',{source:{...f.ctx,parentCaseId:ingestParent.id}})),/source_message_parent_conflict/);
    assert.equal(f.w.list('case').length,before);
  }finally{f.w.close();}
});

test('registered engineering execution uses persisted Host issues; P2 remains nonblocking and P1 stops dispatch',()=>{
  const f=engineering();try{
    const delivery=f.w.list('delivery').find(d=>d.caseId===f.task.id);
    f.api.governance.issue(owner,f.ctx,{taskId:f.task.id,operation:'create',problemKey:'fiction-style',severity:'P2'});
    assert.equal(f.w.canSend(delivery),true);
    f.api.governance.issue(owner,f.ctx,{taskId:f.task.id,operation:'create',problemKey:'fiction-failure',severity:'P1'});
    assert.equal(f.w.canSend(delivery),false);assert.match(f.w.admissionReason(delivery),/engineering_execution_blocked/);
    f.w.cancel(f.ctx,f.task.id);assert.equal(f.w.get('case',f.task.id).state,'cancelled');
  }finally{f.w.close();}
});

test('broken rules still allow actual scoped cancellation and pause, but never resume or change material',()=>{
  mkdirSync('test-output',{recursive:true});const folder=mkdtempSync(resolve('test-output','collaboration-stop-')),copy=join(folder,'governance');cpSync(resolve('governance'),copy,{recursive:true});
  const f=fixture(Workbench,{governanceRoot:copy});try{
    const parent=f.w.textTask(f.ctx,{body:'虚构待取消父任务',executor:'hermes'}),child=f.w.textTask(f.ctx,{body:'虚构待取消后续',executor:'deepseek',parentCaseId:parent.id});
    const review=f.w.createReview(f.ctx,{...reviewInput,assignee:null});
    writeFileSync(join(copy,'active.json'),'{}');
    const other=f.w.project('虚构异项目'),ws=f.w.workspace(other.id,'异会话'),alien={projectId:other.id,workspaceId:ws.id};
    assert.throws(()=>f.w.cancel(alien,parent.id),/entity_outside_workspace/);
    assert.equal(f.w.cancel(f.ctx,parent.id).cancelled,true);assert.equal(f.w.get('case',child.id).cancelled,true);
    assert.ok(f.w.list('delivery').filter(d=>[parent.id,child.id].includes(d.caseId)).every(d=>d.state==='cancelled'));
    assert.equal(f.w.cancel(f.ctx,review.id).cancelled,true);
    f.w.configure(f.ctx,{paused:true});assert.equal(f.w.scope(f.ctx).paused,1);
    f.w.pauseBinding(f.ctx,'deepseek',true);assert.equal(f.w.binding(f.ctx,'deepseek').paused,1);
    assert.equal(f.w.control({paused:true,reason:'规则异常止损'}).paused,true);
    assert.throws(()=>f.w.configure(f.ctx,{paused:false}),/governance_integrity_failure/);
    assert.throws(()=>f.w.pauseBinding(f.ctx,'deepseek',false),/governance_integrity_failure/);
    assert.throws(()=>f.w.control({paused:false}),/governance_integrity_failure/);
    assert.throws(()=>f.w.control({paused:true,rolePaused:{deepseek:false}}),/governance_integrity_failure/);
    assert.throws(()=>f.w.configure(f.ctx,{paused:true,name:'混入其他修改'}),/governance_integrity_failure/);
  }finally{f.w.close();}
});

test('a pre-upgrade snapshot without governance metadata retains its exact bytes and hash across reopening',()=>{
  const f=fixture(Workbench);let w=f.w;try{
    // Generate the historical contract without the new public-entry metadata.
    const old=w.within(f.ctx,()=>Workflow.prototype.create.call(w,{...reviewInput,assignee:null}));
    assert.equal(old.governanceOwnerId,undefined);assert.equal(old.snapshot.governance_owner,undefined);
    const before=w.db.prepare('SELECT payload,sha256 FROM snapshots WHERE item_id=? AND revision=1').get(old.id);
    w.close();w=new Workbench(join(f.dir,'fiction.sqlite'));
    w.put('case',old.id,{...w.get('case',old.id),updatedAt:new Date().toISOString()});
    assert.deepEqual(w.db.prepare('SELECT payload,sha256 FROM snapshots WHERE item_id=? AND revision=1').get(old.id),before);
    const fresh=w.createReview(f.ctx,{...reviewInput,assignee:null});assert.equal(fresh.snapshot.collaboration_governance_version,1);assert.equal(fresh.snapshot.governance_owner,'user');
  }finally{w.close();}
});

test('waiting plan reserves one future review delivery and child, released atomically before review creation',()=>{
  const f=fixture();try{
    const root=f.w.textTask(f.ctx,{body:'虚构两阶段根任务',executor:'hermes',limits:{maxDeliveries:3,maxAutoTasks:2}});
    f.w.put('collaboration_plan','fiction-plan',{rootId:root.id,state:'WAITING_OWNER',reservedReview:true});
    assert.equal(f.w.reservedPlanDeliveries(root.id),1);assert.equal(f.w.reservedPlanTasks(root.id),1);
    f.w.textTask(f.ctx,{body:'其他已准入文字任务',executor:'deepseek',parentCaseId:root.id});
    assert.throws(()=>f.w.textTask(f.ctx,{body:'不能偷预留子任务位',executor:'chatgpt',parentCaseId:root.id}),/root_automatic_task_budget/);
    const review=f.w.transaction(()=>{f.w.put('collaboration_plan','fiction-plan',{rootId:root.id,state:'REVIEW_QUEUED',reservedReview:false});return f.w.createReview(f.ctx,{title:'虚构预留复核',body:'准确的虚构结果',reviewers:['deepseek'],parentCaseId:root.id});});
    assert.equal(review.scope,'text_only_review');assert.equal(f.w.reservedPlanTasks(root.id),0);
    assert.equal(f.w.list('delivery').filter(d=>f.w.get('case',d.caseId)?.rootId===root.id).length,3);
  }finally{f.w.close();}
});

test('future review reservation blocks another delivery even with spare automatic-task budget; terminal plans release it',()=>{
  const f=fixture();try{
    const root=f.w.textTask(f.ctx,{body:'虚构消息预算根任务',executor:'hermes',limits:{maxDeliveries:3,maxAutoTasks:10}});
    f.w.put('collaboration_plan','fiction-plan',{rootId:root.id,state:'OWNER_UNKNOWN',reservedReview:true});
    f.w.textTask(f.ctx,{body:'另一个已排队动作',executor:'deepseek',parentCaseId:root.id});
    const before=f.w.list('case').length;
    assert.throws(()=>f.w.textTask(f.ctx,{body:'不能偷未来投递位',executor:'chatgpt',parentCaseId:root.id}),/budget_prevents_complete_task_queue/);
    assert.equal(f.w.list('case').length,before);
    for(const state of ['PAUSED','WAITING_OWNER','OWNER_UNKNOWN']){f.w.put('collaboration_plan','fiction-plan',{rootId:root.id,state,reservedReview:true});assert.equal(f.w.reservedPlanTasks(root.id),1);}
    for(const state of ['NEEDS_USER','CANCELLED','REVIEW_QUEUED','REVIEW_UNKNOWN','REVIEW_APPROVED','CHANGES_REQUESTED','REJECTED']){f.w.put('collaboration_plan','fiction-plan',{rootId:root.id,state,reservedReview:true});assert.equal(f.w.reservedPlanTasks(root.id),0);}
    f.w.put('collaboration_plan','fiction-plan',{rootId:root.id,state:'WAITING_OWNER',reservedReview:true});f.w.cancel(f.ctx,root.id);assert.equal(f.w.reservedPlanDeliveries(root.id),0);
  }finally{f.w.close();}
});
