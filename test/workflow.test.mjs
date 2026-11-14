import test from 'node:test';
import assert from 'node:assert/strict';
import {Workflow,PINNED,parseReply}from'../src/workflow.mjs';
const fixture=()=>{const w=new Workflow(':memory:');w.control({paused:false});return w;};
const material={title:'fixture-only',body:'只审查，不执行。',reviewers:['chatgpt','deepseek','hermes']};
function delivered(w,role){
 const d=w.claim(role);assert.ok(d);
 w.sending(role,d.id,d.lease,{sessionId:PINNED[role].id,busy:false,draft:false});
 w.sent(role,d.id,d.lease,'user:'+d.id);return d;
}
function answer(w,d,verdict='approve',conditions=[]){
 const obj=d.kind==='review'?{type:'review',case_id:d.caseId,revision:d.revision,artifact_hash:d.artifactHash,nonce:d.nonce,verdict,conditions,reason:'fixture-only'}:
  {type:'task_result',case_id:d.caseId,revision:d.revision,artifact_hash:d.artifactHash,nonce:d.nonce,result:'文字汇总'};
 const proof={sessionId:PINNED[d.role].id,sourceUserId:'user:'+d.id,replyId:'reply:'+d.id,completed:true,noToolCalls:true,promptText:d.prompt};
 return w.receive(d.role,d.id,d.lease,JSON.stringify(obj),proof);
}
test('all six directed pair-review routes use pinned original sessions',()=>{for(const a of Object.keys(PINNED))for(const b of Object.keys(PINNED))if(a!==b){const w=fixture();const i=w.create({...material,reviewers:[b]},a);const d=delivered(w,b);assert.equal(d.sessionId,PINNED[b].id);assert.equal(answer(w,d).state,'approved');w.close();}});
test('three-party approval requires every designated vote',()=>{const w=fixture();const i=w.create(material);answer(w,delivered(w,'chatgpt'));answer(w,delivered(w,'deepseek'));assert.equal(w.get('case',i.id).state,'reviewing');assert.equal(answer(w,delivered(w,'hermes')).state,'approved');w.close();});
test('self approval and project execution scope are refused',()=>{const w=fixture();assert.throws(()=>w.create({...material,reviewers:['hermes']},'hermes'));assert.throws(()=>w.create({...material,scope:'execute_project'}));assert.equal(w.list('case').length,0);w.close();});
test('conditions and abstention cannot become an approval',()=>{for(const verdict of ['approve','abstain','request_changes','reject']){const w=fixture();const i=w.create({...material,reviewers:['deepseek']});const out=answer(w,delivered(w,'deepseek'),verdict,verdict==='approve'?['未满足条件']:[]);assert.notEqual(out.state,'approved');w.close();}});
test('wrong session, stale nonce, and wrong material hash are rejected',()=>{const w=fixture();w.create({...material,reviewers:['chatgpt']});const d=delivered(w,'chatgpt');const obj={type:'review',case_id:d.caseId,revision:1,artifact_hash:d.artifactHash,nonce:d.nonce,verdict:'approve',conditions:[],reason:'fixture'};const proof={sessionId:PINNED.chatgpt.id,sourceUserId:'user:'+d.id,replyId:'reply',completed:true,noToolCalls:true,promptText:d.prompt};assert.throws(()=>w.receive('chatgpt',d.id,d.lease,JSON.stringify(obj),{...proof,sessionId:PINNED.deepseek.id}));for(const patch of [{nonce:'wrong'},{artifact_hash:'wrong'},{revision:2}])assert.throws(()=>w.receive('chatgpt',d.id,d.lease,JSON.stringify({...obj,...patch}),proof));w.close();});
test('pause blocks admission and the final sending transition',()=>{const w=fixture();w.create({...material,reviewers:['hermes']});const d=w.claim('hermes');w.control({paused:true});assert.equal(w.claim('chatgpt'),null);assert.throws(()=>w.sending('hermes',d.id,d.lease,{sessionId:PINNED.hermes.id,busy:false,draft:false}));w.close();});
test('restart quarantines uncertain sends and never resubmits',()=>{const w=fixture();w.create({...material,reviewers:['hermes']});const d=delivered(w,'hermes');w.recover();assert.equal(w.get('delivery',d.id).state,'unknown');assert.equal(w.claim('hermes'),null);assert.equal(answer(w,d).state,'approved');w.close();});
test('a known-unsent lease can be deferred; sent messages cannot',()=>{const w=fixture();w.create({...material,reviewers:['hermes']});const d=w.claim('hermes');w.sending('hermes',d.id,d.lease,{sessionId:PINNED.hermes.id,busy:false,draft:false});w.deferUnsent('hermes',d.id,d.lease,'user active before input');assert.equal(w.get('delivery',d.id).state,'queued');const d2=delivered(w,'hermes');assert.throws(()=>w.deferUnsent('hermes',d2.id,d2.lease,'wrong'));w.close();});
test('a single role cannot claim two simultaneous deliveries',()=>{const w=fixture();w.create({...material,reviewers:['chatgpt']});w.create({...material,reviewers:['chatgpt']});assert.ok(w.claim('chatgpt'));assert.equal(w.claim('chatgpt'),null);w.close();});
test('revision invalidates old votes while preserving their originals',()=>{const w=fixture();const i=w.create({...material,reviewers:['deepseek']});const d=delivered(w,'deepseek');answer(w,d,'request_changes');const out=w.revise(i.id,'修订后的独立材料');assert.equal(out.revision,2);assert.deepEqual(out.votes,{});assert.equal(out.history[0].votes.deepseek.verdict,'request_changes');assert.notEqual(out.artifactHash,d.artifactHash);w.close();});
test('approved text task is queued once and waits for user acceptance',()=>{const w=fixture();const i=w.create({...material,reviewers:['chatgpt'],assignee:'hermes'});assert.equal(answer(w,delivered(w,'chatgpt')).state,'task_queued');assert.equal(answer(w,delivered(w,'hermes')).state,'awaiting_user_acceptance');assert.equal(w.list('delivery').filter(d=>d.kind==='task').length,1);w.close();});
test('quoted summaries and prose do not count as structured approvals',()=>{for(const raw of ['同意','引用：{"type":"review"}','[{"type":"review"}]'])assert.throws(()=>parseReply(raw));});

