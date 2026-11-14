import test from'node:test';import assert from'node:assert/strict';import{join}from'node:path';import{CollaborationCore}from'../src/collaboration-core.mjs';import{start,stop,sleep}from'./offline-service-helper.mjs';
test('authenticated plan intent is persistent, idempotent, scoped and cannot invite an excluded party',async()=>{let s=await start();try{const project=(await s.call('/api/projects',{name:'虚构组合API项目'})).body,ws=(await s.call('/api/projects/'+project.id+'/workspaces',{name:'虚构组合API窗口'})).body,path='/api/workspaces/'+ws.id,ctx={projectId:project.id};for(const role of ['hermes','deepseek','chatgpt'])await s.call(path+'/bind-simulation',{...ctx,agentId:role});await s.call(path+'/configure',{...ctx,paused:false});const body={...ctx,text:'让Hermes负责整理虚构数组说明，DSH复核，ChatGPT不参与'};const first=await s.call(path+'/intent',body,'collab002-idempotent-plan');assert.equal(first.status,200);assert.equal(first.body.status,'EXECUTED');const planId=first.body.result.planId;assert.ok(planId);const repeated=await s.call(path+'/intent',body,'collab002-idempotent-plan');assert.deepEqual(repeated.body,first.body);const folder=s.folder;await stop(s);s=await start(folder);let view=(await s.call(path+'?projectId='+project.id)).body;assert.equal(view.collaborationPlans.length,1);assert.equal(view.collaborationPlans[0].id,planId);assert.ok(view.deliveries.every(d=>d.role!=='chatgpt'));const foreign=(await s.call('/api/projects',{name:'虚构另一项目'})).body;assert.equal((await s.call(path+'/plan-cancel',{projectId:foreign.id,planId})).status,400);const cancelled=await s.call(path+'/plan-cancel',{...ctx,planId});assert.equal(cancelled.body.state,'CANCELLED');view=(await s.call(path+'?projectId='+project.id)).body;assert.equal(view.collaborationPlans[0].state,'CANCELLED');assert.equal(view.collaborationPlans[0].executionAuthorized,false);}finally{await stop(s);}});
test('same-directory recovery preserves global and role pause even when EMPTY bootstrap flag remains set',async()=>{let s=await start();const folder=s.folder;try{await stop(s);const w=new CollaborationCore(join(folder,'workbench.sqlite'));try{w.control({paused:true,rolePaused:{hermes:true},reason:'fictitious persistence probe'});}finally{w.close();}s=await start(folder);const project=(await s.call('/api/projects',{name:'虚构暂停恢复'})).body,ws=(await s.call('/api/projects/'+project.id+'/workspaces',{name:'虚构暂停窗口'})).body;let view=(await s.call('/api/workspaces/'+ws.id+'?projectId='+project.id)).body;assert.equal(view.controlSummary.paused,true);assert.equal(view.controlSummary.rolePaused.hermes,true);await stop(s,true);s=await start(folder);view=(await s.call('/api/workspaces/'+ws.id+'?projectId='+project.id)).body;assert.equal(view.controlSummary.paused,true);assert.equal(view.controlSummary.rolePaused.hermes,true);}finally{await stop(s);}});
test('legacy HTTP review cannot bypass public governance and returns four-field scoped explanation',async()=>{const s=await start();try{const p=(await s.call('/api/projects',{name:'虚构治理API'})).body,ws=(await s.call('/api/projects/'+p.id+'/workspaces',{name:'虚构治理API窗口'})).body,path='/api/workspaces/'+ws.id,ctx={projectId:p.id};for(const role of ['hermes','deepseek'])await s.call(path+'/bind-simulation',{...ctx,agentId:role});await s.call(path+'/configure',{...ctx,paused:false});const bad=await s.call(path+'/reviews',{...ctx,title:'虚构重复复核者',body:'只审文字',reviewers:['deepseek','deepseek']});assert.equal(bad.status,400);assert.ok(bad.body.governance);for(const field of ['request','rule','impact','alternative'])assert.ok(typeof bad.body.governance[field]==='string'&&bad.body.governance[field].length>0);const view=(await s.call(path+'?projectId='+p.id)).body;assert.ok(view.governanceWarnings.length>0);assert.equal(view.items.length,0);}finally{await stop(s);}});

