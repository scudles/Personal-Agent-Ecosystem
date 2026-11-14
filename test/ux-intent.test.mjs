import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {CollaborationCore} from '../src/collaboration-core.mjs';
import {EngineeringContext} from '../engineering/context.mjs';
import {EngineeringDesktopApi} from '../engineering/desktop-api.mjs';
import {activeInstruction,executeCollaborationIntent} from '../src/collaboration-intent.mjs';

const owner={id:'local-owner',kind:'user'};
function fixture() {
  const w=new CollaborationCore(':memory:'),p=w.project('虚构UX意图'),ws=w.workspace(p.id,'独立模拟'),ctx={projectId:p.id,workspaceId:ws.id};
  for(const r of ['hermes','deepseek','chatgpt'])w.bindSimulation(ctx,r,'虚构 '+r);
  w.configure(ctx,{paused:false});w.control({paused:false});
  const run=(text,extra={})=>executeCollaborationIntent(w,owner,ctx,{text,...extra});
  return {w,ctx,run};
}
function task(f,body='虚构果园的文字任务'){return f.w.textTask(f.ctx,{title:'虚构任务',body,executor:'hermes'});}

test('bounded intent creates actual directed task, shares context and respects root budgets',()=>{
  const f=fixture();try {
    const base=task(f),r=f.run('让Hermes继续这个任务',{selectedItemId:base.id});
    assert.equal(r.status,'EXECUTED');assert.equal(r.intent,'delegate_task');
    assert.equal(r.result.parentCaseId,base.id);assert.equal(r.result.rootId,base.id);
    assert.doesNotMatch(r.result.body,new RegExp(base.id));assert.match(r.result.body,/虚构果园/);
    const message=f.w.view(f.ctx).messages.find(m=>m.case_id===r.result.id);
    assert.deepEqual(message.source.collaborationIntent,{originalText:'让Hermes继续这个任务',intent:'delegate_task',context:{itemId:base.id,revision:1,artifactHash:base.artifactHash}});
    assert.equal(f.w.list('delivery').filter(d=>d.caseId===r.result.id).length,1);
    assert.equal(r.result.userAuthorized,false);
    f.w.db.prepare('UPDATE item_budgets SET automatic_tasks=? WHERE root_id=?').run(base.limits.maxAutoTasks,base.id);
    const before=f.w.list('case').length;
    assert.throws(()=>f.run('让Hermes继续这个任务',{selectedItemId:base.id}),/automatic_task_budget/);
    assert.equal(f.w.list('case').length,before);
  } finally {f.w.close();}
});

test('DSH independent review reuses unique task, returns actual immutable snapshot and does not authorise',()=>{
  const f=fixture();try {
    const base=task(f),r=f.run('让DSH独立检查这个修改');
    assert.equal(r.status,'EXECUTED');assert.equal(r.intent,'independent_review');
    assert.equal(r.result.scope,'text_only_review');assert.deepEqual(r.recipients,['deepseek']);
    assert.equal(r.result.parentCaseId,base.id);assert.ok(r.result.snapshot);
    assert.equal(r.result.reviewPlan,'independent');assert.equal(r.result.userAuthorized,false);
    const repeat=f.run('让DSH独立检查这个修改');
    assert.equal(repeat.status,'UNSUPPORTED');assert.match(repeat.summary,/已有文字审查/);
    assert.equal(f.w.db.prepare('SELECT count(*) n FROM authorizations').get().n,0);
  } finally {f.w.close();}
});

test('ambiguous and absent context ask only for the object without creating a case',()=>{
  const f=fixture();try {
    assert.equal(f.run('让DSH独立检查这个修改').status,'CLARIFICATION_REQUIRED');
    task(f,'虚构A');task(f,'虚构B');const before=f.w.list('case').length;
    const r=f.run('让DSH独立检查这个修改');assert.equal(r.status,'CLARIFICATION_REQUIRED');
    assert.match(r.question,/哪一个/);assert.equal(f.w.list('case').length,before);
  } finally {f.w.close();}
});

