import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {RUN,resolveSeal,inspectLinkRows,run} from './receipt.mjs';
import {readFixedLog} from '../dsh-own-receipt/receipt.mjs';
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const now=Date.parse('2026-11-13T00:00:00.000Z');
const sha=x=>createHash('sha256').update(x).digest('hex');
const U='11111111-1111-4111-8111-111111111111',A='22222222-2222-4222-8222-222222222222';
function manifest(){
 const roles={H:'hermes',D:'deepseek',C:'chatgpt'},slots=[];
 for(const from of ['H','D','C'])for(const to of ['H','D','C'])if(from!==to)for(let n=1;n<=5;n++){
  const id=RUN+'.'+from+to+'-0'+n;slots.push({id,from:roles[from],to:roles[to],slot:n,challengeId:id+'.'+sha(id).slice(0,24)});
 }
 return {format:'TRB_REAL_LINK_EXECUTION_MANIFEST_V1',runId:RUN,fixture:true,createdAt:'2026-11-12T15:35:44.655Z',packageId:'fixture-package',version:1,snapshotId:'fixture-snapshot',manifestHash:'0'.repeat(64),slots};
}
function attempt(m,leg='USER_SEED') {
 const s=m.slots.find(s=>leg==='FORWARD'?s.to==='deepseek':s.from==='deepseek'),nonce=s.challengeId+'.'+leg;
 const exactText='TRB_REAL_LINK '+nonce+'\n仅虚构文字挑战，不用工具。';
 return {format:'TRB_REAL_LINK_ATTEMPT_V1',runId:RUN,slotId:s.id,leg,challengeId:s.challengeId,requestNonce:nonce,targetRole:'deepseek',preparedAt:'2026-11-12T15:36:00.000Z',exactText,textSha256:sha(exactText)};
}
function rows(a){
 const rows=[{type:'session',version:4,id:'fixture-dsh-own-receipt',fixture:true,cwd:'D:\\Fictional'},
 {type:'session/title',data:{title:'虚构会话'}},
 {type:'agent/inbox/spliced',data:{inserted:[{id:U,content:[{type:'text',text:a.exactText}]}]}},
 {type:'turn/start',data:{turn:60}},
 {type:'user/message',data:{id:U,source:{kind:'human'},content:[{type:'text',text:a.exactText}]}},
 {type:'assistant/message',data:{turn:60,step:1,message:{id:A,content:[{type:'text',text:'本挑战文字回复'}]}}},
 {type:'turn/end',data:{turn:60,reason:{kind:'completed'}}}];return renumber(rows);
}
function renumber(r){r.slice(1).forEach((e,i)=>Object.assign(e,{seq:i,time:Date.parse('2026-11-12T15:36:01.000Z')+i}));return r;}
const options={fixture:true,now};
function rejects(name,change){test(name,()=>{const m=manifest(),a=attempt(m),r=rows(a);change(m,a,r);assert.throws(()=>inspectLinkRows(r,m,a,options));});}
for(const leg of ['USER_SEED','FORWARD','RETURN'])test('legal sealed '+leg+' keeps native provenance',()=>{
 const m=manifest(),a=attempt(m,leg),out=inspectLinkRows(rows(a),m,a,options);
 assert.equal(out.status,'RECEIPT_FOUND');assert.equal(out.fixture,true);assert.equal(out.request.id,U);assert.equal(out.reply.id,A);
 assert.equal(out.taskId,'TRB-DSH-LINK-RECEIPTS-001');assert.equal(out.leg,leg);assert.equal(out.requestTextSha256,a.textSha256);
});
rejects('forged slot rejected',(_,a)=>a.slotId=RUN+'.DH-06');
rejects('forged nonce rejected',(_,a)=>a.requestNonce='other');
rejects('forged challenge rejected',(_,a)=>a.challengeId+='0');
rejects('modified exact text hash rejected',(_,a)=>a.exactText+=' extra');
rejects('different run rejected',(_,a)=>a.runId='trb-real-links-other');
rejects('wrong target role rejected',(_,a)=>a.targetRole='hermes');
rejects('source role mislabeled as forward rejected',(_,a)=>a.leg='FORWARD');
rejects('SOURCE is unsupported',(_,a)=>a.leg='SOURCE');
rejects('wrong leading header rejected even with updated hash',(_,a)=>{a.exactText=a.exactText.replace('TRB_REAL_LINK','TRB_CHAT');a.textSha256=sha(a.exactText);});
rejects('duplicate full request rejected',(_,a,r)=>{r.push(structuredClone(r[4]));renumber(r);});
rejects('conflicting text under same leading header rejected',(_,a,r)=>{r.push({type:'user/message',data:{id:'33333333-3333-4333-8333-333333333333',content:[{type:'text',text:a.exactText+' changed'}]}});renumber(r);});
rejects('incomplete turn rejected',(_,a,r)=>r.pop());
rejects('new substantive user rejected',(_,a,r)=>{r.splice(5,0,{type:'user/message',data:{id:'33333333-3333-4333-8333-333333333333',content:[{type:'text',text:'other active task'}]}});renumber(r);});
rejects('request before sealed preparedAt rejected',(_,a)=>a.preparedAt='2026-11-12T15:37:00.000Z');
rejects('future seal rejected',(_,a)=>a.preparedAt='2026-11-14T00:00:00.000Z');
rejects('duplicate manifest slot rejected',(m)=>m.slots[1]=structuredClone(m.slots[0]));
rejects('manifest direction and slot ID must agree',m=>m.slots[0].from='deepseek');
rejects('unknown attempt fields cannot inject paths',(_,a)=>a.logPath='C:/private/other.jsonl');
test('later quoted old nonce/header is not a submission anchor',()=>{
 const m=manifest(),a=attempt(m),r=rows(a);
 r.push({type:'turn/start',data:{turn:61}},{type:'user/message',data:{id:'33333333-3333-4333-8333-333333333333',content:[{type:'text',text:'请引用之前的请求：\n'+a.exactText}]}},
 {type:'assistant/message',data:{turn:61,step:1,message:{id:'44444444-4444-4444-8444-444444444444',content:[{type:'text',text:'PRIVATE_LATER_REPLY'}]}}},{type:'turn/end',data:{turn:61,reason:{kind:'completed'}}});
 const out=inspectLinkRows(renumber(r),m,a,options);assert.equal(out.reply.id,A);assert.equal(JSON.stringify(out).includes('PRIVATE_LATER'),false);
});
function toolRows(a){const r=rows(a);r[5].data.step=2;r.splice(5,0,
 {type:'assistant/message',data:{turn:60,step:1,message:{id:'44444444-4444-4444-8444-444444444444',content:[{type:'tool-call',id:'native-call',name:'read',arguments:'PRIVATE_ARGS'}]}}},
 {type:'tool/call',data:{turn:60,step:1,callId:'native-call',name:'read',arguments:'PRIVATE_ARGS'}},
 {type:'tool/result',data:{turn:60,step:1,message:{id:'55555555-5555-4555-8555-555555555555',role:'tool',source:{kind:'tool',callId:'native-call'},toolCallId:'native-call',content:[{type:'text',text:'PRIVATE_RESULT'}]}}});renumber(r);r[7].sourceEventSeqs=[r[6].seq];return r;}
