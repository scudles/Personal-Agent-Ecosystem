import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {RunbookLedger} from '../../ledger.mjs';
import {SEALED_RUN,MANIFEST_IDENTITY_SHA256} from '../../sealed-batch.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex'),iso=x=>new Date(x).toISOString();
const assertion={provenance:'OPERATOR_ASSERTION',reference:'fictional operator assertion only'};
const m=JSON.parse(readFileSync(new URL('./manifest-identity.json',import.meta.url),'utf8'));
const auth=()=>({format:'TRB_SEALED_BATCH_BUDGET_AUTHORIZATION_V1',runId:SEALED_RUN,budgetMode:'SEALED_BATCH_ONLY',manifestIdentitySha256:MANIFEST_IDENTITY_SHA256,audited:true,userInstruction:'额度不设上限',...assertion});
function setup(cap=12,runId=SEALED_RUN){
 mkdirSync(join(root,'test-output'),{recursive:true});const directory=mkdtempSync(join(root,'test-output','real-link-runbook-001-fake-sealed-'));let time=Date.now();
 const now=()=>time,bindings=Object.fromEntries(['hermes','deepseek','chatgpt'].map(r=>[r,{sessionFingerprint:sha('fictional-only-'+r),original:true}]));
 const coverage={complete:true,from:iso(time-7200000),through:iso(time),channels:['actual','native','manual'],continuityAsserted:true,...assertion};
 const ledger=new RunbookLedger({environment:'FAKE_TEST',directory,clock:now});ledger.initialize({format:'TRB_REAL_LINK_RUNBOOK_INIT_V1',runId,cap,authorizationReference:'fictional initial authority',bindings,mainPauseBoundary:{status:'ISOLATED_EXCEPTION_CONFIRMED',...assertion},coverage,history:[]});
 return {ledger,directory,now,advance:n=>time+=n,bindings,coverage,resume:()=>ledger.apply('pause',{paused:false,...assertion}),authorize:d=>ledger.apply('authorize-sealed-batch',d||auth())};
}
function request(s,slot=m.slots[0],leg='seed') {
 const from=leg==='seed'?'user':leg==='forward'?slot.from:slot.to,to=leg==='return'?slot.from:leg==='forward'?slot.to:slot.from;
 const key=slot.id+'.'+leg;
 return {attemptId:key,requestKey:key,runId:SEALED_RUN,channel:'native',...(leg==='seed'?{kind:'USER_SEED'}:{}),from,to,fromSessionFingerprint:from==='user'?null:s.bindings[from].sessionFingerprint,toSessionFingerprint:s.bindings[to].sessionFingerprint,...assertion};
}
const begin=(s,a)=>s.ledger.apply('begin',{attemptId:a.attemptId,...assertion});
const result=(s,a,state,extra={})=>s.ledger.apply('result',{attemptId:a.attemptId,state,...extra,...assertion});