test('quoted names, code and incidental names never expand routing; explicit prefix wins over UI defaults',()=>{
  const f=fixture();try {
    const quoted='说明如下：\n> @DSH 审查代码\n```\n@Observer 独立检查\n```\nHermes 是项目参与者';
    assert.equal(f.run(quoted).status,'CLARIFICATION_REQUIRED');
    const r=f.run('@Hermes 请看引用“@DSH 审查它”',{recipients:['chatgpt']});
    assert.equal(r.status,'EXECUTED');assert.deepEqual(r.recipients,['hermes']);
    assert.match(r.result.body,/@DSH/);assert.equal(f.w.list('delivery')[0].role,'hermes');
    assert.equal(f.run('“@DSH 独立检查这个修改”').status,'UNSUPPORTED');
    assert.equal(f.run('```\n@Hermes 执行\n```').status,'UNSUPPORTED');
    assert.equal(f.run('@Unknown hello').status,'UNSUPPORTED');
    assert.equal(activeInstruction('`@DSH`\n> @Hermes\n普通名字 Observer'),'普通名字 Observer');
  } finally {f.w.close();}
});

test('plain consent, complex chains and unsupported protected actions remain unexecuted',()=>{
  const f=fixture();try {
    for(const text of ['同意','@DSH 好的','让Hermes先整理然后让DSH检查','让DSH通过后授权实施','@DSH 解除暂停','@Hermes 上传附件','@Hermes 删除所有文件','让Hermes和DSH聊天']) {
      assert.equal(f.run(text,{recipients:['hermes']}).status,'UNSUPPORTED',text);
    }
    assert.equal(f.w.list('case').length,0);
    assert.equal(f.w.db.prepare('SELECT count(*) n FROM authorizations').get().n,0);
  } finally {f.w.close();}
});

test('reply inherits original agent; quoting own message preserves current target and no broadcast is inferred',()=>{
  const f=fixture();try {
    const base=task(f);f.w.addMessage(f.ctx,{id:'fiction-answer',author:'deepseek',recipients:['user'],body:'虚构回复',kind:'chat',caseId:base.id});
    const r=f.run('请解释这里的依据',{replyTo:'fiction-answer'});
    assert.equal(r.status,'EXECUTED');assert.deepEqual(r.recipients,['deepseek']);assert.equal(r.result.replyTo,'fiction-answer');
    f.w.configure(f.ctx,{recipients:['hermes']});
    const own=f.run('继续沟通',{replyTo:'request:'+base.id});assert.deepEqual(own.recipients,['hermes']);
    f.w.configure(f.ctx,{recipients:['hermes','chatgpt']});
    assert.equal(f.run('普通文字').status,'CLARIFICATION_REQUIRED');
    assert.throws(()=>f.run('普通文字',{recipients:['all']}),/recipients/);
  } finally {f.w.close();}
});

test('summary is a real directed request and cannot be reported as a generated summary',()=>{
  const f=fixture();try {
    task(f);
    f.w.addMessage(f.ctx,{id:'fiction-history',author:'user',recipients:['hermes'],body:'虚构讨论：果树需要浇水',kind:'chat'});
    const r=f.run('请Hermes总结当前讨论');
    assert.equal(r.intent,'request_summary');assert.equal(r.status,'EXECUTED');
    assert.match(r.result.body,/果树需要浇水/);assert.match(r.summary,/尚未收到/);
    assert.equal(f.w.get('case',r.result.id).state,'chat_queued');
    assert.equal(r.result.parentCaseId,null);
  } finally {f.w.close();}
});