test('reused strict tool lifecycle exports counts only',()=>{
 const m=manifest(),a=attempt(m),out=inspectLinkRows(toolRows(a),m,a,options);assert.deepEqual(out.tools,{calls:1,results:1});assert.equal(JSON.stringify(out).includes('PRIVATE_'),false);
});
test('reused strict tool lifecycle rejects missing result',()=>{const m=manifest(),a=attempt(m),r=toolRows(a);r.splice(7,1);assert.throws(()=>inspectLinkRows(renumber(r),m,a,options));});
function writeFixture(){const m=manifest(),a=attempt(m),dir=fs.mkdtempSync(path.join(root,'test-output','dsh-link-receipts-fake-'));fs.mkdirSync(path.join(dir,'attempts'));fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(m),{flag:'wx'});const p=path.join(dir,'attempts',a.slotId+'.'+a.leg+'.json');fs.writeFileSync(p,JSON.stringify(a),{flag:'wx'});fs.writeFileSync(path.join(dir,'rows.jsonl'),rows(a).map(r=>JSON.stringify(r)).join('\n')+'\n',{flag:'wx'});return {m,a,dir,p};}
test('default and incomplete real flags never read original log',()=>{assert.equal(run([]).status,'UNKNOWN');assert.equal(run(['--real']).status,'UNKNOWN');assert.throws(()=>readFixedLog());});
test('fake CLI fixed filenames work; arbitrary path/selector rejected',()=>{
 const {a,dir}=writeFixture();const args=['--fixture',dir,'--slot',a.slotId,'--leg',a.leg];assert.equal(run(args).status,'RECEIPT_FOUND');
 args[3]='../private';assert.equal(run(args).status,'UNKNOWN');args[3]=a.slotId;args[1]=root;assert.equal(run(args).status,'UNKNOWN');
});
test('untrusted attempt extra path fails UNKNOWN without exposing text',()=>{
 const {a,dir,p}=writeFixture();a.logPath='C:/private/history';fs.writeFileSync(p,JSON.stringify(a));const out=run(['--fixture',dir,'--slot',a.slotId,'--leg',a.leg]);assert.equal(out.status,'UNKNOWN');assert.equal(JSON.stringify(out).includes('private'),false);
});
test('real manifest identity cannot be replaced by fixture data',()=>{const m=manifest(),a=attempt(m);assert.throws(()=>resolveSeal(m,a,{fixture:false,now}));});
test('fixed real manifest identity accepts state updates but rejects challenge changes without opening log',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(root,'evidence','real-material-002','real-links-20261112-001','manifest.json'),'utf8'));
 const a=attempt(m);resolveSeal(m,a,{fixture:false,now});m.slots.forEach(s=>{s.state='OPERATOR_METADATA_CHANGED';s.forward={asserted:true};});resolveSeal(m,a,{fixture:false,now});
 m.slots[0].challengeId=m.slots[0].id+'.'+'0'.repeat(24);assert.throws(()=>resolveSeal(m,a,{fixture:false,now}));
});
test('attempt directory junction is refused before any fixture content read',()=>{
 const {a,dir}=writeFixture(),alias=dir+'-junction';fs.symlinkSync(dir,alias,'junction');
 const out=run(['--fixture',alias,'--slot',a.slotId,'--leg',a.leg]);assert.equal(out.status,'UNKNOWN');
});
