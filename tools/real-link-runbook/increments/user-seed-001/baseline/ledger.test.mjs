import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {RunbookLedger} from './ledger.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url)),cli=fileURLToPath(new URL('./cli.mjs',import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex'),iso=n=>new Date(n).toISOString();
const assertion={provenance:'OPERATOR_ASSERTION',reference:'fictional-test-evidence-only'};
function setup(cap=3){
 mkdirSync(join(root,'test-output'),{recursive:true});const directory=mkdtempSync(join(root,'test-output/real-link-runbook-001-fake-'));let now=Date.now()-1000;
 const ledger=new RunbookLedger({environment:'FAKE_TEST',directory,clock:()=>now});
 const input={format:'TRB_REAL_LINK_RUNBOOK_INIT_V1',runId:'fictional-six-way',cap,authorizationReference:'fictional-isolated-run-authorization',bindings:Object.fromEntries(['hermes','deepseek','chatgpt'].map(r=>[r,{sessionFingerprint:sha('fictional-'+r),original:true}])),mainPauseBoundary:{status:'ISOLATED_EXCEPTION_CONFIRMED',...assertion},coverage:{complete:true,from:iso(now-3600001),through:iso(now),channels:['actual','native','manual'],continuityAsserted:true,...assertion},history:[]};
 return {ledger,directory,input,now:()=>now,advance:ms=>{now+=ms},initialize(){return ledger.initialize(input)},resume(){return ledger.apply('pause',{paused:false,...assertion})},attempt(n=1,channel='native'){return {attemptId:'fake-attempt-'+n,requestKey:'fake-trip-'+n+'-forward',runId:input.runId,channel,from:'hermes',to:'deepseek',fromSessionFingerprint:sha('fictional-hermes'),toSessionFingerprint:sha('fictional-deepseek'),...assertion}}};
}
const begin=(s,id)=>s.ledger.apply('begin',{attemptId:id,...assertion});
const result=(s,id,state,extra={})=>s.ledger.apply('result',{attemptId:id,state,...extra,...assertion});
function childApply(directory,operation,input){
 const url=pathToFileURL(fileURLToPath(new URL('./ledger.mjs',import.meta.url))).href;
 const code=`import {RunbookLedger} from ${JSON.stringify(url)};const l=new RunbookLedger({environment:'FAKE_TEST',directory:process.argv[1]});const op=process.argv[2],input=JSON.parse(process.argv[3]);for(let n=0;n<150;n++){try{console.log(JSON.stringify({ok:true,value:l.apply(op,input)}));break;}catch(e){if(e.message.startsWith('ledger_locked')&&n<149){await new Promise(r=>setTimeout(r,10));continue;}console.log(JSON.stringify({ok:false,error:e.message}));break;}}`;
 return new Promise((res,rej)=>{const p=spawn(process.execPath,['--input-type=module','-e',code,directory,operation,JSON.stringify(input)],{windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',rej);p.on('close',exit=>{try{assert.equal(exit,0,err);res(JSON.parse(out));}catch(e){rej(e)}});});
}
test('uninitialized never manufactures zero history, explicit cap is <=30',()=>{
 const s=setup();assert.equal(s.ledger.status().initialized,false);assert.throws(()=>s.ledger.apply('reserve',s.attempt()),/uninitialized_ledger/);assert.equal(existsSync(join(s.directory,'ledger.json')),false);
 assert.throws(()=>s.ledger.initialize({...s.input,cap:31}),/explicit_init_run_and_cap_required/);assert.throws(()=>s.ledger.initialize({...s.input,history:undefined}),/explicit_history_array_required/);
 const v=s.initialize();assert.equal(v.paused,true);assert.equal(v.ready,false);assert.equal(v.coverageProvenance,'OPERATOR_ASSERTION');assert.equal(v.platformAuthenticityVerified,false);assert.equal(v.externalBypassPrevented,false);assert.equal(v.budget.used,0);assert.throws(()=>s.initialize(),/already_initialized/);
});
test('incomplete history, unresolved main pause and nonoriginal binding fail closed',()=>{
 for(const bad of ['coverage','boundary','binding']){const s=setup();if(bad==='coverage')s.input.coverage={...s.input.coverage,complete:false,continuityAsserted:false};if(bad==='boundary')s.input.mainPauseBoundary.status='UNKNOWN';if(bad==='binding')s.input.bindings.deepseek.original=false;s.initialize();assert.throws(()=>s.resume(),/not_ready/);assert.throws(()=>s.ledger.apply('reserve',s.attempt()),/not_ready|non_original_session_binding/);}
 const s=setup();delete s.input.coverage.channels;assert.throws(()=>s.initialize(),/invalid_coverage/);
});
test('lower cap shares actual/native/manual budget; wrong original Session refused',()=>{
 const s=setup(2);s.initialize();s.resume();s.ledger.apply('reserve',s.attempt(1,'manual'));s.ledger.apply('reserve',s.attempt(2,'actual'));assert.throws(()=>s.ledger.apply('reserve',s.attempt(3,'native')),/cap_or_unresolved/);assert.throws(()=>s.ledger.apply('reserve',{...s.attempt(4),toSessionFingerprint:sha('another-session')}),/non_original_session_binding/);assert.equal(s.ledger.status().budget.used,2);
});
test('duplicate attempts and request keys never receive a new submit grant',()=>{
 const s=setup(1);s.initialize();s.resume();const a=s.attempt();assert.equal(s.ledger.apply('reserve',a).duplicate,false);const repeat=s.ledger.apply('reserve',a);assert.equal(repeat.duplicate,true);assert.equal(repeat.submissionAuthorized,false);assert.equal(repeat.budget.used,1);
 assert.throws(()=>s.ledger.apply('reserve',{...a,attemptId:'another-attempt'}),/idempotency_key/);assert.equal(begin(s,a.attemptId).submissionAuthorized,true);assert.throws(()=>begin(s,a.attemptId),/already_started/);
});
test('RESERVED/POSSIBLE/UNKNOWN hold after three hours and across restart',()=>{
 for(const state of ['RESERVED','POSSIBLE','UNKNOWN']){const s=setup(1);s.initialize();s.resume();const a=s.attempt();s.ledger.apply('reserve',a);if(state!=='RESERVED')begin(s,a.attemptId);if(state==='UNKNOWN')result(s,a.attemptId,'UNKNOWN');s.advance(3*3600000);
 const restarted=new RunbookLedger({environment:'FAKE_TEST',directory:s.directory,clock:s.now});assert.equal(restarted.status().budget.used,1);assert.throws(()=>restarted.apply('reserve',s.attempt(2)),/cap_or_unresolved/);assert.equal(restarted.apply('reserve',a).submissionAuthorized,false);if(state!=='RESERVED')assert.throws(()=>restarted.apply('begin',{attemptId:a.attemptId,...assertion}),/already_started/);}
});
test('known terminals leave rolling count after an hour, never leave idempotency history',()=>{
 const s=setup(1);s.initialize();s.resume();const a=s.attempt();s.ledger.apply('reserve',a);begin(s,a.attemptId);result(s,a.attemptId,'CONFIRMED',{submittedAt:iso(s.now())});assert.equal(s.ledger.status().budget.used,1);s.advance(3600000);assert.equal(s.ledger.status().budget.used,0);assert.equal(s.ledger.apply('reserve',a).submissionAuthorized,false);
 assert.throws(()=>result(s,a.attemptId,'UNKNOWN'),/terminal_attempt_is_immutable/);assert.throws(()=>result(s,a.attemptId,'CONFIRMED',{submittedAt:iso(s.now())}),/terminal_attempt_is_immutable/);s.ledger.apply('reserve',s.attempt(2));
});
test('UNKNOWN reconciles only to known submission; only unbegun reservations cancel',()=>{
 const s=setup();s.initialize();s.resume();const a=s.attempt();s.ledger.apply('reserve',a);assert.throws(()=>result(s,a.attemptId,'CANCELLED_UNSENT'),/definitely_unsubmitted/);result(s,a.attemptId,'CANCELLED_UNSENT',{confirmedNotSubmitted:true});assert.equal(s.ledger.status().budget.used,0);assert.equal(s.ledger.apply('reserve',a).submissionAuthorized,false);assert.throws(()=>begin(s,a.attemptId),/already_started/);
 const b=s.attempt(2);s.ledger.apply('reserve',b);begin(s,b.attemptId);result(s,b.attemptId,'UNKNOWN');assert.throws(()=>result(s,b.attemptId,'CANCELLED_UNSENT',{confirmedNotSubmitted:true}),/definitely_unsubmitted/);assert.throws(()=>result(s,b.attemptId,'CONFIRMED',{submittedAt:iso(s.now())}),/explicit_known_submission_reconciliation/);result(s,b.attemptId,'CONFIRMED',{submittedAt:iso(s.now()),reconciled:true});assert.equal(s.ledger.status().budget.knownRecent,1);
});
test('pause blocks begin/reserve, permits stop accounting and persists on restart',()=>{
 const s=setup();s.initialize();s.resume();const a=s.attempt();s.ledger.apply('reserve',a);s.ledger.apply('pause',{paused:true,...assertion});assert.throws(()=>begin(s,a.attemptId),/RUNBOOK_PAUSED/);assert.throws(()=>s.ledger.apply('reserve',s.attempt(2)),/RUNBOOK_PAUSED/);const restarted=new RunbookLedger({environment:'FAKE_TEST',directory:s.directory,clock:s.now});assert.equal(restarted.status().paused,true);result(s,a.attemptId,'CANCELLED_UNSENT',{confirmedNotSubmitted:true});assert.equal(restarted.status().budget.used,0);
});
test('explicit history imports count actual traffic and never double count or rewrite',()=>{
 const s=setup(2);const event={attemptId:'historical-actual-1',requestKey:'historical-key-1',runId:'previous-isolated-run',channel:'actual',state:'CONFIRMED',at:iso(s.now()-5000),submittedAt:iso(s.now()-5000),...assertion};s.input.history=[event];s.initialize();s.resume();assert.equal(s.ledger.status().budget.used,1);
 s.ledger.apply('import-history',{coverage:s.input.coverage,history:[event],...assertion});assert.equal(s.ledger.status().paused,true);assert.equal(s.ledger.status().budget.used,1);s.resume();s.ledger.apply('reserve',s.attempt());assert.throws(()=>s.ledger.apply('reserve',s.attempt(2)),/cap_or_unresolved/);assert.throws(()=>s.ledger.apply('import-history',{coverage:s.input.coverage,history:[{...event,state:'FAILED'}],...assertion}),/history_conflict/);
});
test('future timestamps, stale complete baselines and body fields are refused',()=>{
 const a=setup();a.input.coverage.through=iso(a.now()+1);assert.throws(()=>a.initialize(),/nonfuture/);const b=setup();b.input.coverage.through=iso(b.now()-60001);assert.throws(()=>b.initialize(),/complete_all_channel_history/);const s=setup();s.initialize();s.resume();assert.throws(()=>s.ledger.apply('reserve',{...s.attempt(),body:'not metadata'}),/metadata_fields_only/);assert.throws(()=>new RunbookLedger({environment:'REAL',directory:s.directory}),/real_ledger_is_fixed/);assert.throws(()=>new RunbookLedger({environment:'REAL',clock:()=>0}),/real_ledger_is_fixed/);
});
test('six competing processes preserve cap and snapshot without lost writes',async()=>{
 const s=setup(3);s.initialize();s.resume();const results=await Promise.all(Array.from({length:6},(_,n)=>childApply(s.directory,'reserve',s.attempt(n+1,['actual','native','manual'][n%3]))));assert.equal(results.filter(x=>x.ok).length,3);assert.ok(results.filter(x=>!x.ok).every(x=>x.error.includes('cap_or_unresolved')));assert.equal(new RunbookLedger({environment:'FAKE_TEST',directory:s.directory}).status().budget.used,3);const state=JSON.parse(readFileSync(join(s.directory,'ledger.json'))).payload;assert.equal(state.attempts.length,3);assert.equal(new Set(state.attempts.map(a=>a.attemptId)).size,3);
});
test('two processes racing begin receive exactly one local submit grant',async()=>{
 const s=setup();s.initialize();s.resume();const a=s.attempt();s.ledger.apply('reserve',a);const results=await Promise.all([childApply(s.directory,'begin',{attemptId:a.attemptId,...assertion}),childApply(s.directory,'begin',{attemptId:a.attemptId,...assertion})]);assert.equal(results.filter(x=>x.ok&&x.value.submissionAuthorized).length,1);assert.equal(results.filter(x=>!x.ok&&x.error.includes('already_started')).length,1);assert.equal(new RunbookLedger({environment:'FAKE_TEST',directory:s.directory}).status().budget.used,1);
});
test('stale lock cannot auto-reclaim; corrupted state fails closed',()=>{
 const s=setup();s.initialize();writeFileSync(join(s.directory,'ledger.lock'),JSON.stringify({pid:999999999,token:'fictional-stale-lock'}),{flag:'wx'});assert.throws(()=>s.ledger.status(),/manual_review_required_no_stale_reclaim/);assert.equal(existsSync(join(s.directory,'ledger.lock')),true);unlinkSync(join(s.directory,'ledger.lock'));writeFileSync(join(s.directory,'ledger.json'),'{}');assert.throws(()=>s.ledger.status(),/checksum/);assert.equal(existsSync(join(s.directory,'ledger.lock')),false);
});
test('file-only CLI imports fake metadata; REAL directory override denied',async()=>{
 const s=setup();const input=join(s.directory,'init.json');writeFileSync(input,JSON.stringify(s.input));
 const call=args=>new Promise((res,rej)=>{const child=spawn(process.execPath,[cli,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',rej);child.on('close',code=>res({code,out,err}));});
 const r=await call(['initialize','--environment','FAKE_TEST','--directory',s.directory,'--input',input]);assert.equal(r.code,0,r.err);assert.equal(JSON.parse(r.out).paused,true);const status=await call(['status','--environment','FAKE_TEST','--directory',s.directory]);assert.equal(status.code,0,status.err);assert.equal(JSON.parse(status.out).realSending,false);const denied=await call(['status','--environment','REAL','--directory',s.directory]);assert.equal(denied.code,1);assert.match(denied.err,/real_ledger_is_fixed/);
});
test('late actual history exceeding cap blocks even a previously reserved begin',()=>{
 for(const cap of [1,30]){const s=setup(cap);s.initialize();s.resume();const a=s.attempt();s.ledger.apply('reserve',a);const history=Array.from({length:cap},(_,n)=>({attemptId:'late-other-actual-'+n,requestKey:'late-other-key-'+n,runId:'other-run',channel:'actual',state:'CONFIRMED',at:iso(s.now()),submittedAt:iso(s.now()),...assertion}));s.ledger.apply('import-history',{coverage:s.input.coverage,history,...assertion});s.resume();assert.throws(()=>begin(s,a.attemptId),/overcommitted_cap/);assert.equal(s.ledger.status().budget.used,cap+1);}
});