test('task status is a read-only real query and preserves UNKNOWN and pause reasons',()=>{
  const f=fixture();try {
    const base=task(f),d=f.w.list('delivery')[0];f.w.put('delivery',d.id,{...d,state:'unknown',reason:'fiction-uncertain'});
    const count=f.w.list('case').length,r=f.run('查询当前任务状态');
    assert.equal(r.status,'EXECUTED');assert.equal(r.intent,'task_status');assert.equal(r.result.readOnly,true);
    assert.equal(r.result.item.id,base.id);assert.equal(r.result.deliveries[0].state,'unknown');
    assert.match(r.summary,/未知/);assert.equal(f.w.list('case').length,count);
    const policy=f.run('按MAG说明第三方是否需要');assert.equal(policy.intent,'review_policy');
    assert.equal(policy.result.riskAssessment,'NOT_INFERRED');assert.equal(policy.result.version,'MAG-001');
  } finally {f.w.close();}
});

test('scope, owner, pause, binding and knowledge authorisation continue through original core',()=>{
  const f=fixture();try {
    assert.throws(()=>executeCollaborationIntent(f.w,{id:'agent',kind:'agent'},f.ctx,{text:'hello'}),/owner_permission/);
    const p=f.w.project('虚构异项目'),ws=f.w.workspace(p.id,'虚构异会话'),other={projectId:p.id,workspaceId:ws.id};
    f.w.bindSimulation(other,'hermes','虚构隔离');const alien=f.w.textTask(other,{body:'异会话',executor:'hermes'});
    assert.throws(()=>f.run('查询当前任务状态',{selectedItemId:alien.id}),/entity_outside_workspace/);
    for(const pause of [{paused:true},{paused:false,rolePaused:{hermes:true}}]) {
      f.w.control(pause);assert.equal(f.run('@Hermes 普通文字').status,'UNSUPPORTED');
    }
    f.w.control({paused:false,rolePaused:{hermes:false}});f.w.configure(f.ctx,{paused:true});
    assert.equal(f.run('@Hermes 普通文字').status,'UNSUPPORTED');f.w.configure(f.ctx,{paused:false});
    const k=f.w.createKnowledge(f.ctx.projectId,{kind:'fact',title:'虚构知识',body:'虚构已知字段'});
    assert.throws(()=>f.run('@Hermes 引用知识',{knowledgeRefs:[{id:k.id,version:1}]}),/knowledge_not_authorized/);
    f.w.shareKnowledge(f.ctx.projectId,k.id,1,['hermes']);
    const r=f.run('@Hermes 引用知识',{knowledgeRefs:[{id:k.id,version:1}]});assert.equal(r.result.knowledgeRefs[0].id,k.id);
    f.w.pauseBinding(f.ctx,'deepseek',true);assert.throws(()=>f.run('@DSH hello'),/paused_or_real_locked/);
  } finally {f.w.close();}
});

