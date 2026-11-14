import {mkdirSync,openSync,closeSync,writeFileSync,fsyncSync,renameSync,unlinkSync,lstatSync,existsSync} from 'node:fs';
import {resolve,join,relative,sep} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {fixedRoot,checkedPath,boundedRead} from '../safe-local-files.mjs';
import {authorizeSealedBatch,validateSealedAuthorization,requireSealedRequest,sealedBudget} from './sealed-batch.mjs';
export const REAL_DIRECTORY=join(fixedRoot,'evidence/real-link-runbook-001/shared');
export const CHANNELS=['actual','native','manual'];
const ROLES=['hermes','deepseek','chatgpt'];
const STATES=['RESERVED','POSSIBLE','SUBMITTED','UNKNOWN','CONFIRMED','FAILED','CANCELLED_UNSENT'];
const HELD=['RESERVED','POSSIBLE','SUBMITTED','UNKNOWN'],FINAL=['CONFIRMED','FAILED','CANCELLED_UNSENT'];
const BOUNDARIES=['UNKNOWN','CONFLICT','ISOLATED_EXCEPTION_CONFIRMED','NO_CONFLICT_CONFIRMED'];
const digest=x=>createHash('sha256').update(x).digest('hex');
const canonical=x=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const need=(ok,code)=>{if(!ok)throw Error(code);};
const identifier=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,160}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const keys=(x,allowed)=>need(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>allowed.includes(k)),'metadata_fields_only');
function assertion(x){need(x?.provenance==='OPERATOR_ASSERTION'&&typeof x.reference==='string'&&x.reference.length>0&&x.reference.length<=240&&!/[\x00-\x1f]/.test(x.reference),'explicit_operator_assertion_required');}
function instant(x,now){need(typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x&&Date.parse(x)<=now,'valid_nonfuture_utc_timestamp_required');return Date.parse(x);}
function coverage(x,now,{fresh=false}={}){
 keys(x,['complete','from','through','channels','continuityAsserted','provenance','reference']);assertion(x);
 const start=instant(x.from,now),end=instant(x.through,now);
 need(start<=end&&typeof x.complete==='boolean'&&typeof x.continuityAsserted==='boolean'&&Array.isArray(x.channels)&&new Set(x.channels).size===x.channels.length&&x.channels.every(c=>CHANNELS.includes(c)),'invalid_coverage');
 if(x.complete)need(start<=now-3600000&&(!fresh||end>=now-60000)&&CHANNELS.every(c=>x.channels.includes(c))&&x.continuityAsserted===true,'complete_all_channel_history_required');
}
function bindingMap(x){keys(x,ROLES);need(ROLES.every(r=>{const b=x[r];keys(b,['sessionFingerprint','original']);return hash(b.sessionFingerprint)&&typeof b.original==='boolean';})&&new Set(ROLES.map(r=>x[r].sessionFingerprint)).size===3,'three_distinct_explicit_original_bindings_required');}
function boundary(x){keys(x,['status','provenance','reference']);assertion(x);need(BOUNDARIES.includes(x.status),'invalid_main_pause_boundary');}
function historyEvent(x,now){
 keys(x,['attemptId','requestKey','runId','channel','state','at','submittedAt','provenance','reference']);assertion(x);
 need(identifier(x.attemptId)&&identifier(x.requestKey)&&identifier(x.runId)&&CHANNELS.includes(x.channel)&&STATES.includes(x.state),'invalid_history_event');instant(x.at,now);
 if(['SUBMITTED','CONFIRMED','FAILED'].includes(x.state))need(instant(x.submittedAt,now)>=Date.parse(x.at),'history_submission_time_required');
 else need(x.submittedAt===null,'unresolved_or_unsent_history_has_no_exact_submission_time');
}
function readiness(s){const reasons=[];if(s.paused)reasons.push('RUNBOOK_PAUSED');if(!s.coverage.complete||!s.coverage.continuityAsserted||!CHANNELS.every(c=>s.coverage.channels.includes(c)))reasons.push('HISTORY_INCOMPLETE');if(ROLES.some(r=>s.bindings[r].original!==true))reasons.push('NON_ORIGINAL_SESSION_BINDING');if(!['ISOLATED_EXCEPTION_CONFIRMED','NO_CONFLICT_CONFIRMED'].includes(s.mainPauseBoundary.status))reasons.push('MAIN_PAUSE_BOUNDARY_UNRESOLVED');return reasons;}
function budget(s,now){const held=s.attempts.filter(a=>HELD.includes(a.state)),recent=s.attempts.filter(a=>['CONFIRMED','FAILED'].includes(a.state)&&Date.parse(a.submittedAt)>now-3600000);return {cap:s.cap,held:held.length,knownRecent:recent.length,used:held.length+recent.length,unresolvedAttemptIds:held.map(a=>a.attemptId),...sealedBudget(s)};}
function addHistory(s,events,now){need(Array.isArray(events)&&events.length<=10000,'explicit_history_array_required');for(const e of events){historyEvent(e,now);const old=s.attempts.find(a=>a.attemptId===e.attemptId||a.requestKey===e.requestKey);if(old){need(old.imported&&canonical({...old,imported:undefined})===canonical(e),'history_conflict_no_rewrite');continue;}s.attempts.push({...e,imported:true});}}
function validateState(s,now){
 keys(s,['format','environment','runId','cap','authorizationReference','bindings','mainPauseBoundary','coverage','paused','initializedAt','updatedAt','sequence','attempts','audit','sealedBatchAuthorization']);
 need(s.format==='TRB_REAL_LINK_LEDGER_V1'&&['REAL','FAKE_TEST'].includes(s.environment)&&identifier(s.runId)&&Number.isInteger(s.cap)&&s.cap>=1&&s.cap<=30&&typeof s.paused==='boolean'&&Number.isInteger(s.sequence)&&s.sequence>=1,'invalid_ledger_state');
 need(typeof s.authorizationReference==='string'&&s.authorizationReference.length>0&&s.authorizationReference.length<=240,'missing_frozen_authorization_reference');
 bindingMap(s.bindings);boundary(s.mainPauseBoundary);coverage(s.coverage,now);instant(s.initializedAt,now);instant(s.updatedAt,now);
 need(Array.isArray(s.attempts)&&s.attempts.length<=10000&&Array.isArray(s.audit)&&s.audit.length===s.sequence,'invalid_ledger_counts');
 const ids=new Set(),requests=new Set();for(const a of s.attempts){
  need(identifier(a.attemptId)&&identifier(a.requestKey)&&identifier(a.runId)&&CHANNELS.includes(a.channel)&&STATES.includes(a.state)&&!ids.has(a.attemptId)&&!requests.has(a.requestKey),'invalid_or_duplicate_attempt');ids.add(a.attemptId);requests.add(a.requestKey);instant(a.at,now);assertion(a);
  if(['SUBMITTED','CONFIRMED','FAILED'].includes(a.state))need(instant(a.submittedAt,now)>=Date.parse(a.at),'invalid_submission_time');else need(a.submittedAt===null||a.state==='UNKNOWN'&&Number.isFinite(instant(a.submittedAt,now)),'invalid_unresolved_time');
  if(!a.imported){const validSource=a.kind==='USER_SEED'?a.from==='user'&&a.fromSessionFingerprint===null:a.kind===undefined&&ROLES.includes(a.from)&&a.from!==a.to&&a.fromSessionFingerprint===s.bindings[a.from].sessionFingerprint;need(a.runId===s.runId&&ROLES.includes(a.to)&&validSource&&a.toSessionFingerprint===s.bindings[a.to].sessionFingerprint,'stored_nonoriginal_binding');}
 }
 validateSealedAuthorization(s,now);
 for(let n=0;n<s.audit.length;n++)need(s.audit[n].sequence===n+1&&Number.isFinite(instant(s.audit[n].at,now)),'invalid_audit_sequence');
}
// Metadata only: programs/people bypassing this file cannot be controlled here.
export class RunbookLedger {
 constructor({environment='REAL',directory,clock}={}){
  need(['REAL','FAKE_TEST'].includes(environment),'explicit_environment_required');this.environment=environment;
  if(environment==='REAL'){need(!clock&&(!directory||resolve(directory)===resolve(REAL_DIRECTORY)),'real_ledger_is_fixed_no_clock_override');this.directory=REAL_DIRECTORY;this.clock=Date.now;}
  else {const rel=relative(join(fixedRoot,'test-output'),resolve(directory||''));need(rel&&!rel.startsWith('..')&&!rel.includes(sep)&&/^real-link-runbook-001-fake-[A-Za-z0-9_-]+$/.test(rel),'fake_directory_must_be_new_task_test_output');this.directory=resolve(directory);this.clock=clock||Date.now;}
  checkedPath(this.directory);this.path=join(this.directory,'ledger.json');this.lock=join(this.directory,'ledger.lock');
 }
 status(){if(!existsSync(this.directory))return {initialized:false,ready:false,reasons:['UNINITIALIZED'],environment:this.environment,realSending:false};return this.locked('status',null,false);}
 initialize(input){return this.locked('initialize',input,true);}
 apply(operation,input){need(['reserve','begin','result','pause','import-history','authorize-sealed-batch'].includes(operation),'unknown_metadata_operation');return this.locked(operation,input,false);}
 locked(operation,input,create){
  checkedPath(this.directory);if(!existsSync(this.directory)){need(create,'uninitialized_ledger');mkdirSync(this.directory,{recursive:true});}checkedPath(this.directory,{mustExist:true});
  let fd;try{fd=openSync(this.lock,'wx');}catch(e){if(e.code==='EEXIST')throw Error('ledger_locked_manual_review_required_no_stale_reclaim');throw e;}
  const token=randomUUID(),lockedStat=lstatSync(this.lock);try{
   writeFileSync(fd,JSON.stringify({format:'TRB_REAL_LINK_LOCK_V1',pid:process.pid,token}));fsyncSync(fd);
   const now=this.clock();need(Number.isFinite(now),'clock_unavailable');let s=null;
   if(existsSync(this.path)){const envelope=JSON.parse(boundedRead(this.path,8*1024*1024).toString('utf8'));keys(envelope,['checksum','payload']);need(hash(envelope.checksum)&&digest(canonical(envelope.payload))===envelope.checksum,'ledger_checksum_invalid');s=envelope.payload;validateState(s,now);need(s.environment===this.environment,'ledger_environment_mismatch');}
   if(operation==='status')return s?this.summary(s,now):{initialized:false,ready:false,reasons:['UNINITIALIZED'],environment:this.environment,realSending:false};
   let result={};
   if(operation==='initialize'){
    need(!s,'ledger_already_initialized');keys(input,['format','runId','cap','authorizationReference','bindings','mainPauseBoundary','coverage','history']);need(input.format==='TRB_REAL_LINK_RUNBOOK_INIT_V1'&&identifier(input.runId)&&Number.isInteger(input.cap)&&input.cap>=1&&input.cap<=30,'explicit_init_run_and_cap_required');
    bindingMap(input.bindings);boundary(input.mainPauseBoundary);coverage(input.coverage,now,{fresh:true});
    s={format:'TRB_REAL_LINK_LEDGER_V1',environment:this.environment,runId:input.runId,cap:Math.min(input.cap,30),authorizationReference:input.authorizationReference,bindings:structuredClone(input.bindings),mainPauseBoundary:structuredClone(input.mainPauseBoundary),coverage:structuredClone(input.coverage),paused:true,initializedAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),sequence:0,attempts:[],audit:[]};addHistory(s,input.history,now);
   }else{
    need(s,'uninitialized_ledger');
    if(operation==='authorize-sealed-batch'){
     if(!authorizeSealedBatch(s,input,now))return {...this.summary(s,now),duplicate:true,submissionAuthorized:false};
     result={duplicate:false,submissionAuthorized:false};
    }else if(operation==='reserve'){
     keys(input,['attemptId','requestKey','runId','channel','kind','from','to','fromSessionFingerprint','toSessionFingerprint','provenance','reference']);assertion(input);
     const userSeed=input.kind==='USER_SEED';need(identifier(input.attemptId)&&identifier(input.requestKey)&&input.runId===s.runId&&CHANNELS.includes(input.channel)&&ROLES.includes(input.to)&&(userSeed?input.from==='user'&&input.fromSessionFingerprint===null:input.kind===undefined&&ROLES.includes(input.from)&&input.from!==input.to),'invalid_reserved_attempt_metadata');
     need(s.bindings[input.to].original===true&&input.toSessionFingerprint===s.bindings[input.to].sessionFingerprint&&(userSeed||s.bindings[input.from].original===true&&input.fromSessionFingerprint===s.bindings[input.from].sessionFingerprint),'non_original_session_binding');
     if(s.sealedBatchAuthorization)requireSealedRequest(s,input);
     const old=s.attempts.find(a=>a.attemptId===input.attemptId||a.requestKey===input.requestKey);
     if(old){need(old.attemptId===input.attemptId&&['attemptId','requestKey','runId','channel','kind','from','to','fromSessionFingerprint','toSessionFingerprint'].every(k=>old[k]===input[k]),'idempotency_key_already_recorded_or_conflict');return {...this.summary(s,now),attempt:old,duplicate:true,submissionAuthorized:false};}
     need(readiness(s).length===0,'not_ready:'+readiness(s).join(','));if(!s.sealedBatchAuthorization)need(budget(s,now).used<s.cap,'rolling_hourly_cap_or_unresolved_holds_full');
     const a={...input,state:'RESERVED',at:new Date(now).toISOString(),submittedAt:null,imported:false};s.attempts.push(a);result={attempt:a,duplicate:false,submissionAuthorized:false};
    }else if(operation==='begin'){
     keys(input,['attemptId','provenance','reference']);assertion(input);need(readiness(s).length===0,'not_ready:'+readiness(s).join(','));const a=s.attempts.find(a=>a.attemptId===input.attemptId);need(a&&!a.imported&&a.runId===s.runId&&a.state==='RESERVED','attempt_already_started_or_missing_no_retry');if(s.sealedBatchAuthorization)requireSealedRequest(s,a);else need(budget(s,now).used<=s.cap,'imported_history_overcommitted_cap');a.state='POSSIBLE';a.reference=input.reference;result={attempt:a,submissionAuthorized:true};
    }else if(operation==='result'){
     keys(input,['attemptId','state','submittedAt','confirmedNotSubmitted','reconciled','provenance','reference']);assertion(input);const a=s.attempts.find(a=>a.attemptId===input.attemptId);need(a,'attempt_not_found');need(['SUBMITTED','UNKNOWN',...FINAL].includes(input.state),'invalid_result_state');
     if(FINAL.includes(a.state)){need(a.state===input.state&&(input.submittedAt??null)===a.submittedAt,'terminal_attempt_is_immutable_no_resend');return {...this.summary(s,now),attempt:a,duplicate:true,submissionAuthorized:false};}
     if(input.state==='CANCELLED_UNSENT')need(a.state==='RESERVED'&&input.confirmedNotSubmitted===true&&input.submittedAt===undefined,'only_definitely_unsubmitted_reservation_can_cancel');
     else {need(['POSSIBLE','SUBMITTED','UNKNOWN'].includes(a.state),'begin_before_result_required');if(a.state==='UNKNOWN')need(input.reconciled===true&&['CONFIRMED','FAILED'].includes(input.state),'unknown_requires_explicit_known_submission_reconciliation');}
     if(['SUBMITTED','CONFIRMED','FAILED'].includes(input.state)){const when=instant(input.submittedAt,now);need(when>=Date.parse(a.at)&&(!a.submittedAt||a.submittedAt===input.submittedAt),'submission_time_cannot_change_or_predate_reservation');a.submittedAt=input.submittedAt;}
     else need(input.submittedAt===undefined,'unknown_does_not_invent_exact_submission_time');
     a.state=input.state;a.reference=input.reference;result={attempt:a,submissionAuthorized:false};
    }else if(operation==='pause'){
     keys(input,['paused','provenance','reference']);assertion(input);need(typeof input.paused==='boolean','explicit_runbook_pause_required');if(!input.paused){const reasons=readiness({...s,paused:false});need(!reasons.length,'not_ready:'+reasons.join(','));}s.paused=input.paused;
    }else if(operation==='import-history'){
     keys(input,['coverage','history','mainPauseBoundary','provenance','reference']);assertion(input);coverage(input.coverage,now,{fresh:true});addHistory(s,input.history,now);s.coverage=structuredClone(input.coverage);if(input.mainPauseBoundary){boundary(input.mainPauseBoundary);s.mainPauseBoundary=structuredClone(input.mainPauseBoundary);}s.paused=true;
    }
   }
   s.updatedAt=new Date(now).toISOString();s.sequence++;s.audit.push({sequence:s.sequence,operation,at:s.updatedAt,attemptId:input?.attemptId||null,provenance:'OPERATOR_ASSERTION',reference:input?.reference||input?.authorizationReference||input?.coverage?.reference});validateState(s,now);
   const next=join(this.directory,'ledger.next-'+token+'.json');let nextFd;try{checkedPath(next);nextFd=openSync(next,'wx');writeFileSync(nextFd,canonical({checksum:digest(canonical(s)),payload:s}));fsyncSync(nextFd);}finally{if(nextFd!==undefined)closeSync(nextFd);}checkedPath(this.path);renameSync(next,this.path);
   return {...this.summary(s,now),...result};
  }finally{closeSync(fd);const current=lstatSync(this.lock);need(current.isFile()&&current.nlink===1&&current.dev===lockedStat.dev&&current.ino===lockedStat.ino,'lock_identity_changed_manual_review_required');unlinkSync(this.lock);}
 }
 summary(s,now){const reasons=readiness(s);return {initialized:true,environment:s.environment,runId:s.runId,sequence:s.sequence,paused:s.paused,ready:reasons.length===0,reasons,budget:budget(s,now),coverageProvenance:'OPERATOR_ASSERTION',mainPauseBoundary:s.mainPauseBoundary,realSending:false,externalBypassPrevented:false,platformAuthenticityVerified:false,automaticRetry:false};}
}