test('agent-originated submissions are attributed and deduplicated atomically',()=>{
 const w=fixture(),source={sessionId:PINNED.hermes.id,replyId:'original-reply-id',completed:true,noToolCalls:true};
 const raw=JSON.stringify({protocol:'TRB_ACTION_V2',action:'request_review',action_id:'unique-source-action',title:'agent request',body:'只做文字审查',reviewers:['deepseek']});
 const a=w.ingest('hermes',raw,source),b=w.ingest('hermes',raw,source);assert.equal(a.caseId,b.caseId);assert.equal(w.list('case').length,1);assert.equal(w.get('case',a.caseId).author,'hermes');
 assert.throws(()=>w.ingest('chatgpt',raw,source));w.close();
});
test('a returned review reaches the original author and a revised version is resubmitted',()=>{
 const w=fixture();const i=w.create({...material,reviewers:['deepseek']},'hermes');const review=delivered(w,'deepseek');
 assert.equal(answer(w,review,'request_changes',['明确边界']).state,'revision_queued');
 const revision=delivered(w,'hermes');assert.equal(revision.kind,'revision');
 const raw=JSON.stringify({type:'revision',case_id:i.id,revision:1,artifact_hash:revision.artifactHash,nonce:revision.nonce,body:'已澄清文字边界的修订版'});
 const proof={sessionId:PINNED.hermes.id,sourceUserId:'user:'+revision.id,replyId:'revision-reply',completed:true,noToolCalls:true,promptText:revision.prompt};
 const next=w.receive('hermes',revision.id,revision.lease,raw,proof);
 assert.equal(next.revision,2);assert.equal(next.state,'reviewing');assert.equal(next.history[0].votes.deepseek.verdict,'request_changes');
 assert.ok(w.claim('deepseek'));w.close();
});
test('late known replies reconcile unknown state without another send',()=>{
 const w=fixture();w.create({...material,reviewers:['hermes']});const d=delivered(w,'hermes');
 w.uncertain('hermes',d.id,d.lease,'late answer');assert.equal(w.claim('hermes'),null);
 assert.equal(answer(w,d).state,'approved');assert.equal(w.get('delivery',d.id).attempts,1);w.close();
});