function engineeringFixture() {
  mkdirSync('test-output',{recursive:true});const dir=mkdtempSync(resolve('test-output','ux-intent-materials-')),source=join(dir,'sources');
  mkdirSync(source);writeFileSync(join(source,'fiction.txt'),'Fictional orchard only.\n');
  const f=fixture(),e=new EngineeringContext(f.w,{storePath:join(dir,'store'),allowedSourceRoots:[source]}),materials=new EngineeringDesktopApi(e),base=task(f);
  const s=e.registerSource(owner,f.ctx,{path:source,repositoryType:'directory'}),snapshot=e.snapshot(owner,f.ctx,s.id);
  const pkg=e.createPackage(owner,f.ctx,{taskId:base.id,snapshotId:snapshot.id,objective:'虚构流程核对',acceptanceCriteria:['仅检查模拟材料'],recipients:[]});
  const run=(text,extra={})=>executeCollaborationIntent(f.w,owner,f.ctx,{text,...extra},{materials});
  return {...f,e,materials,base,pkg,run};
}
test('registered engineering review reuses exact task/package and creates only real simulated queue IDs',()=>{
  const f=engineeringFixture();try {
    const definition={ownerId:'hermes',riskLevel:'L1',riskBasis:'虚构局部API流程',kind:'api_change',reviewerIds:['deepseek'],goal:'虚构流程核对',scope:'仅虚构材料',acceptanceCriteria:['流程准确']};
    assert.equal(f.materials.governance.register(owner,f.ctx,{taskId:f.base.id,definition}).blocked,false);
    const r=f.run('让DSH独立检查这个修改',{selectedItemId:f.base.id});
    assert.equal(r.status,'EXECUTED');assert.equal(r.result.round.taskId,f.base.id);
    assert.equal(r.result.round.packageId,f.pkg.id);assert.ok(r.result.round.id);assert.ok(r.result.attempts[0].id);
    assert.equal(r.result.attempts[0].state,'QUEUED');assert.equal(r.result.attempts[0].submission_count,0);
    assert.equal(r.result.realAgentReceived,false);assert.equal(r.result.executionAuthorized,false);
    assert.equal(f.e.db.prepare('SELECT count(*) n FROM uec_exchange_receipts').get().n,0);
    const attempt=r.result.attempts[0];f.e.db.prepare("UPDATE uec_exchange_attempts SET state='UNKNOWN' WHERE id=?").run(attempt.id);
    const again=f.run('让DSH独立检查这个修改',{packageId:f.pkg.id,packageVersion:1});
    assert.equal(again.result.readOnly,true);assert.equal(again.result.attempts[0].state,'UNKNOWN');
    assert.equal(f.e.db.prepare('SELECT count(*) n FROM uec_governance_rounds').get().n,1);
    assert.equal(f.e.db.prepare('SELECT count(*) n FROM uec_exchange_attempts').get().n,1);
  } finally {f.w.close();}
});

test('engineering review never guesses missing governance or version and does not silently become text review',()=>{
  const f=engineeringFixture();try {
    const r=f.run('让DSH独立检查这个修改',{packageId:f.pkg.id,packageVersion:1});
    assert.equal(r.status,'CLARIFICATION_REQUIRED');assert.match(r.question,/治理入口/);
    assert.equal(f.run('让DSH独立检查这个修改',{packageId:f.pkg.id}).status,'CLARIFICATION_REQUIRED');
    assert.equal(f.e.db.prepare('SELECT count(*) n FROM uec_exchange_attempts').get().n,0);
    assert.equal(f.w.list('case').length,1);
  } finally {f.w.close();}
});

test('a self-contained new text task does not inherit the sole governed engineering root; explicit continuation still uses Host',()=>{
  const f=engineeringFixture();try {
    const definition={ownerId:'hermes',riskLevel:'L1',riskBasis:'虚构局部API流程',kind:'api_change',reviewerIds:['deepseek'],goal:'虚构流程核对',scope:'仅虚构材料',acceptanceCriteria:['流程准确']};
    assert.equal(f.materials.governance.register(owner,f.ctx,{taskId:f.base.id,definition}).blocked,false);
    const before=f.w.list('case').length;
    assert.throws(()=>f.run('让Hermes继续这个工程任务'),/collaboration_engineering_host_required/);
    assert.equal(f.w.list('case').length,before);
    const text='让Hermes负责整理虚构颜色说明，只输出文字。',r=f.run(text);
    assert.equal(r.status,'EXECUTED');assert.equal(r.intent,'delegate_task');assert.equal(r.result.parentCaseId,null);
    assert.equal(r.result.rootId,r.result.id);assert.equal(r.result.body,text);
    const message=f.w.view(f.ctx).messages.find(m=>m.case_id===r.result.id);
    assert.deepEqual(message.source.collaborationIntent.context,{});
    assert.throws(()=>f.run('让Hermes继续这个工程任务',{selectedItemId:f.base.id}),/collaboration_engineering_host_required/);
    assert.equal(f.w.list('case').length,before+1);
  } finally {f.w.close();}
});

