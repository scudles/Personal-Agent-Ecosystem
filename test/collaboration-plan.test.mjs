import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {maskNonInstructions,parseCollaborationPlan} from '../src/collaboration-plan.mjs';
import {CollaborationCore} from '../src/collaboration-core.mjs';
import {TextCollaborationPlans} from '../src/collaboration-plans-host.mjs';
import {executeCollaborationIntent} from '../src/collaboration-intent.mjs';
import {SimulationAdapter,WorkbenchSupervisor} from '../src/simulation-adapter.mjs';

test('bounded owner/reviewer plans resolve exact identities and preserve literal task material',()=>{
  for(const text of ['让Hermes负责整理虚构资料，DSH复核，ChatGPT不参与','请由Hermes整理虚构资料，完成后让DSH独立复核','交由Hermes来整理虚构资料，DeepSeek Harness审阅结果','@Hermes 整理虚构资料完成后让@DSH独立检查']) {
    const p=parseCollaborationPlan(text);assert.equal(p?.status,'READY',text);assert.equal(p.ownerId,'hermes');assert.equal(p.reviewerId,'deepseek');
    assert.match(p.instruction,/整理虚构资料/);assert.equal(p.dependency,'OWNER_VERIFIED_TEXT_RESULT');
  }
  assert.deepEqual(parseCollaborationPlan('让Hermes负责整理虚构资料，DSH复核，ChatGPT不参与').excludedIds,['chatgpt']);
  const quoted=parseCollaborationPlan('让Hermes负责整理“虚构甲，虚构乙”，DSH复核');assert.equal(quoted.status,'READY');assert.equal(quoted.instruction,'整理“虚构甲，虚构乙”');
});

test('one owner and one distinct reviewer are mandatory; other chains are not silently truncated',()=>{
  assert.equal(parseCollaborationPlan('让Hermes负责整理虚构资料，Hermes复核').status,'UNSUPPORTED');
  assert.equal(parseCollaborationPlan('让Hermes负责整理虚构资料，DSH复核，DSH不参与').status,'UNSUPPORTED');
  for(const text of ['让Hermes负责整理虚构资料，DSH复核，ChatGPT复核','让Hermes负责整理虚构资料，DSH复核，若通过就实施','如果通过让Hermes整理虚构资料，DSH复核'])assert.notEqual(parseCollaborationPlan(text)?.status,'READY',text);
  assert.equal(parseCollaborationPlan('让Hermes整理虚构资料，ChatGPT负责分析，DSH复核').status,'UNSUPPORTED');
  assert.equal(parseCollaborationPlan('让Hermes整理虚构资料，ChatGPT不参与，DSH复核').status,'UNSUPPORTED');
  assert.equal(parseCollaborationPlan('让Hermes如果出错就循环整理虚构资料，DSH复核').status,'UNSUPPORTED');
});

test('quoted/code examples and incidental names do not create assignments; active lines retain offsets',()=>{
  const example='让Hermes负责整理虚构资料，DSH复核，ChatGPT不参与';
  for(const text of ['“'+example+'”','`'+example+'`','> '+example,'    '+example,'\t'+example,'```\n'+example+'\n```','Hermes 和 DSH 是参与者'])assert.equal(parseCollaborationPlan(text),null,text);
  const prefixed='    @全部 示例\n\n'+example;
  assert.equal(maskNonInstructions(prefixed).length,prefixed.length);assert.equal(parseCollaborationPlan(prefixed).instruction,'整理虚构资料');
  assert.equal(parseCollaborationPlan('让Hermes整理“DSH复核”这段例子'),null);
});

const owner={id:'local-owner',kind:'user'};
function persistedFixture(){
  mkdirSync('test-output',{recursive:true});const dir=mkdtempSync(resolve('test-output','text-plan-intent-')),file=join(dir,'workbench.sqlite');
  let w=new CollaborationCore(file);const p=w.project('虚构组合协作'),ws=w.workspace(p.id,'虚构持久计划'),ctx={projectId:p.id,workspaceId:ws.id};
  for(const role of ['hermes','deepseek','chatgpt'])w.bindSimulation(ctx,role,'虚构 '+role);
  w.control({paused:false});w.configure(ctx,{paused:false});let host=new TextCollaborationPlans(w);
  return {dir,file,ctx,get w(){return w;},get host(){return host;},run(text,extra={}){return executeCollaborationIntent(w,owner,ctx,{text,...extra},{planExecutor:host});},restart(){w.close();w=new CollaborationCore(file);w.recover();host=new TextCollaborationPlans(w);},supervisor(){return new WorkbenchSupervisor(w,new SimulationAdapter(w),{evidenceDir:join(dir,'simulated-evidence')});},close(){w.close();}};
}

