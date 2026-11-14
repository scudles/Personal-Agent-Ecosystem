import {createHash} from 'node:crypto';
export const PROFILE='hybrid-native-001',MODE='HYBRID_NATIVE';
export const HERMES_SESSION='local-6f275933587b3c068cdbe3bea5633785fb8cacfb3a4c298855c66d931b6946d7';
export const HERMES_TITLE='Nagi';
export const SOURCE='HERMES_GATEWAY_ADMISSION_RESULT';
export const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
export function demand(ok,code){if(!ok)throw Error(code);}
export function opaque(v){return typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=256;}
export function checkJob(j){
 demand(j&&j.role==='hermes'&&j.threadId===HERMES_SESSION&&j.threadTitle===HERMES_TITLE,'native_job_identity_mismatch');
 demand(typeof j.id==='string'&&/^[a-f0-9]{64}$/.test(j.id),'native_job_id_invalid');
 demand(['chat','text_task'].includes(j.kind),'native_job_kind_unsupported');
 demand(typeof j.requestText==='string'&&j.requestText.length>0&&j.requestText.length<=20000&&/^(TRB_CHAT |TRB_REQUEST |TRB_TEXT_TASK )/.test(j.requestText)&&sha(j.requestText)===j.requestSha256,'native_request_not_frozen');
 return j;
}
export function checkInspect(o){
 demand(o&&o.ok===true&&o.sessionId===HERMES_SESSION&&o.title===HERMES_TITLE&&typeof o.busy==='boolean'&&/^[a-f0-9]{64}$/.test(o.tailHash),'native_inspect_not_verified');
 return o;
}
export function nativeEvidence(j,got){
 checkJob(j);demand(opaque(j.nativeAdmissionId),'native_admission_missing_no_resend');
 demand(got&&got.ok===true&&got.sessionId===HERMES_SESSION&&got.admissionId===j.nativeAdmissionId,'native_admission_identity_mismatch');
 if(got.status!=='terminal')return null;
 demand(got.outcome==='completed'&&got.completed===true,'native_admission_not_completed');
 demand(typeof got.finalResponse==='string'&&got.finalResponse.trim()&&got.finalResponse.length<=30000,'native_reply_unsupported');
 const r=got.receiptProjection;
 demand(r&&r.admission_id===j.nativeAdmissionId&&r.ref?.session_id===HERMES_SESSION&&r.status==='terminal'&&r.outcome==='completed'&&r.result?.final_response===got.finalResponse,'native_receipt_projection_mismatch');
 demand(Object.keys(r).every(k=>['admission_id','ref','status','outcome','sequence','authority_epoch','execution_generation','result'].includes(k))&&Object.keys(r.ref).length===2&&Object.hasOwn(r.ref,'profile_id')&&(r.ref.profile_id===null||opaque(r.ref.profile_id))&&Object.keys(r.ref).every(k=>['profile_id','session_id'].includes(k))&&Object.keys(r.result).length===1,'native_receipt_projection_not_minimal');
 return {role:'hermes',jobId:j.id,attemptToken:j.attemptToken,threadId:HERMES_SESSION,requestText:j.requestText,requestSha256:j.requestSha256,replyText:got.finalResponse,replySha256:sha(got.finalResponse),completed:true,sourceEvidence:{type:SOURCE,projection:'OWN_ADMISSION_FINAL_ONLY',sessionId:HERMES_SESSION,requestId:j.id,requestIdSource:'WORKER_REPORTED_INPUT_ID_ASSOCIATION',admissionId:j.nativeAdmissionId,completed:true,requestText:j.requestText,finalResponse:got.finalResponse,raw:r}};
}