test('这份 and 这段 are explicit references only when their scoped object is unique or selected',()=>{
  const f=fixture();try {
    assert.equal(f.run('让Hermes整理这份材料').status,'CLARIFICATION_REQUIRED');
    const base=task(f,'虚构段落原文'),r=f.run('让Hermes整理这段文字');
    assert.equal(r.status,'EXECUTED');assert.equal(r.result.parentCaseId,base.id);assert.match(r.result.body,/虚构段落原文/);
    const before=f.w.list('case').length;
    assert.equal(f.run('让Hermes整理这份材料').status,'CLARIFICATION_REQUIRED');assert.equal(f.w.list('case').length,before);
    const selected=f.run('让Hermes整理这份材料',{selectedItemId:base.id});assert.equal(selected.status,'EXECUTED');assert.equal(selected.result.parentCaseId,base.id);
  } finally {f.w.close();}
});

test('formal inline text review executes the retained workflow without authorising execution',()=>{
  const f=fixture();try {
    const r=f.run('@DSH 正式文字审查：虚构算式 2+2=4');assert.equal(r.status,'EXECUTED');
    assert.equal(r.intent,'formal_text_review');assert.equal(r.result.scope,'text_only_review');assert.equal(r.result.userAuthorized,false);
  } finally {f.w.close();}
});

test('independent text review never assigns the task owner as its own reviewer',()=>{
  const f=fixture();try {
    const base=task(f),r=f.run('让Hermes独立检查这个修改',{selectedItemId:base.id});
    assert.equal(r.status,'CLARIFICATION_REQUIRED');assert.match(r.question,/区别于/);
    assert.equal(f.w.list('case').length,1);
  } finally {f.w.close();}
});

test('context and summary cannot disclose incomplete independent opinions to another agent',()=>{
  const f=fixture();try {
    const item=f.w.createReview(f.ctx,{title:'虚构分阶段复核',body:'虚构材料',reviewers:['deepseek','hermes'],reviewPlan:'independent_then_cross',crossReviewers:['deepseek','hermes']});
    f.w.addMessage(f.ctx,{id:'fiction-private-initial',author:'deepseek',recipients:['user'],body:'虚构初始意见',kind:'review_result',caseId:item.id});
    assert.equal(f.run('@Hermes 总结当前讨论').status,'UNSUPPORTED');
    assert.equal(f.run('@Hermes 请解释所选消息',{selectedMessageId:'fiction-private-initial'}).status,'UNSUPPORTED');
    assert.equal(f.w.list('case').length,1);
  } finally {f.w.close();}
});

test('P1-UX-ISOLATION-001 default independent reviews with one opinion cannot be summarised, quoted or relayed',()=>{
  const f=fixture();try {
    const item=f.w.createReview(f.ctx,{title:'虚构默认独立复核',body:'虚构原始材料',reviewers:['deepseek','hermes']});
    assert.equal(item.reviewPlan,'independent');
    item.votes.deepseek={verdict:'approve',raw:'DSH虚构首轮意见'};f.w.put('case',item.id,item);
    f.w.addMessage(f.ctx,{id:'fiction-default-initial',author:'deepseek',recipients:['user'],body:'DSH虚构首轮意见',kind:'review_result',caseId:item.id});
    assert.equal(f.w.firstComplete(item),false);
    const beforeCases=f.w.list('case').length,beforeDeliveries=f.w.list('delivery').length;
    const requests=[
      ['@Hermes 总结当前讨论',{}],
      ['@Hermes 总结当前任务',{}],
      ['@Hermes 总结所选消息',{selectedMessageId:'fiction-default-initial'}],
      ['@Hermes 请解释所选消息',{selectedMessageId:'fiction-default-initial'}],
      ['@Hermes 这段引用供你参考',{replyTo:'fiction-default-initial'}],
      ['让Hermes整理所选消息',{selectedMessageId:'fiction-default-initial'}]
    ];
    for(const [text,context] of requests) {
      const r=f.run(text,context);assert.equal(r.status,'UNSUPPORTED',text);assert.match(r.summary,/独立初始意见/);
      assert.equal(f.w.list('case').length,beforeCases);assert.equal(f.w.list('delivery').length,beforeDeliveries);
    }
    // Both initial opinions now exist. Only the explicit summary/share request
    // below creates a new action; the completion update does not disclose them.
    item.votes.hermes={verdict:'approve',raw:'Hermes虚构首轮意见'};f.w.put('case',item.id,item);
    assert.equal(f.w.list('case').length,beforeCases);
    const shared=f.run('@Hermes 总结当前讨论');assert.equal(shared.status,'EXECUTED');assert.match(shared.result.body,/DSH虚构首轮意见/);
  } finally {f.w.close();}
});

