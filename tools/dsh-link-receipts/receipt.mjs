import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {boundedRead,fixedRoot,within} from '../safe-local-files.mjs';
import {inspectRows,readFixedLog} from '../dsh-own-receipt/receipt.mjs';
export const RUN='trb-real-links-20261112-001';
const BASE=path.join(fixedRoot,'evidence','real-material-002','real-links-20261112-001');
const MANIFEST_SHA='2afe957c338f3c1adaf4374fb8b993df29443d14ea43ac64216ad543b8c7d957';
const LEGS=['USER_SEED','FORWARD','RETURN'];
const hash=x=>createHash('sha256').update(x).digest('hex');
const need=(v,c)=>{if(!v)throw Error(c);};
function instant(v,now) {need(typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&new Date(v).toISOString()===v&&Date.parse(v)<=now,'invalid_time');return Date.parse(v);}
export function identity(m) {
  return {format:m.format,runId:m.runId,createdAt:m.createdAt,packageId:m.packageId,version:m.version,snapshotId:m.snapshotId,manifestHash:m.manifestHash,
    slots:m.slots.map(s=>({id:s.id,from:s.from,to:s.to,slot:s.slot,challengeId:s.challengeId})).sort((a,b)=>a.id.localeCompare(b.id))};
}
export function resolveSeal(m,a,{fixture=false,now=Date.now()}={}) {
  need(m?.format==='TRB_REAL_LINK_EXECUTION_MANIFEST_V1'&&m.runId===RUN&&Array.isArray(m.slots)&&m.slots.length===30,'wrong_manifest');
  const ids=new Set(),challenges=new Set(),pairs=new Set();
  for(const s of m.slots) {
    need(typeof s.id==='string'&&new RegExp('^'+RUN+'\\.[HCD]{2}-0[1-5]$').test(s.id)&&!ids.has(s.id)&&
      ['hermes','deepseek','chatgpt'].includes(s.from)&&['hermes','deepseek','chatgpt'].includes(s.to)&&s.from!==s.to&&
      Number.isInteger(s.slot)&&s.slot>=1&&s.slot<=5&&s.id.endsWith('-0'+s.slot)&&
      typeof s.challengeId==='string'&&s.challengeId.startsWith(s.id+'.')&&/^[a-f0-9]{24}$/.test(s.challengeId.slice(s.id.length+1))&&!challenges.has(s.challengeId),'invalid_slot');
    const codes={hermes:'H',deepseek:'D',chatgpt:'C'};need(s.id===RUN+'.'+codes[s.from]+codes[s.to]+'-0'+s.slot,'slot_direction_mismatch');
    ids.add(s.id);challenges.add(s.challengeId);pairs.add(s.from+'>'+s.to+':'+s.slot);
  }
  need(pairs.size===30&&(!fixture||m.fixture===true),'invalid_fixture_manifest');
  if(!fixture)need(hash(JSON.stringify(identity(m)))===MANIFEST_SHA,'manifest_identity_changed');
  const created=instant(m.createdAt,now);
  const keys=['format','runId','slotId','leg','challengeId','targetRole','requestNonce','preparedAt','exactText','textSha256'];
  need(a&&Object.keys(a).length===keys.length&&Object.keys(a).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(a,k)),'attempt_fields');
  const slot=m.slots.find(s=>s.id===a.slotId);
  need(a.format==='TRB_REAL_LINK_ATTEMPT_V1'&&a.runId===RUN&&slot&&LEGS.includes(a.leg)&&a.challengeId===slot.challengeId&&a.targetRole==='deepseek','attempt_scope');
  need(a.leg==='FORWARD'?slot.to==='deepseek':slot.from==='deepseek','leg_not_received_by_deepseek');
  const nonce=a.challengeId+'.'+a.leg;
  need(a.requestNonce===nonce&&typeof a.exactText==='string'&&Buffer.byteLength(a.exactText)>0&&Buffer.byteLength(a.exactText)<=65536&&
    a.exactText.split('\n',1)[0]==='TRB_REAL_LINK '+nonce&&a.textSha256===hash(a.exactText),'attempt_text_or_nonce');
  const preparedAt=instant(a.preparedAt,now);need(preparedAt>=created,'attempt_predates_run');
  return Object.freeze({text:a.exactText,nonce,preparedAt,headerAnchor:'TRB_REAL_LINK '+nonce});
}
export function inspectLinkRows(rows,m,a,options={}) {
  const seal=resolveSeal(m,a,options);
  const out=inspectRows(rows,{fixture:options.fixture===true,now:options.now??Date.now(),sealedRequest:seal});
  return {...out,taskId:'TRB-DSH-LINK-RECEIPTS-001',runId:RUN,slotId:a.slotId,leg:a.leg,challengeId:a.challengeId,
    packageId:m.packageId,version:m.version,snapshotId:m.snapshotId,manifestHash:m.manifestHash,
    requestTextSha256:a.textSha256,attemptProvenance:'OPERATOR_SEALED_BEFORE_SEND_ASSERTION'};
}
function json(file,max) {return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(boundedRead(file,max)));}
export function run(args) {
  try {
    need(args.length===6,'explicit_mode_slot_leg_required');let fixture,base;
    if(args[0]==='--real'&&args[1]==='--ack-private-history-read'){fixture=false;base=BASE;}
    else if(args[0]==='--fixture') {
      fixture=true;base=path.resolve(args[1]);
      need(path.dirname(base)===path.join(fixedRoot,'test-output')&&/^dsh-link-receipts-fake-[A-Za-z0-9-]+$/.test(path.basename(base)),'fixture_directory');
    } else throw Error('mode_refused');
    need(args[2]==='--slot'&&args[4]==='--leg'&&new RegExp('^'+RUN+'\\.[HCD]{2}-0[1-5]$').test(args[3])&&LEGS.includes(args[5]),'selector_refused');
    const m=json(path.join(base,'manifest.json'),262144),a=json(path.join(base,'attempts',args[3]+'.'+args[5]+'.json'),131072);
    need(a.slotId===args[3]&&a.leg===args[5],'selector_conflict');resolveSeal(m,a,{fixture});
    // Metadata is validated before any private log is opened. No directory discovery.
    const bytes=fixture?boundedRead(path.join(base,'rows.jsonl'),64*1024*1024):readFixedLog({ackPrivateHistory:true});
    const lines=new TextDecoder('utf-8',{fatal:true}).decode(bytes).split('\n');if(lines.at(-1)==='')lines.pop();
    need(lines.length<=500001&&lines.every(l=>l&&Buffer.byteLength(l)<=4*1024*1024),'invalid_log_lines');
    return inspectLinkRows(lines.map(l=>JSON.parse(l)),m,a,{fixture});
  } catch {return {status:'UNKNOWN',taskId:'TRB-DSH-LINK-RECEIPTS-001',reason:'sealed_link_receipt_not_uniquely_verified',detailsRedacted:true};}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const out=run(process.argv.slice(2));process.stdout.write(JSON.stringify(out)+'\n');process.exitCode=out.status==='RECEIPT_FOUND'?0:2;
}