test('actual SQLite Host preserves a natural owner/reviewer dependency across restart and completes only simulated review',async()=>{
  const f=persistedFixture();try {
    const text='让Hermes负责整理“虚构果园记录”，DSH复核，ChatGPT不参与',r=f.run(text);
    assert.equal(r.status,'EXECUTED');assert.equal(r.intent,'collaboration_plan');assert.equal(r.result.state,'WAITING_OWNER');
    const id=r.result.planId,taskId=r.result.ownerTaskId;
    assert.ok(id&&taskId);assert.equal(f.w.list('case').length,1);assert.deepEqual(f.w.list('delivery').map(d=>d.role),['hermes']);
    assert.deepEqual(f.host.get(owner,f.ctx,id).excludedIds,['chatgpt']);
    assert.match(f.w.get('case',taskId).body,/“虚构果园记录”/);
    const message=f.w.view(f.ctx).messages.find(m=>m.case_id===taskId);assert.equal(message.source.collaborationIntent.originalText,text);
    f.restart();assert.equal(f.host.get(owner,f.ctx,id).state,'WAITING_OWNER');assert.equal(f.host.get(owner,f.ctx,id).reviewItemId,null);
    const runner=f.supervisor();await runner.step('hermes',f.ctx);
    assert.equal(f.w.get('case',taskId).state,'awaiting_user_acceptance');f.host.tick();
    const plan=f.host.get(owner,f.ctx,id),review=f.w.owned(f.ctx,'case',plan.reviewItemId);
    assert.equal(plan.state,'REVIEW_QUEUED');assert.equal(review.parentCaseId,taskId);assert.deepEqual(review.reviewers,['deepseek']);
    assert.equal(review.assignee,null);assert.match(review.body,/负责人结果/);assert.match(review.body,/隔离模拟 Adapter/);
    await runner.step('deepseek',f.ctx);f.host.tick();assert.equal(f.host.get(owner,f.ctx,id).state,'REVIEW_APPROVED');
    assert.equal(f.host.get(owner,f.ctx,id).executionAuthorized,false);assert.equal(f.w.get('case',review.id).userAuthorized,false);
    assert.equal(f.w.db.prepare('SELECT count(*) n FROM authorizations').get().n,0);
    assert.deepEqual([...new Set(f.w.list('delivery').map(d=>d.role))].sort(),['deepseek','hermes']);
    const count=f.w.list('case').length;f.restart();f.host.tick();
    assert.equal(f.host.get(owner,f.ctx,id).reviewItemId,review.id);assert.equal(f.w.list('case').length,count);
    const current=f.w.get('case',review.id);
    f.w.reviseReview(f.ctx,current.id,{expectedRevision:current.revision,body:current.body+'\n虚构新增校验信息。'});
    const afterExplicitRevision=f.w.list('delivery').length;f.host.tick();
    const stale=f.host.get(owner,f.ctx,id);assert.equal(stale.state,'NEEDS_USER');assert.equal(stale.reviewItemId,review.id);
    assert.equal(f.w.list('case').length,count);assert.equal(f.w.list('delivery').length,afterExplicitRevision);
    assert.equal(stale.executionAuthorized,false);assert.equal(f.w.db.prepare('SELECT count(*) n FROM authorizations').get().n,0);
  } finally {f.close();}
});