test('P1-UX-ROUTING-001 Markdown examples cannot promote @all into a broadcast and active prose remains usable',()=>{
  const f=fixture();try {
    f.w.configure(f.ctx,{participants:['hermes','deepseek']});
    const examples=['```text\n@全部 示例文本\n```','`@全部 示例文本`','> @全部 示例文本','    @全部 示例文本','\t@全部 示例文本','   \t@all 示例文本'];
    for(const example of examples) {
      assert.equal(activeInstruction(example),'',JSON.stringify(example));
      assert.equal(f.run(example).status,'UNSUPPORTED',JSON.stringify(example));
      assert.equal(f.w.list('case').length,0);assert.equal(f.w.list('delivery').length,0);
      const prose='普通活跃段落\n\n'+example+'\n\n继续普通段落';
      assert.match(activeInstruction(prose),/普通活跃段落/);assert.doesNotMatch(activeInstruction(prose),/@全部|@all/);
      assert.equal(f.run(prose).status,'CLARIFICATION_REQUIRED');assert.equal(f.w.list('case').length,0);
    }
    const directed=f.run('    @全部 示例文本\n\n@Hermes 这是明确的普通交流');
    assert.equal(directed.status,'EXECUTED');assert.deepEqual(directed.recipients,['hermes']);
    const broadcast=f.run('@all 这是明确的普通交流');assert.equal(broadcast.status,'EXECUTED');
    assert.deepEqual([...broadcast.recipients].sort(),['deepseek','hermes']);
    assert.equal(f.w.list('delivery').filter(d=>d.caseId===broadcast.result.id).length,2);
  } finally {f.w.close();}
});

test('@全部 and @all deliver to every current participant atomically and never skip unavailable targets',()=>{
  const f=fixture();try {
    f.w.configure(f.ctx,{participants:['hermes','deepseek']});
    for(const prefix of ['@全部','@all']) {
      const r=f.run(prefix+' 这是普通交流');assert.equal(r.status,'EXECUTED');
      assert.deepEqual([...r.recipients].sort(),['deepseek','hermes']);
      assert.equal(f.w.list('delivery').filter(d=>d.caseId===r.result.id).length,2);
    }
    f.w.pauseBinding(f.ctx,'deepseek',true);const before=f.w.list('case').length;
    const blocked=f.run('@全部 这是普通交流');assert.equal(blocked.status,'UNSUPPORTED');assert.match(blocked.summary,/deepseek|DeepSeek/);
    assert.equal(f.w.list('case').length,before);
    f.w.pauseBinding(f.ctx,'deepseek',false);f.w.configure(f.ctx,{participants:['hermes','deepseek','chatgpt']});
    f.w.db.prepare('DELETE FROM bindings WHERE workspace_id=? AND agent_id=?').run(f.ctx.workspaceId,'chatgpt');
    assert.equal(f.run('@all 这是普通交流').status,'UNSUPPORTED');assert.equal(f.w.list('case').length,before);
    assert.equal(f.run('引用“@全部”只是说明').status,'CLARIFICATION_REQUIRED');
  } finally {f.w.close();}
});