test('P1-COLLAB-ENTRY-001 legacy HTTP task/review preserve known engineering source instead of detaching into new roots',async()=>{
  const s=await start();try{
    const p=(await s.call('/api/projects',{name:'虚构消息工程治理'})).body,ws=(await s.call('/api/projects/'+p.id+'/workspaces',{name:'虚构消息工程窗口'})).body,path='/api/workspaces/'+ws.id,ctx={projectId:p.id};
    for(const agentId of ['hermes','deepseek'])assert.equal((await s.call(path+'/bind-simulation',{...ctx,agentId})).status,200);
    const task=(await s.call(path+'/tasks',{...ctx,title:'虚构工程消息原事项',body:'虚构文字任务，不执行代码。',executor:'hermes'})).body;
    const registered=await s.call(path+'/materials-governance-register',{...ctx,taskId:task.id,definition:{ownerId:'hermes',riskLevel:'L1',riskBasis:'虚构局部API边界',kind:'api_change',reviewerIds:['deepseek'],goal:'虚构材料核对',scope:'仅本事项',acceptanceCriteria:['保持来源准确']}});
    assert.equal(registered.status,200);assert.equal(registered.body.blocked,false);
    const sourceMessageId='request:'+task.id;
    const followup=await s.call(path+'/tasks',{...ctx,title:'不能脱离工程Host',body:'已知来源必须进入原治理',executor:'hermes',sourceMessageId});
    assert.equal(followup.status,400);assert.match(followup.body.error,/engineering_host_required/);
    const review=await s.call(path+'/reviews',{...ctx,title:'不能脱离工程Host复核',body:'已知工程消息',reviewers:['deepseek'],sourceMessageId});
    assert.equal(review.status,400);assert.match(review.body.error,/engineering_host_required/);
    const view=(await s.call(path+'?projectId='+p.id)).body;assert.equal(view.items.length,1);assert.equal(view.deliveries.length,1);
  }finally{await stop(s);}
});

test('P1-COLLAB-ENTRY-001 HTTP resolves the real source author, checks parent/scope, and persists a legal source link',async()=>{
  const s=await start();try{
    const p=(await s.call('/api/projects',{name:'虚构来源作者API'})).body,ws=(await s.call('/api/projects/'+p.id+'/workspaces',{name:'虚构来源作者窗口'})).body,path='/api/workspaces/'+ws.id,ctx={projectId:p.id};
    for(const agentId of ['hermes','deepseek'])await s.call(path+'/bind-simulation',{...ctx,agentId});
    await s.call(path+'/configure',{...ctx,paused:false});
    const chat=(await s.call(path+'/chat',{...ctx,text:'虚构来源作者检查',recipients:['hermes']})).body;
    let source;
    for(let n=0;n<100;n++){const view=(await s.call(path+'?projectId='+p.id)).body;source=view.messages.find(m=>m.case_id===chat.id&&m.author==='hermes');if(source)break;await sleep(100);}
    assert.ok(source,'the simulated Hermes source reply must actually exist');
    const sourceMessageId=source.id,reviewBody={...ctx,title:'虚构已知消息复核',body:source.body,sourceMessageId};
    const self=await s.call(path+'/reviews',{...reviewBody,reviewers:['hermes'],sourceAuthorId:'deepseek'});assert.equal(self.status,400);assert.match(self.body.error,/self_review/);
    const other=(await s.call(path+'/chat',{...ctx,text:'虚构不同父项',recipients:['hermes']})).body;
    for(const action of ['tasks','reviews']){
      const payload=action==='tasks'?{body:'虚构任务',executor:'deepseek'}:{title:'虚构复核',body:'虚构材料',reviewers:['deepseek']};
      const conflict=await s.call(path+'/'+action,{...ctx,...payload,sourceMessageId,parentCaseId:other.id});assert.equal(conflict.status,400);assert.match(conflict.body.error,/source_message_parent_conflict/);
      const missing=await s.call(path+'/'+action,{...ctx,...payload,sourceMessageId:'missing-source'});assert.equal(missing.status,400);assert.match(missing.body.error,/message_outside_workspace/);
    }
    const foreign=(await s.call('/api/projects/'+p.id+'/workspaces',{name:'虚构其他来源窗口'})).body,foreignPath='/api/workspaces/'+foreign.id;
    for(const agentId of ['hermes','deepseek'])await s.call(foreignPath+'/bind-simulation',{...ctx,agentId});
    const cross=await s.call(foreignPath+'/reviews',{...reviewBody,reviewers:['deepseek']});assert.equal(cross.status,400);assert.match(cross.body.error,/message_outside_workspace/);
    const legal=await s.call(path+'/reviews',{...reviewBody,reviewers:['deepseek'],sourceAuthorId:'deepseek'});assert.equal(legal.status,200);assert.equal(legal.body.parentCaseId,chat.id);
    const view=(await s.call(path+'?projectId='+p.id)).body,request=view.messages.find(m=>m.case_id===legal.body.id&&m.author==='user');
    assert.equal(request.source.sourceMessageId,sourceMessageId);assert.equal(request.source.parentCaseId,chat.id);
    assert.deepEqual(legal.body.reviewers,['deepseek']);
    const followup=await s.call(path+'/tasks',{...ctx,body:'虚构合法后续文字任务',executor:'deepseek',sourceMessageId,sourceAuthorId:'chatgpt'});assert.equal(followup.status,200);assert.equal(followup.body.parentCaseId,chat.id);
    assert.equal((await s.call(path+'?projectId='+p.id)).body.messages.find(m=>m.case_id===followup.body.id).source.sourceMessageId,sourceMessageId);
  }finally{await stop(s);}
});

