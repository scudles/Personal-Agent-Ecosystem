// Static-package protocol candidate only. No discovery, credential files, SDK imports, or Runtime creation.
import {createHash,randomUUID} from 'node:crypto';
export const SESSION='session-ebd654d5-1bf8-419c-bc2a-d9be1ed023fc';
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const demand=(ok,code)=>{if(!ok)throw Error(code);};
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);
const text=c=>{demand(Array.isArray(c)&&c.every(b=>b?.type==='text'&&typeof b.text==='string'),'dsh_non_text_receipt_unsupported');return c.map(x=>x.text).join('');};
function checkJob(j){demand(j&&/^[a-f0-9]{64}$/.test(j.id)&&j.role==='deepseek'&&j.threadId===SESSION&&j.state==='DISPATCHING'&&typeof j.attemptToken==='string'&&j.attemptToken.length>=16,'dsh_exact_dispatch_permit_required');demand(typeof j.requestText==='string'&&j.requestText.length>0&&j.requestText.length<=20000&&sha(j.requestText)===j.requestSha256&&/^(TRB_CHAT |TRB_TEXT_TASK |TRB_REQUEST )/.test(j.requestText),'dsh_frozen_request_required');return j;}
export function ownReceipt(records,j,{preparedAt,now=Date.now()}={}){
 checkJob({...j,state:'DISPATCHING'});demand(Number.isSafeInteger(preparedAt)&&preparedAt<=now,'dsh_prepared_time_required');
 demand(Array.isArray(records)&&records.length>0&&records.length<=5000,'dsh_bounded_records_required');const events=records.map(r=>{demand(r?.type==='event'&&r.event&&Number.isSafeInteger(r.event.seq)&&Number.isSafeInteger(r.event.time)&&r.event.time<=now&&r.event.time>=0&&typeof r.event.type==='string'&&r.event.data,'dsh_wire_event_invalid');return r.event;});
 for(let i=1;i<events.length;i++)demand(events[i].seq===events[i-1].seq+1,'dsh_incomplete_page_sequence');
 const requestId='trb-'+j.id,matches=events.filter(e=>e.type==='user/message'&&e.data.source?.rpcId===requestId);
 demand(matches.length===1,'dsh_exact_request_id_not_unique');const user=matches[0];demand(uuid(user.data.id)&&text(user.data.content)===j.requestText&&user.time>=preparedAt,'dsh_exact_request_text_mismatch');
 const begin=events.filter(e=>e.seq<user.seq&&e.type==='turn/start').at(-1);demand(begin&&Number.isSafeInteger(begin.data.turn),'dsh_own_turn_start_missing');
 const end=events.find(e=>e.seq>user.seq&&(e.type==='turn/end'||e.type==='turn/start'));demand(end&&end.type==='turn/end'&&end.data.turn===begin.data.turn&&end.data.reason?.kind==='completed','dsh_own_turn_not_completed');
 const own=events.filter(e=>e.seq>begin.seq&&e.seq<end.seq);demand(!own.some(e=>e.type.startsWith('tool/')),'dsh_tool_activity_not_supported_in_candidate');demand(!own.some(e=>e.type==='user/message'&&e!==user&&!['time-context','runtime-context'].includes(e.data.source?.kind)),'dsh_intervening_user');
 const replies=own.filter(e=>e.type==='assistant/message');demand(replies.length>0&&replies.every(e=>e.seq>user.seq&&e.data.turn===begin.data.turn&&uuid(e.data.message?.id)&&e.data.interrupted!==true),'dsh_own_reply_not_verified');const answer=replies.at(-1),replyText=text(answer.data.message.content);demand(replyText.trim()&&replyText.length<=30000,'dsh_reply_unsupported');
 demand(events.filter(e=>e.type==='assistant/message'&&e.data.message?.id===answer.data.message.id).length===1,'dsh_duplicate_reply_id');for(let i=1;i<[begin,user,...replies,end].length;i++){const xs=[begin,user,...replies,end];demand(xs[i].time>=xs[i-1].time,'dsh_own_time_not_monotonic');}
 return {state:'RECEIPT_FOUND',source:'WORKER_REPORTED_DSH_NATIVE_REMOTE_PAGE',sessionId:SESSION,requestId,requestSha256:j.requestSha256,nativeUserMessageId:user.data.id,nativeReplyId:answer.data.message.id,replyText,replySha256:sha(replyText),turn:{number:begin.data.turn,startSeq:begin.seq,endSeq:end.seq},requestTime:user.time,replyTime:answer.time,completed:true,fullToolTraceVerified:false,engineeringExecutionAuthorized:false};
}
export function createDshNativeCandidate({origin,cookie,allowNativeAccess=false,allowPrivateWindowRead=false,fetchImpl=globalThis.fetch}={}){
 demand(allowNativeAccess===true,'dsh_native_access_not_authorized');demand(allowPrivateWindowRead===true,'dsh_bounded_private_page_read_not_authorized');
 let base;try{base=new URL(origin);}catch{throw Error('dsh_existing_host_origin_required');}
 demand(['http:','https:'].includes(base.protocol)&&base.hostname==='127.0.0.1'&&base.port&&base.pathname==='/'&&!base.search&&!base.hash&&!base.username&&!base.password,'dsh_exact_loopback_origin_required');
 demand(typeof cookie==='string'&&cookie.length<=8192&&/^dsh-auth-[A-Za-z0-9_-]+=[A-Za-z0-9_.-]+$/.test(cookie),'dsh_official_existing_peer_cookie_required');demand(typeof fetchImpl==='function','dsh_transport_required');
 const attempted=new Set();
 async function invoke(endpoint,args){
  demand(['session/prompt','session/page'].includes(endpoint),'dsh_endpoint_not_allowed');const rpcId=randomUUID();let response;
  try{response=await fetchImpl(new URL('/api/'+endpoint,base).href,{method:'POST',redirect:'error',headers:{'content-type':'application/json',Cookie:cookie},body:JSON.stringify({type:'client-request',rpcId,method:endpoint,payload:{args}}),signal:AbortSignal.timeout(15000)});}catch{throw Error('dsh_transport_outcome_unknown');}
  demand(response.ok,'dsh_remote_request_rejected');let total=0,parts=[];const reader=response.body?.getReader();demand(reader,'dsh_bounded_response_required');
  try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>1048576){await reader.cancel();throw Error('dsh_response_too_large');}parts.push(value);}}finally{reader.releaseLock();}
  let envelope;try{envelope=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Error('dsh_remote_response_invalid');}
  demand(envelope?.type==='server-response'&&envelope.rpcId===rpcId&&envelope.result?.ok===true,'dsh_exact_rpc_response_required');return envelope.result.value;
 }
 return {
  capabilities:{sessionId:SESSION,existingHostOnly:true,discoveryAvailable:false,credentialIssuanceAvailable:false,foregroundRequired:false,productionEnabled:false,approvalAvailable:false,automaticRetry:false},
  async submit(j){checkJob(j);demand(!attempted.has(j.id),'dsh_attempt_already_started_no_resend');attempted.add(j.id);try{const value=await invoke('session/prompt',{request:{requestId:'trb-'+j.id,sessionId:SESSION,mode:'queue',content:[{type:'text',text:j.requestText}]}});demand(value?.accepted===true,'dsh_acceptance_not_verified');return {state:'SUBMITTED',accepted:true,sessionId:SESSION,requestId:'trb-'+j.id,requestSha256:j.requestSha256};}catch{return{state:'UNKNOWN',reason:'dsh_submit_outcome_not_verified_no_resend'};}},
  async readOwnReceipt(j,{throughSeq,beforeSeq,preparedAt,maxMessages=10}={}){checkJob({...j,state:'DISPATCHING'});demand(Number.isSafeInteger(throughSeq)&&throughSeq>=0&&Number.isSafeInteger(maxMessages)&&maxMessages>=1&&maxMessages<=10&&(beforeSeq===undefined||Number.isSafeInteger(beforeSeq)&&beforeSeq>=0),'dsh_explicit_bounded_window_required');try{const page=await invoke('session/page',{request:{address:{kind:'session',sessionId:SESSION},throughSeq,...beforeSeq===undefined?{}:{beforeSeq},maxMessages}});return ownReceipt(page?.records,j,{preparedAt});}catch{return{state:'UNKNOWN',reason:'dsh_own_bounded_page_not_verified',sessionId:SESSION};}}
 };
}