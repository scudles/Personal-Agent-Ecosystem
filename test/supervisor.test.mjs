import test from 'node:test';import assert from 'node:assert/strict';import{PassThrough}from'node:stream';import{mkdtempSync}from'node:fs';import{resolve}from'node:path';import{Workflow,PINNED}from'../src/workflow.mjs';import{Supervisor}from'../src/supervisor.mjs';import{readJson}from'../src/http-body.mjs';
const paths=()=>mkdtempSync(resolve('test-output','simulation-'));
function fixture(){
 const w=new Workflow(':memory:');w.control({paused:false});const sent=new Map();
 const fake={calls:[],mutateError:null,inspect:async role=>({sessionId:PINNED[role].id,title:PINNED[role].title,busy:false,draft:false,editorReady:true}),
  latestAction:async()=>null,
  send:async(role,d)=>{fake.calls.push({role,id:d.id});if(fake.mutateError)return fake.mutateError;sent.set(d.id,d);return {submitted:true};},
  read:async(role,d)=>{if(!sent.has(d.id))return{requestSeen:false};
   const common={case_id:d.caseId,revision:d.revision,artifact_hash:d.artifactHash,nonce:d.nonce};
   let value=d.kind==='review'?{type:'review',...common,verdict:'approve',conditions:[],reason:'FICTIONAL FIXTURE ONLY'}:d.kind==='notice'?{type:'notice_ack',...common,comment:'fixture received'}:{type:'task_result',...common,result:'虚构算式2+3=5'};
   if(d.kind==='task')value.outgoing_requests=[{protocol:'TRB_ACTION_V2',action:'request_review',action_id:'fixture-pair-action',title:'虚构算式核对',body:'2+3=5，仅文字。',reviewers:['chatgpt']}];
   return{requestSeen:true,sessionId:PINNED[role].id,sourceUserId:'fixture-user:'+d.id,promptText:d.prompt,replyId:'fixture-reply:'+d.id,completed:true,noToolCalls:true,reply:JSON.stringify(value),coverage:'SIMULATION_ONLY'};
  }};
 const supervisor=new Supervisor(w,fake,{evidenceDir:paths()});return{w,fake,supervisor};
}
test('isolated supervisor runs all three reviewers, task, agent submission and original-author receipt',async()=>{
 const {w,fake,supervisor:s}=fixture();const i=w.create({title:'虚构水果',body:'2箱，每箱3个，共6个。',reviewers:['chatgpt','deepseek','hermes'],assignee:'hermes'});
 await s.step('chatgpt');await s.step('deepseek');assert.equal(w.get('case',i.id).state,'reviewing');assert.equal(fake.calls.length,2);
 await s.step('hermes');assert.equal(w.get('case',i.id).state,'task_queued');await s.step('hermes');assert.equal(w.get('case',i.id).state,'awaiting_user_acceptance');
 const pair=w.list('case').find(x=>x.author==='hermes');assert.ok(pair);assert.equal(pair.originDepth,1);
 await s.step('chatgpt');assert.equal(w.get('case',pair.id).state,'approved');await s.step('hermes');assert.ok(w.get('case',pair.id).notice);
 const count=fake.calls.length;w.recover();await s.step('chatgpt');await s.step('deepseek');await s.step('hermes');assert.equal(fake.calls.length,count);
 assert.equal(w.list('delivery').filter(x=>x.state==='received').length,6);w.close();
});
test('role pause prevents even source inspection and leaves original uncertain deliveries untouched',async()=>{
 const {w,fake,supervisor:s}=fixture();w.create({title:'虚构',body:'1+1=2',reviewers:['deepseek']});w.control({paused:false,rolePaused:{deepseek:true}});
 fake.inspect=async()=>{throw Error('must never inspect paused role')};fake.read=async()=>{throw Error('must never read paused role')};await s.step('deepseek');assert.equal(fake.calls.length,0);assert.equal(w.list('worker')[0].status,'paused');w.close();
});
test('uncertain input is quarantined and no timer step repeats it',async()=>{
 const {w,fake,supervisor:s}=fixture();w.create({title:'虚构',body:'1+1=2',reviewers:['chatgpt']});fake.mutateError={error:'simulated_focus_loss',mutationStarted:true};
 await s.step('chatgpt');assert.equal(w.list('delivery')[0].state,'unknown');for(let k=0;k<20;k++)await s.step('chatgpt');assert.equal(fake.calls.length,1);w.close();
});
test('pausing during preflight releases the lease without inserting text',async()=>{
 const {w,fake,supervisor:s}=fixture();w.create({title:'虚构',body:'1+1=2',reviewers:['chatgpt']});const inspect=fake.inspect;fake.inspect=async role=>{w.control({paused:true});return inspect(role);};
 await s.step('chatgpt');assert.equal(fake.calls.length,0);assert.equal(w.list('delivery')[0].state,'queued');w.close();
});
test('frozen project material cannot be restarted or replaced through the queue',async()=>{
 const {w,fake,supervisor:s}=fixture();assert.throws(()=>w.create({title:'Nagi',body:'不允许真实项目材料',reviewers:['hermes']}));
 const i=w.create({title:'虚构',body:'1+1=2',reviewers:['hermes']});i.suspended=true;w.put('case',i.id,i);await s.step('hermes');assert.equal(fake.calls.length,0);assert.throws(()=>w.revise(i.id,'2+2=4'));w.close();
});
test('automatic action chains stop after two levels and cannot turn into project requests',()=>{
 const {w}=fixture();const parent=w.create({title:'虚构',body:'1+1=2',reviewers:['hermes']});parent.originDepth=2;w.put('case',parent.id,parent);
 const source={sessionId:PINNED.hermes.id,replyId:'fixture',completed:true,noToolCalls:true,parentCaseId:parent.id};
 const action={protocol:'TRB_ACTION_V2',action:'request_review',action_id:'chain-level-3',title:'虚构',body:'1+1=2',reviewers:['chatgpt']};
 assert.throws(()=>w.ingest('hermes',JSON.stringify(action),source),/chain_limit/);assert.equal(w.list('case').length,1);w.close();
});
test('split UTF-8 HTTP chunks preserve the exact Chinese material bytes',async()=>{
 const expected={body:'虚构水果🍐：梨子共六个'},bytes=Buffer.from(JSON.stringify(expected));const stream=new PassThrough();const p=readJson(stream);for(let k=0;k<bytes.length;k++)stream.write(bytes.subarray(k,k+1));stream.end();assert.deepEqual(await p,expected);
 const over=new PassThrough();const denied=readJson(over,5);over.end('123456');await assert.rejects(denied,/payload_too_large/);
});