test('a terminal structured reply preserves free discussion and accepts an explicit escaped string layer',()=>{
 const obj={type:'review',reason:'保留不同意见，路径 C:\\data',nonce:'fixed'};
 const f=String.fromCharCode(96).repeat(3);
 assert.deepEqual(parseReply('独立意见保留。\n'+f+'json\n'+JSON.stringify(obj)+'\n'+f),obj);
 const escaped=JSON.stringify(JSON.stringify(obj)).slice(1,-1);
 assert.deepEqual(parseReply('正文。\n'+f+'json\n'+escaped+'\n'+f),obj);
 assert.throws(()=>parseReply('引用：'+JSON.stringify(obj)));
 assert.throws(()=>parseReply(f+'json\n{bad syntax}\n'+f));
});

test('separate approvals and proactive requests cannot replace each other',async()=>{
 const {structuredObjects,parseBoundReply}=await import('../src/workflow.mjs');
 const f=String.fromCharCode(96).repeat(3),bound={case_id:'one',revision:2,artifact_hash:'hash',nonce:'nonce'};
 const review={type:'review',...bound,verdict:'approve',conditions:[],reason:'independent'};
 const action={protocol:'TRB_ACTION_V2',action_id:'next-request'};
 const raw='独立正文\n'+f+'json\n'+JSON.stringify(review)+'\n'+f+'\n\n'+f+'json\n'+JSON.stringify(action)+'\n'+f;
 assert.equal(structuredObjects(raw).length,2);assert.deepEqual(parseBoundReply(raw,bound),review);
 assert.throws(()=>parseBoundReply(raw,{...bound,nonce:'other'}));
 assert.throws(()=>parseBoundReply(raw+'\n'+f+'json\n'+JSON.stringify({...review,verdict:'reject'})+'\n'+f,bound));
});
test('future text-task instructions are withheld until reviewers approve',()=>{
 const w=fixture(),i=w.create({...material,reviewers:['deepseek'],assignee:'hermes',taskInstruction:'future-task-unique-marker'});
 const review=delivered(w,'deepseek');assert.ok(!review.prompt.includes('future-task-unique-marker'));
 answer(w,review);const task=delivered(w,'hermes');assert.ok(task.prompt.includes('future-task-unique-marker'));w.close();
});
test('approved pair review returns real decision to the original author',()=>{
 const w=fixture(),i=w.create({...material,reviewers:['deepseek']},'hermes');
 answer(w,delivered(w,'deepseek'));const notice=delivered(w,'hermes');assert.equal(notice.kind,'notice');
 assert.ok(notice.prompt.includes('fixture-only'));assert.ok(notice.prompt.includes('approve'));
 const raw=JSON.stringify({type:'notice_ack',case_id:i.id,revision:1,artifact_hash:notice.artifactHash,nonce:notice.nonce,comment:'received'});
 const proof={sessionId:PINNED.hermes.id,sourceUserId:'user:'+notice.id,replyId:'notice',completed:true,noToolCalls:true,promptText:notice.prompt};
 assert.equal(w.receive('hermes',notice.id,notice.lease,raw,proof).state,'approved');assert.equal(w.list('delivery').filter(d=>d.kind==='notice').length,1);w.close();
});
test('repeating an action id in another original reply cannot duplicate a case',()=>{
 const w=fixture(),source={sessionId:PINNED.hermes.id,replyId:'first',completed:true,noToolCalls:true};
 const a={protocol:'TRB_ACTION_V2',action:'request_review',action_id:'stable-id',title:'one',body:'unchanged',reviewers:['deepseek']};
 const first=w.ingest('hermes',JSON.stringify(a),source);
 assert.equal(w.ingest('hermes',JSON.stringify(a),{...source,replyId:'second'}).caseId,first.caseId);
 assert.throws(()=>w.ingest('hermes',JSON.stringify({...a,body:'different'}),{...source,replyId:'third'}));assert.equal(w.list('case').length,1);w.close();
});