test('UNKNOWN owner submission stays unresolved across restart and never queues its dependent review',async()=>{
  const f=persistedFixture();try {
    const r=f.run('让Hermes整理虚构记录完成后让DSH独立复核'),binding=f.w.binding(f.ctx,'hermes');
    assert.equal(r.status,'EXECUTED');f.w.put('sim_fault',binding.id,{mode:'submit_timeout',...f.ctx});
    await f.supervisor().step('hermes',f.ctx);f.host.tick();
    assert.equal(f.host.get(owner,f.ctx,r.result.planId).state,'OWNER_UNKNOWN');assert.equal(f.w.list('delivery')[0].state,'unknown');
    f.restart();await f.supervisor().step('hermes',f.ctx);f.host.tick();
    const plan=f.host.get(owner,f.ctx,r.result.planId);assert.equal(plan.state,'OWNER_UNKNOWN');assert.equal(plan.reviewItemId,null);
    assert.equal(f.w.list('case').length,1);assert.equal(f.w.list('delivery').length,1);assert.equal(f.w.list('mock_submission').length,1);
  } finally {f.close();}
});

test('the real plan hook preserves two-target knowledge permissions, scope isolation and pause without partial creation',()=>{
  const f=persistedFixture();try {
    const knowledge=f.w.createKnowledge(f.ctx.projectId,{kind:'fact',title:'虚构知识',body:'仅虚构公开资料'});
    f.w.shareKnowledge(f.ctx.projectId,knowledge.id,1,['hermes']);
    const text='让Hermes整理虚构资料，DSH复核';
    assert.throws(()=>f.run(text,{knowledgeRefs:[{id:knowledge.id,version:1}]}),/knowledge_recipient_not_authorized/);
    assert.equal(f.w.list('case').length,0);assert.equal(f.w.list('collaboration_plan').length,0);
    f.w.shareKnowledge(f.ctx.projectId,knowledge.id,1,['hermes','deepseek']);
    f.w.control({paused:false,rolePaused:{deepseek:true}});assert.equal(f.run(text).status,'UNSUPPORTED');assert.equal(f.w.list('case').length,0);
    f.w.control({paused:false,rolePaused:{deepseek:false}});const r=f.run(text,{knowledgeRefs:[{id:knowledge.id,version:1}]});assert.equal(r.status,'EXECUTED');
    const p=f.w.project('虚构外部项目'),ws=f.w.workspace(p.id,'虚构外部空间');
    assert.throws(()=>f.host.get(owner,{projectId:p.id,workspaceId:ws.id},r.result.planId),/entity_outside_workspace/);
    f.w.cancel(f.ctx,r.result.ownerTaskId);f.host.tick();assert.equal(f.host.get(owner,f.ctx,r.result.planId).state,'CANCELLED');assert.equal(f.w.list('case').length,1);
  } finally {f.close();}
});

test('a two-step plan cannot consume a root with delivery budget for only one step',()=>{
  const f=persistedFixture();try {
    const base=f.w.textTask(f.ctx,{body:'虚构单步预算任务',executor:'hermes',limits:{maxDeliveries:1}}),before=f.w.list('case').length;
    assert.throws(()=>f.run('让Hermes整理这个任务，DSH复核',{selectedItemId:base.id}),/two_step_delivery_budget/);
    assert.equal(f.w.list('case').length,before);assert.equal(f.w.list('collaboration_plan').length,0);assert.equal(f.w.list('delivery').length,1);
  } finally {f.close();}
});

test('natural plan status returns persisted scope-bound data and clarifies only an ambiguous object',()=>{
  const f=persistedFixture();try {
    const first=f.run('让Hermes整理虚构甲，DSH复核'),count=f.w.list('delivery').length;
    const status=f.run('查询当前协作计划状态');assert.equal(status.status,'EXECUTED');assert.equal(status.intent,'plan_status');
    assert.equal(status.result.readOnly,true);assert.equal(status.result.plan.id,first.result.planId);assert.equal(status.result.plan.state,'WAITING_OWNER');
    assert.equal(f.w.list('delivery').length,count);
    const second=f.run('让Hermes整理虚构乙，DSH复核');assert.equal(second.status,'EXECUTED');
    const ambiguous=f.run('协作进度');assert.equal(ambiguous.status,'CLARIFICATION_REQUIRED');assert.match(ambiguous.question,/哪个/);
    const selected=f.run('协作进度',{selectedItemId:second.result.ownerTaskId});assert.equal(selected.result.plan.id,second.result.planId);
    assert.equal(f.w.list('delivery').length,count+1);
    const unavailable=executeCollaborationIntent(f.w,owner,f.ctx,{text:'协作进度'});assert.equal(unavailable.status,'UNSUPPORTED');
  } finally {f.close();}
});