test('old cap12 remains with no authorization; old arbitrary valid keys retain old behavior',()=>{
 const s=setup();s.resume();for(let i=0;i<12;i++)s.ledger.apply('reserve',request(s,m.slots[i]));
 assert.throws(()=>s.ledger.apply('reserve',request(s,m.slots[12])),/cap_or_unresolved/);
 assert.equal(s.ledger.status().budget.cap,12);assert.equal(s.ledger.status().budget.budgetMode,undefined);
});
test('exact 30x3 keys can reserve and begin beyond cap; batch remains bounded at90',()=>{
 const s=setup(1);s.resume();s.authorize();
 for(const slot of m.slots)for(const leg of ['seed','forward','return']){const a=request(s,slot,leg);s.ledger.apply('reserve',a);assert.equal(begin(s,a).submissionAuthorized,true);result(s,a,'CONFIRMED',{submittedAt:iso(s.now())});}
 const b=s.ledger.status().budget;assert.equal(b.cap,null);assert.equal(b.configuredHourlyCap,1);assert.equal(b.hourlyLimit,null);assert.equal(b.maximumUniqueKeys,90);assert.equal(b.consumedUniqueKeys,90);assert.equal(b.remainingUniqueKeys,0);assert.equal(b.used,90);
 const a=request(s);assert.throws(()=>s.ledger.apply('reserve',{...a,requestKey:a.requestKey+'-91',attemptId:a.attemptId+'-91'}),/outside_sealed_batch/);
 assert.equal(s.ledger.apply('reserve',a).submissionAuthorized,false);assert.throws(()=>begin(s,a),/already_started/);
});
test('authorization never resumes paused ledger and pause still blocks begin',()=>{
 const s=setup();s.authorize();assert.equal(s.ledger.status().paused,true);const a=request(s);assert.throws(()=>s.ledger.apply('reserve',a),/RUNBOOK_PAUSED/);s.resume();s.ledger.apply('reserve',a);s.ledger.apply('pause',{paused:true,...assertion});assert.throws(()=>begin(s,a),/RUNBOOK_PAUSED/);
});
test('wrong run/hash/un-audited/missing user declaration and new fields cannot grant exception',()=>{
 const wrong=setup(1,'wrong-run');assert.throws(()=>wrong.authorize(),/wrong_ledger_run/);
 for(const patch of [{runId:'other'},{manifestIdentitySha256:'0'.repeat(64)},{audited:false},{userInstruction:'okay'},{budgetMode:'UNLIMITED'},{bindings:{}},{cap:999}]){const s=setup();assert.throws(()=>s.authorize({...auth(),...patch}));assert.equal(s.ledger.status().budget.cap,12);}
});
test('sealed leg source/recipient/kind cannot be forged; .source is not a fourth leg',()=>{
 const s=setup();s.authorize();s.resume();
 const seed=request(s),f=request(s,m.slots[0],'forward'),ret=request(s,m.slots[0],'return');
 for(const bad of [{...seed,to:m.slots[0].to,toSessionFingerprint:s.bindings[m.slots[0].to].sessionFingerprint},{...f,kind:'USER_SEED',from:'user',fromSessionFingerprint:null},{...ret,from:f.from,to:f.to,fromSessionFingerprint:f.fromSessionFingerprint,toSessionFingerprint:f.toSessionFingerprint},{...seed,attemptId:seed.attemptId.replace('.seed','.source'),requestKey:seed.requestKey.replace('.seed','.source')},{...seed,attemptId:'alias-same-key'}])assert.throws(()=>s.ledger.apply('reserve',bad),/sealed_batch|outside_sealed_batch/);
 assert.equal(s.ledger.status().budget.consumedUniqueKeys,0);
});
test('existing POSSIBLE is preserved and cannot begin again after grant/restart',()=>{
 const s=setup(1),slot=m.slots.find(s=>s.id.endsWith('.CD-01')),a=request(s,slot,'forward');s.resume();s.ledger.apply('reserve',a);begin(s,a);
 const before=JSON.parse(readFileSync(join(s.directory,'ledger.json'))).payload.attempts[0];s.authorize();const restarted=new RunbookLedger({environment:'FAKE_TEST',directory:s.directory,clock:s.now});
 const after=JSON.parse(readFileSync(join(s.directory,'ledger.json'))).payload.attempts[0];assert.deepEqual(after,before);assert.equal(after.state,'POSSIBLE');assert.equal(restarted.apply('reserve',a).submissionAuthorized,false);assert.throws(()=>restarted.apply('begin',{attemptId:a.attemptId,...assertion}),/already_started/);assert.throws(()=>result(s,a,'CANCELLED_UNSENT',{confirmedNotSubmitted:true}),/definitely_unsubmitted/);
});
test('UNKNOWN stays unresolved and non-resendable after exception and three hours',()=>{
 const s=setup(1),a=request(s);s.resume();s.ledger.apply('reserve',a);begin(s,a);result(s,a,'UNKNOWN');s.authorize();s.advance(10800000);
 const restarted=new RunbookLedger({environment:'FAKE_TEST',directory:s.directory,clock:s.now});const out=restarted.apply('reserve',a);assert.equal(out.attempt.state,'UNKNOWN');assert.equal(out.submissionAuthorized,false);assert.ok(out.budget.unresolvedAttemptIds.includes(a.attemptId));assert.throws(()=>begin(s,a),/already_started/);assert.throws(()=>result(s,a,'CANCELLED_UNSENT',{confirmedNotSubmitted:true}),/definitely_unsubmitted/);
 s.ledger.apply('reserve',request(s,m.slots[1]));assert.equal(restarted.status().budget.consumedUniqueKeys,2);
});
test('grant idempotence and restart preserve authority, bindings and cap; no status snapshot rewrite',()=>{
 const s=setup(12);s.authorize();const before=readFileSync(join(s.directory,'ledger.json')),repeat=s.authorize();assert.equal(repeat.duplicate,true);assert.equal(repeat.submissionAuthorized,false);assert.deepEqual(readFileSync(join(s.directory,'ledger.json')),before);
 assert.throws(()=>s.authorize({...auth(),reference:'a different authority'}),/immutable/);
 const restarted=new RunbookLedger({environment:'FAKE_TEST',directory:s.directory,clock:s.now});assert.equal(restarted.status().budget.budgetMode,'SEALED_BATCH_ONLY');assert.deepEqual(readFileSync(join(s.directory,'ledger.json')),before);
 const state=JSON.parse(before).payload;assert.equal(state.cap,12);assert.deepEqual(state.bindings,s.bindings);assert.ok(state.audit.some(x=>x.operation==='authorize-sealed-batch'));
});
test('existing out-of-scope local request prevents grant rather than silently exempting it',()=>{
 const s=setup(),a={...request(s),attemptId:'legacy-local',requestKey:'legacy-local'};s.resume();s.ledger.apply('reserve',a);assert.throws(()=>s.authorize(),/outside_sealed_batch/);assert.equal(s.ledger.status().budget.cap,12);
});
test('imported other-run history remains accounted and cannot begin, even when key looks sealed',()=>{
 const s=setup(1),key=request(s).requestKey,history=[{attemptId:'historical-file-upload',requestKey:'historical-file-upload',runId:'previous-canary',channel:'manual',state:'UNKNOWN',at:iso(s.now()),submittedAt:null,...assertion},{attemptId:key,requestKey:key,runId:SEALED_RUN,channel:'native',state:'RESERVED',at:iso(s.now()),submittedAt:null,...assertion}];
 s.ledger.apply('import-history',{coverage:s.coverage,history,...assertion});s.authorize();s.resume();assert.equal(s.ledger.status().budget.used,2);assert.equal(s.ledger.status().budget.consumedUniqueKeys,1);assert.throws(()=>s.ledger.apply('begin',{attemptId:key,...assertion}),/already_started_or_missing/);s.ledger.apply('reserve',request(s,m.slots[1]));assert.equal(s.ledger.status().budget.used,3);
});
test('exception cannot change an original session binding',()=>{
 const s=setup();s.authorize();s.resume();const a=request(s);assert.throws(()=>s.ledger.apply('reserve',{...a,toSessionFingerprint:sha('different-session')}),/non_original/);
 const file=join(s.directory,'ledger.json'),e=JSON.parse(readFileSync(file));e.payload.bindings.hermes.sessionFingerprint=sha('forged');const canonical=x=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);e.checksum=sha(canonical(e.payload));writeFileSync(file,JSON.stringify(e));assert.throws(()=>s.ledger.status(),/binding_conflict/);
});
test('CLI audited apply works only on explicitly selected fake metadata and leaves paused intact',()=>{
 const s=setup(),p=join(s.directory,'authorization.json');writeFileSync(p,JSON.stringify(auth()),{flag:'wx'});
 const cli=fileURLToPath(new URL('../../cli.mjs',import.meta.url));const r=spawnSync(process.execPath,[cli,'authorize-sealed-batch','--environment','FAKE_TEST','--directory',s.directory,'--input',p],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);const out=JSON.parse(r.stdout);assert.equal(out.budget.budgetMode,'SEALED_BATCH_ONLY');assert.equal(out.paused,true);assert.equal(out.realSending,false);assert.equal(out.submissionAuthorized,false);
});
