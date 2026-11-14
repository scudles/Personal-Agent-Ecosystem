// Fixed batch exception only; this module performs no sending or real ledger access.
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {boundedRead} from '../safe-local-files.mjs';
export const SEALED_RUN='trb-real-links-20261112-001';
export const MANIFEST_IDENTITY_SHA256='2afe957c338f3c1adaf4374fb8b993df29443d14ea43ac64216ad543b8c7d957';
const canonical=x=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const digest=x=>createHash('sha256').update(x).digest('hex');
const need=(ok,c)=>{if(!ok)throw Error(c);};
const fields=['format','runId','budgetMode','manifestIdentitySha256','audited','userInstruction','provenance','reference'];
const exact=(x,ks)=>need(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===ks.length&&Object.keys(x).every(k=>ks.includes(k)),'sealed_batch_fields_only');
function requests() {
 const bytes=boundedRead(fileURLToPath(new URL('./increments/sealed-batch-001/manifest-identity.json',import.meta.url)),262144);
 need(digest(bytes)===MANIFEST_IDENTITY_SHA256,'sealed_batch_manifest_identity_changed');
 const m=JSON.parse(bytes),out=new Map();need(m.runId===SEALED_RUN&&m.slots.length===30,'sealed_batch_manifest_invalid');
 for(const s of m.slots)for(const leg of ['seed','forward','return'])out.set(s.id+'.'+leg,{slot:s,leg});
 need(out.size===90,'sealed_batch_must_have_exactly_90_keys');return out;
}
export function validateDeclaration(d) {
 exact(d,fields);need(d.format==='TRB_SEALED_BATCH_BUDGET_AUTHORIZATION_V1'&&d.runId===SEALED_RUN&&d.budgetMode==='SEALED_BATCH_ONLY'&&
 d.manifestIdentitySha256===MANIFEST_IDENTITY_SHA256&&d.audited===true&&d.userInstruction==='额度不设上限'&&d.provenance==='OPERATOR_ASSERTION'&&
 typeof d.reference==='string'&&d.reference.length>0&&d.reference.length<=240&&!/[\x00-\x1f]/.test(d.reference),'explicit_fixed_batch_user_authorization_required');
}
export function requireSealedRequest(s,a,allowed=requests()) {
 const x=allowed.get(a.requestKey);need(x&&a.runId===SEALED_RUN&&a.attemptId===a.requestKey,'request_outside_sealed_batch');
 const {slot,leg}=x;
 const good=leg==='seed'?a.kind==='USER_SEED'&&a.from==='user'&&a.to===slot.from&&a.fromSessionFingerprint===null:
 a.kind===undefined&&a.from===(leg==='forward'?slot.from:slot.to)&&a.to===(leg==='forward'?slot.to:slot.from);
 need(good,'sealed_batch_leg_direction_or_origin_mismatch');
 need(s.bindings[a.to]?.original===true&&a.toSessionFingerprint===s.bindings[a.to].sessionFingerprint&&
 (leg==='seed'||s.bindings[a.from]?.original===true&&a.fromSessionFingerprint===s.bindings[a.from].sessionFingerprint),'sealed_batch_binding_changed');
}
export function validateSealedAuthorization(s,now) {
 const g=s.sealedBatchAuthorization;if(!g)return;
 exact(g,['declaration','bindingsSha256','appliedAt']);validateDeclaration(g.declaration);const allowed=requests();
 need(s.runId===SEALED_RUN&&g.bindingsSha256===digest(canonical(s.bindings))&&typeof g.appliedAt==='string'&&
 /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(g.appliedAt)&&new Date(g.appliedAt).toISOString()===g.appliedAt&&Date.parse(g.appliedAt)<=now,'sealed_batch_authorization_or_binding_conflict');
 for(const a of s.attempts)if(!a.imported)requireSealedRequest(s,a,allowed);
}
export function authorizeSealedBatch(s,d,now) {
 validateDeclaration(d);need(s.runId===SEALED_RUN,'sealed_batch_wrong_ledger_run');const allowed=requests();
 if(s.sealedBatchAuthorization){need(canonical(s.sealedBatchAuthorization.declaration)===canonical(d),'sealed_batch_authorization_immutable');return false;}
 for(const a of s.attempts)if(!a.imported)requireSealedRequest(s,a);
 s.sealedBatchAuthorization={declaration:structuredClone(d),bindingsSha256:digest(canonical(s.bindings)),appliedAt:new Date(now).toISOString()};return true;
}
export function sealedBudget(s) {
 if(!s.sealedBatchAuthorization)return null;
 const allowed=requests(),used=s.attempts.filter(a=>a.runId===SEALED_RUN&&allowed.has(a.requestKey)).length;
 return {cap:null,configuredHourlyCap:s.cap,budgetMode:'SEALED_BATCH_ONLY',hourlyLimit:null,maximumUniqueKeys:90,
 consumedUniqueKeys:used,remainingUniqueKeys:90-used,manifestIdentitySha256:MANIFEST_IDENTITY_SHA256,
 authorizationProvenance:'OPERATOR_ASSERTION',authorizationReference:s.sealedBatchAuthorization.declaration.reference};
}