test('formal user approval never becomes chat or authorisation while review initiation calls the real review workflow',()=>{
  const f=fixture();try {
    const base=task(f);
    for(const text of ['我正式批准这个方案','我批准这个方案','正式批准这个方案']) {
      const r=f.run(text,{recipients:['deepseek'],selectedItemId:base.id});assert.equal(r.status,'UNSUPPORTED');assert.match(r.summary,/未被记录|未执行/);
    }
    assert.equal(f.w.list('case').length,1);assert.equal(f.w.db.prepare('SELECT count(*) n FROM authorizations').get().n,0);
    const r=f.run('请发起审批',{recipients:['deepseek'],selectedItemId:base.id});
    assert.equal(r.status,'EXECUTED');assert.equal(r.intent,'formal_text_review');assert.equal(r.result.scope,'text_only_review');assert.equal(r.result.userAuthorized,false);
    assert.equal(f.w.view(f.ctx).messages.find(m=>m.case_id===r.result.id).source.collaborationIntent.originalText,'请发起审批');
    const duplicate=f.run('发起正式审批',{recipients:['deepseek'],selectedItemId:base.id});assert.equal(duplicate.status,'UNSUPPORTED');
  } finally {f.w.close();}
});

test('multiple Agent assignments without a persistent executor remain entirely unexecuted; ordinary names are not assignments',()=>{
  const f=fixture();try {
    for(const text of ['让Hermes负责实现，DSH复核，ChatGPT暂不参与','让Hermes整理；请DSH复核','@Hermes 负责分析。Observer参与审查','让Hermes整理资料并由DSH复核','让Hermes整理资料、DSH复核','让Hermes整理资料，DSH检查所有文件']) {
      const r=f.run(text);assert.equal(r.status,'UNSUPPORTED',text);assert.match(r.summary,/多个Agent分工|多步|持久协作调度/);
    }
    assert.equal(f.w.list('case').length,0);
    const ordinary=f.run('@Hermes 文档中提到了 DSH 的名字，这不是分工');assert.equal(ordinary.status,'EXECUTED');assert.deepEqual(ordinary.recipients,['hermes']);
  } finally {f.w.close();}
});

test('a broken plan hook cannot announce execution or leave a partial owner task',()=>{
  const f=fixture();try {
    const executor={create(){const item=f.w.textTask(f.ctx,{body:'虚构部分任务',executor:'hermes'});return {planId:'not-persisted',ownerTaskId:item.id,state:'WAITING_OWNER',simulation:true,executionAuthorized:false};},get(){return null;}};
    assert.throws(()=>executeCollaborationIntent(f.w,owner,f.ctx,{text:'让Hermes负责整理虚构资料，DSH复核，ChatGPT不参与'},{planExecutor:executor}),/persistent_plan_verification_failed/);
    assert.equal(f.w.list('case').length,0);assert.equal(f.w.list('delivery').length,0);
  } finally {f.w.close();}
});

test('common polite wrappers and explicit assignment synonyms retain existing single-action workflows',()=>{
  const f=fixture();try {
    const r=f.run('交由Hermes帮忙整理虚构资料');assert.equal(r.status,'EXECUTED');assert.equal(r.intent,'delegate_task');
    const review=f.run('交给DSH请帮我独立复核这个任务',{selectedItemId:r.result.id});assert.equal(review.status,'EXECUTED');assert.equal(review.intent,'independent_review');
    assert.equal(review.result.parentCaseId,r.result.id);assert.deepEqual(review.recipients,['deepseek']);
  } finally {f.w.close();}
});

