import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectRows,sealedPrompt,run} from './receipt.mjs';
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const own='11111111-1111-4111-8111-111111111111',reply='22222222-2222-4222-8222-222222222222';
const now=Date.parse('2026-11-13T00:00:00Z');
function fixture() {
  const time=Date.parse('2026-11-12T15:04:48Z');
  const rows=[{type:'session',version:4,id:'fixture-dsh-own-receipt',fixture:true,cwd:'D:\\Fictional'},
    {type:'session/title',data:{title:'虚构会话'}},
    {type:'agent/inbox/spliced',data:{inserted:[{id:own,content:[{type:'text',text:sealedPrompt()}]}]}},
    {type:'turn/start',data:{turn:59}},
    {type:'user/message',data:{id:own,source:{kind:'human'},content:[{type:'text',text:sealedPrompt()}]}},
    {type:'assistant/message',data:{turn:59,step:1,message:{id:reply,content:[{type:'text',text:'虚构回执：内容读到，哈希未重算。'}]}}},
    {type:'turn/end',data:{turn:59,reason:{kind:'completed'}}}];
  rows.slice(1).forEach((e,i)=>Object.assign(e,{seq:i,time:time+i}));return rows;
}
const renumber=r=>{r.slice(1).forEach((e,i)=>{e.seq=i;e.time=Date.parse('2026-11-12T15:04:48Z')+i;});return r;};
const inspect=r=>inspectRows(r,{now});
function bad(name,change){test(name,()=>{const r=fixture();change(r);assert.throws(()=>inspect(r));});}
test('native IDs/times and own text only; outside history omitted',()=>{
  const r=fixture();r.push({type:'user/message',seq:6,time:r.at(-1).time+1,data:{id:'33333333-3333-4333-8333-333333333333',content:[{type:'text',text:'PRIVATE_UNRELATED_SENTINEL'}]}});
  const out=inspect(r);assert.equal(out.status,'RECEIPT_FOUND');assert.equal(out.fixture,true);
  assert.equal(out.request.id,own);assert.equal(out.reply.id,reply);assert.equal(out.request.acceptedAt,r[2].time);
  assert.equal(out.request.text,sealedPrompt());assert.equal(out.turn.number,59);assert.equal(out.integrity,'NOT_BYTE_VERIFIED');
  assert.equal(JSON.stringify(out).includes('PRIVATE_UNRELATED'),false);
});
function toolFixture() {
  const r=fixture();r[5].data.step=2;
  r.splice(5,0,
    {type:'assistant/message',data:{turn:59,step:1,message:{id:'44444444-4444-4444-8444-444444444444',content:[{type:'tool-call',id:'call-native-1',name:'read',arguments:'PRIVATE_TOOL_ARGS'}]}}},
    {type:'tool/call',data:{turn:59,step:1,callId:'call-native-1',name:'read',arguments:'PRIVATE_TOOL_ARGS'}},
    {type:'tool/result',data:{turn:59,step:1,message:{id:'55555555-5555-4555-8555-555555555555',role:'tool',source:{kind:'tool',callId:'call-native-1'},toolCallId:'call-native-1',content:[{type:'text',text:'PRIVATE_TOOL_RESULT'}]}}});
  renumber(r);r[7].sourceEventSeqs=[r[6].seq];return r;
}
test('tool arguments/results never exported; native lifecycle counted',()=>{
  const out=inspect(toolFixture());assert.deepEqual(out.tools,{calls:1,results:1});assert.equal(JSON.stringify(out).includes('PRIVATE_TOOL'),false);
});
bad('duplicate exact request fails',r=>{r.splice(5,0,structuredClone(r[4]));renumber(r);});
bad('same nonce in a distinct request fails',r=>{r.splice(5,0,{type:'user/message',data:{id:'33333333-3333-4333-8333-333333333333',content:[{type:'text',text:'TRB-DSH-MATERIAL-20261112-001 changed'}]}});renumber(r);});
bad('new substantive user before reply fails',r=>{r.splice(5,0,{type:'user/message',data:{id:'33333333-3333-4333-8333-333333333333',source:{kind:'human'},content:[{type:'text',text:'different task'}]}});renumber(r);});
bad('missing turn/end fails',r=>r.pop());
bad('aborted turn fails',r=>r.at(-1).data.reason.kind='aborted');
bad('reply bound to different turn fails',r=>r[5].data.turn=60);
bad('missing native user UUID fails',r=>delete r[4].data.id);
bad('future event time fails',r=>r[5].time=now+1);
bad('invalid timestamp fails',r=>r[5].time='now');
bad('time regression fails',r=>r[5].time=1);
bad('duplicate acceptance fails',r=>{r.splice(3,0,structuredClone(r[2]));renumber(r);});
bad('wrong identity fails',r=>r[0].id='some-other-session');
bad('synthetic completion is not accepted',r=>r.at(-1).data.reason.kind='interrupted');
bad('partial tool-call reply is not completion',r=>r[5].data.message.content.push({type:'tool-call',arguments:'PRIVATE'}));
test('generated context can coexist without being exported',()=>{
  const r=fixture();r.splice(5,0,{type:'user/message',data:{source:{kind:'runtime-context'},content:[{type:'text',text:'PRIVATE_RUNTIME_CONTEXT'}]}});
  assert.equal(JSON.stringify(inspect(renumber(r))).includes('PRIVATE_RUNTIME'),false);
});
test('CLI defaults refuse all reads; fake CLI emits filtered report; malformed JSON redacted',()=>{
  assert.equal(run([]).status,'UNKNOWN');assert.equal(run(['--real']).status,'UNKNOWN');
  assert.equal(run(['--fixture','C:/outside.jsonl']).status,'UNKNOWN');
  const dir=fs.mkdtempSync(path.join(root,'test-output','dsh-own-receipt-fake-'));
  const good=path.join(dir,'fixture.jsonl'),badfile=path.join(dir,'bad.jsonl');
  fs.writeFileSync(good,fixture().map(x=>JSON.stringify(x)).join('\n')+'\n',{flag:'wx'});
  fs.writeFileSync(badfile,'PRIVATE_BROKEN_JSON',{flag:'wx'});
  const cli=fileURLToPath(new URL('./receipt.mjs',import.meta.url));
  const ok=spawnSync(process.execPath,[cli,'--fixture',good],{encoding:'utf8'});
  assert.equal(ok.status,0,ok.stderr);assert.equal(JSON.parse(ok.stdout).fixture,true);
  const bad=spawnSync(process.execPath,[cli,'--fixture',badfile],{encoding:'utf8'});
  assert.equal(bad.status,2);assert.equal(JSON.parse(bad.stdout).status,'UNKNOWN');
  assert.equal((bad.stdout+bad.stderr).includes('PRIVATE_BROKEN_JSON'),false);
});
test('missing acceptance is explicitly null',()=>{const r=fixture();r.splice(2,1);const out=inspect(renumber(r));assert.equal(out.request.acceptedAt,null);});
bad('accepted ID with different text cannot establish acceptance',r=>r[2].data.inserted[0].content[0].text='different');
bad('changed exact request fails',r=>r[4].data.content[0].text+=' altered');
test('later turn assistant cannot replace own completed reply',()=>{
 const r=fixture();r.push({type:'turn/start',seq:6,time:r.at(-1).time+1,data:{turn:60}},{type:'assistant/message',seq:7,time:r.at(-1).time+2,data:{turn:60,message:{id:'33333333-3333-4333-8333-333333333333',content:[{type:'text',text:'PRIVATE_LATER_REPLY'}]}}});
 const out=inspect(r);assert.equal(out.reply.id,reply);assert.equal(JSON.stringify(out).includes('PRIVATE_LATER'),false);
});
function rejectTools(name,change) {test(name,()=>{
 const r=toolFixture();change(r);renumber(r);
 assert.throws(()=>inspect(r));
 const dir=fs.mkdtempSync(path.join(root,'test-output','dsh-own-receipt-fake-'));
 const file=path.join(dir,'invalid-tool-lifecycle.jsonl');
 fs.writeFileSync(file,r.map(x=>JSON.stringify(x)).join('\n')+'\n',{flag:'wx'});
 const out=run(['--fixture',file]);assert.equal(out.status,'UNKNOWN');assert.equal(JSON.stringify(out).includes('PRIVATE_TOOL'),false);
});}
rejectTools('P1 exact counterexample: call without result plus final text/completed is UNKNOWN',r=>r.splice(7,1));
rejectTools('P1 result in wrong turn is UNKNOWN',r=>r[7].data.turn=60);
rejectTools('P1 tool/call in wrong turn is UNKNOWN',r=>r[6].data.turn=60);
rejectTools('P1 duplicate native result is UNKNOWN',r=>r.splice(8,0,structuredClone(r[7])));
rejectTools('P1 declared but never started tool is UNKNOWN',r=>r.splice(6,2));
rejectTools('P1 mismatched native result call ID is UNKNOWN',r=>{r[7].data.message.toolCallId='other-native-call';r[7].data.message.source.callId='other-native-call';});
rejectTools('P1 result before started call is UNKNOWN',r=>{[r[6],r[7]]=[r[7],r[6]];});
rejectTools('P1 duplicate started call is UNKNOWN',r=>r.splice(7,0,structuredClone(r[6])));
rejectTools('P1 wrong native call seq citation is UNKNOWN',r=>r[7].sourceEventSeqs=[r[5].seq]);
rejectTools('P1 result in wrong step is UNKNOWN',r=>r[7].data.step=2);
rejectTools('P1 pending call cannot be closed after terminal assistant text',r=>{[r[7],r[8]]=[r[8],r[7]];});
test('parallel native calls may complete out of order without leaking tool data',()=>{
 const r=toolFixture();r[5].data.message.content.push({type:'tool-call',id:'call-native-2',name:'read',arguments:'PRIVATE_SECOND_ARGS'});
 const call=structuredClone(r[6]),result=structuredClone(r[7]);call.data.callId='call-native-2';result.data.message.id='66666666-6666-4666-8666-666666666666';result.data.message.toolCallId='call-native-2';result.data.message.source.callId='call-native-2';
 r.splice(7,0,call,result);renumber(r);r[8].sourceEventSeqs=[r[7].seq];r[9].sourceEventSeqs=[r[6].seq];
 const out=inspect(r);assert.deepEqual(out.tools,{calls:2,results:2});assert.equal(JSON.stringify(out).includes('PRIVATE_'),false);
});
test('native result UUID cannot be reused to close two different calls',()=>{
 const r=toolFixture();r[5].data.message.content.push({type:'tool-call',id:'call-native-2',name:'read',arguments:'PRIVATE_SECOND_ARGS'});
 const call=structuredClone(r[6]),result=structuredClone(r[7]);call.data.callId='call-native-2';result.data.message.toolCallId='call-native-2';result.data.message.source.callId='call-native-2';
 r.splice(7,0,call,result);renumber(r);r[8].sourceEventSeqs=[r[7].seq];r[9].sourceEventSeqs=[r[6].seq];assert.throws(()=>inspect(r));
});