test('P1-COLLAB-ENTRY-001 HTTP revisions cannot discard source identity or move its author into either review phase',async()=>{
  const s=await start();try{
    const p=(await s.call('/api/projects',{name:'虚构来源修订API'})).body,ws=(await s.call('/api/projects/'+p.id+'/workspaces',{name:'虚构来源修订窗口'})).body,path='/api/workspaces/'+ws.id,ctx={projectId:p.id};
    for(const agentId of ['hermes','deepseek','chatgpt'])await s.call(path+'/bind-simulation',{...ctx,agentId});
    await s.call(path+'/configure',{...ctx,paused:false});const parent=(await s.call(path+'/chat',{...ctx,text:'虚构来源修订原文',recipients:['hermes']})).body;
    let source;for(let n=0;n<100;n++){source=(await s.call(path+'?projectId='+p.id)).body.messages.find(m=>m.case_id===parent.id&&m.author==='hermes');if(source)break;await sleep(100);}assert.ok(source);
    const base={...ctx,title:'虚构来源审查',body:source.body,reviewers:['deepseek'],sourceMessageId:source.id};
    const created=await s.call(path+'/reviews',base);assert.equal(created.status,200);const item=created.body;
    assert.equal(item.sourceMessageId,source.id);assert.equal(item.sourceAuthorId,'hermes');assert.equal(item.snapshot.source_message.author,'hermes');
    const firstView=(await s.call(path+'?projectId='+p.id)).body,old=firstView.snapshots.find(x=>x.item_id===item.id&&x.revision===1);
    for(const patch of [{reviewers:['hermes']},{sourceMessageId:null},{sourceMessageId:'request:'+parent.id},{sourceAuthorId:'chatgpt'},{reviewPlan:'independent_then_cross',crossReviewers:['hermes']}]){
      const rejected=await s.call(path+'/revise',{...ctx,itemId:item.id,expectedRevision:1,...patch});assert.equal(rejected.status,400);assert.match(rejected.body.error,/self_review|invalid_reviewers|frozen_message_source/);
    }
    const revised=await s.call(path+'/revise',{...ctx,itemId:item.id,expectedRevision:1,body:source.body+'\n虚构合法补充说明',reviewers:['deepseek']});assert.equal(revised.status,200);
    assert.equal(revised.body.revision,2);assert.deepEqual(revised.body.snapshot.source_message,item.snapshot.source_message);assert.equal(revised.body.sourceMessageId,source.id);
    const crossBad=await s.call(path+'/reviews',{...base,reviewPlan:'independent_then_cross',crossReviewers:['hermes']});assert.equal(crossBad.status,400);assert.match(crossBad.body.error,/self_review|invalid_reviewers/);
    const crossGood=await s.call(path+'/reviews',{...base,reviewPlan:'independent_then_cross',crossReviewers:['chatgpt']});assert.equal(crossGood.status,200);assert.deepEqual(crossGood.body.crossReviewers,['chatgpt']);
    const final=(await s.call(path+'?projectId='+p.id)).body;assert.deepEqual(final.snapshots.find(x=>x.item_id===item.id&&x.revision===1),old);
    assert.equal(final.authorizations.length,0);assert.equal(final.items.find(x=>x.id===item.id).userAuthorized,false);
  }finally{await stop(s);}
});