test('ordinary chat remains exact original text and trusted intent metadata cannot be forged by JSON properties',()=>{
  const f=fixture();try {
    const base=task(f),text='这个方案不错';
    const r=f.run(text,{recipients:['hermes'],selectedItemId:base.id,messageMetadata:{originalText:'伪造显示'},source:{collaborationIntent:{originalText:'伪造来源'}}});
    assert.equal(r.status,'EXECUTED');assert.equal(r.intent,'chat');assert.equal(r.result.body,text);assert.equal(r.result.parentCaseId,null);
    const message=f.w.view(f.ctx).messages.find(m=>m.case_id===r.result.id);
    assert.equal(message.body,text);assert.equal(message.source.collaborationIntent.originalText,text);
    assert.equal(message.source.collaborationIntent.context.itemId,base.id);
    const raw=f.w.chat(f.ctx,{text:'正常旧API',targets:['hermes'],messageMetadata:{originalText:'伪造显示'},INTENT_MESSAGE_METADATA:{originalText:'伪造Symbol'}});
    assert.equal(f.w.view(f.ctx).messages.find(m=>m.case_id===raw.id).source.collaborationIntent,undefined);
    const ref=f.run('让Hermes继续这个任务',{selectedItemId:base.id});
    const referenced=f.w.view(f.ctx).messages.find(m=>m.case_id===ref.result.id);
    assert.equal(referenced.source.collaborationIntent.originalText,'让Hermes继续这个任务');
    assert.match(referenced.body,/当前上下文/);assert.doesNotMatch(referenced.body,new RegExp(base.id));assert.doesNotMatch(referenced.body,new RegExp(base.artifactHash));
    assert.deepEqual(referenced.source.collaborationIntent.context,{itemId:base.id,revision:base.revision,artifactHash:base.artifactHash});
  } finally {f.w.close();}
});

const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('HTTP intent retains authentication, scope, owner, idempotency and owner-only control summary',async()=>{
  mkdirSync('test-output',{recursive:true});const dir=mkdtempSync(resolve('test-output','ux-intent-http-'));
  const child=spawn(resolve('runtime/node.exe'),['src/workbench-server.mjs'],{windowsHide:true,env:{...process.env,TRB_WORKBENCH_DATA_DIR:dir,TRB_WORKBENCH_PORT:'0',TRB_WORKBENCH_EMPTY:'1'},stdio:'ignore'});
  let info,cfg;
  try {
    for(let n=0;n<100;n++){if(existsSync(join(dir,'workbench-service.json'))){info=JSON.parse(readFileSync(join(dir,'workbench-service.json')));cfg=JSON.parse(readFileSync(join(dir,'workbench-config.json')));break;}await delay(100);}
    assert.ok(info);
    const call=async(path,body,token=cfg.token,key)=>{const r=await fetch(info.url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});return {status:r.status,body:await r.json()};};
    const p=(await call('/api/projects',{name:'虚构HTTP意图'})).body,ws=(await call('/api/projects/'+p.id+'/workspaces',{name:'虚构窗口'})).body,path='/api/workspaces/'+ws.id;
    await call(path+'/bind-simulation',{projectId:p.id,agentId:'hermes',title:'虚构模拟'});await call(path+'/configure',{projectId:p.id,paused:false});
    const request={projectId:p.id,text:'让Hermes整理虚构文字'};
    assert.equal((await call(path+'/intent',request,'not-authorised')).status,401);
    const a=await call(path+'/intent',request,undefined,'ux-intent-http-001'),b=await call(path+'/intent',request,undefined,'ux-intent-http-001');
    assert.equal(a.status,200);assert.equal(a.body.status,'EXECUTED');assert.equal(a.body.result.id,b.body.result.id);
    assert.equal((await call(path+'/intent',{...request,text:'不同请求'},undefined,'ux-intent-http-001')).status,400);
    const token=(await call(path+'/issue-simulation-token',{projectId:p.id,agentId:'hermes'})).body.token;
    assert.equal((await call(path+'/intent',request,token)).status,403);
    const view=(await call(path+'?projectId='+p.id)).body;
    assert.deepEqual(view.controlSummary,{paused:false,rolePaused:{hermes:false,deepseek:false,chatgpt:false}});
    assert.equal((await call(path+'?projectId='+p.id,undefined,token)).body.controlSummary,undefined);
    assert.equal((await call(path+'/intent',{...request,projectId:'wrong-project'})).status,400);
    await call('/api/service/stop',{});
    for(let n=0;n<100&&child.exitCode===null;n++)await delay(100);
    assert.equal(child.exitCode,0);
  } finally {if(child.exitCode===null)child.kill();}
});
