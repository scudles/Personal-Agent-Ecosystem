const THREAD='6af098fa-46bc-83e8-97c5-418f00e213b9',TITLE='Nagi（继承的你1）',WORKER='hybrid-native-001-worker';
const cfg=typeof options==='object'?options:{},maxMs=Math.min(cfg.maxMs||90000,240000),pollMs=cfg.pollMs||5000,maxSends=Math.min(cfg.maxSends||3,3);
const started=Date.now(),summary={mode:'HYBRID_NATIVE',sent:0,completed:0,ignored:0,waiting:0,unknown:0,originalThread:THREAD,independentRuntime:false};
let session,seq=0;
function requireThat(v,m){if(!v)throw Error(m);}
function parsed(result){
 requireThat(result&&!result.isError,'native_tool_error');
 for(const c of result.content||[])if(c.type==='text'){try{const v=JSON.parse(c.text);if(v.thread&&Array.isArray(v.turns))return v;}catch{}}
 throw Error('native_thread_result_unavailable');
}
function acceptedOriginal(result){if(!result||result.isError)return false;return(result.content||[]).some(c=>{if(c.type!=='text')return false;try{return JSON.parse(c.text).threadId===THREAD;}catch{return false;}});}
function encodeData(text){
 const bytes=encodeURIComponent(text).replace(/%([0-9A-F]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16))),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';let out='';
 for(let i=0;i<bytes.length;i+=3){const a=bytes.charCodeAt(i),hasB=i+1<bytes.length,hasC=i+2<bytes.length,b=hasB?bytes.charCodeAt(i+1):0,c=hasC?bytes.charCodeAt(i+2):0;out+=alphabet[a>>2]+alphabet[((a&3)<<4)|(b>>4)];if(hasB)out+=alphabet[((b&15)<<2)|(c>>6)];if(hasC)out+=alphabet[c&63];}
 return out;
}
async function command(cmd,max_output_tokens=45000){
 let r=await tools.exec_command({cmd,workdir:'D:\\TriReviewBridge',yield_time_ms:1000,max_output_tokens}),output=r.output||'';
 while(r.session_id){r=await tools.write_stdin({session_id:r.session_id,chars:'',yield_time_ms:1000,max_output_tokens});output+=r.output||'';}
 requireThat(r.exit_code===0,'worker_rpc_process_failed');return output;
}
async function rpc(op,input={}){
 const id='r'+Date.now().toString(36)+'_'+(++seq);if(op==='close')return{id,ok:true,closed:true};
 const encoded=encodeData(JSON.stringify({id,op,input}));let arg="--rpc '"+encoded+"'";
 if(encoded.length>6000){
  for(let at=0;at<encoded.length;at+=6000)await command("& 'D:\\TriReviewBridge\\runtime\\node.exe' 'D:\\TriReviewBridge\\tools\\hybrid-native-001\\chatgpt-rpc.mjs' --spool-chunk '"+id+"' '"+at+"' '"+encoded.slice(at,at+6000)+"'",1000);
  arg="--rpc-file '"+id+"'";
 }
 const output=await command("& 'D:\\TriReviewBridge\\runtime\\node.exe' 'D:\\TriReviewBridge\\tools\\hybrid-native-001\\chatgpt-rpc.mjs' "+arg);
 let value;try{value=JSON.parse(output.trim());}catch{throw Error('worker_rpc_json_unavailable');}
 requireThat(value.id===id,'worker_rpc_identity_mismatch');return value;
}

async function nativeRead(limit=8,cursor){return parsed(await tools.mcp__codex_app__read_thread({threadId:THREAD,turnLimit:limit,includeOutputs:false,maxOutputCharsPerItem:20000,...cursor?{cursor}:{}}));}
function checkThread(n){requireThat(n.thread.id===THREAD&&n.thread.kind==='chatgpt'&&n.thread.title===TITLE,'native_original_thread_identity_mismatch');}
function exactTurns(n,job){return(n.turns||[]).filter(t=>t.items?.some(i=>i.type==='userMessage'&&Array.isArray(i.content)&&i.content.filter(c=>c.type==='text').map(c=>c.text).join('\n')===job.requestText));}
async function collect(job){
 let n=await nativeRead();checkThread(n);let turns=exactTurns(n,job);
 if(!turns.length&&n.page?.hasMore&&n.page.nextCursor){const older=await nativeRead(8,n.page.nextCursor);checkThread(older);turns=exactTurns(older,job);}
 return rpc('observe',{jobId:job.id,native:{thread:{id:n.thread.id,title:n.thread.title,kind:n.thread.kind,status:n.thread.status},turns}});
}
async function run(){
 await rpc('heartbeat',{workerId:WORKER});
 do{
  const state=await rpc('peek');requireThat(state.ok,'relay_service_unavailable');const s=state.value;
  requireThat(s.mode==='HYBRID_NATIVE'&&s.profileId==='hybrid-native-001'&&s.role==='chatgpt'&&s.threadId===THREAD,'relay_host_identity_mismatch');
  if(cfg.prepareOnly||s.roleControl?.preparationRequested){
   const original=await nativeRead(1);checkThread(original);
   const report=await rpc('identity',{action:'identity-report',sessionId:original.thread.id,title:original.thread.title,source:'WORKER_REPORTED_NATIVE_SESSION_INSPECT',observedAt:new Date().toISOString(),raw:{sessionId:original.thread.id,title:original.thread.title,kind:original.thread.kind,status:original.thread.status?.type||'unknown'}});
   requireThat(report.ok,'hybrid_chatgpt_identity_report_failed');return{...summary,identityReported:true,notEnabled:true};
  }
  let job=s.next;if(!job){summary.idle=true;break;}
  if(['DISPATCHING','SUBMITTED','UNKNOWN'].includes(job.state)){
   const result=await collect(job);
   if(!result.ok){summary.lastError=result.value?.error||result.error||'receipt_not_accepted';summary.unknown++;break;}
   if(result.value.state==='COMPLETED'){summary.completed++;notify('ChatGPT 接力已收回一条原会话回复。');continue;}
   if(['CANCELLED','EXPIRED'].includes(result.value.state)){summary.ignored++;continue;}
   if(job.state==='DISPATCHING'){await rpc('unknown',{jobId:job.id,attemptToken:job.attemptToken,reason:'worker_resumed_dispatch_without_confirmed_native_outcome_no_resend'});summary.unknown++;break;}
   summary.waiting=1;
   if(cfg.once||job.state==='UNKNOWN'){summary.unknown+=job.state==='UNKNOWN'?1:0;break;}
  }else if(job.state==='QUEUED'){
   if(s.paused||job.blockReason){summary.blocked=job.blockReason||'paused';break;}
   if(summary.sent>=maxSends)break;
   const previous=await rpc('cutover');if(!previous.ok||previous.value?.allowed!==true){summary.blocked='previous_chatgpt_channel_not_quiet';break;}
   const preflight=await nativeRead(1);checkThread(preflight);
   if(preflight.thread.status?.type!=='idle'){summary.blocked='original_chat_not_idle';break;}
   const begun=await rpc('begin',{jobId:job.id,workerId:WORKER});
   requireThat(begun.ok&&begun.value?.maySend===true&&begun.value.state==='DISPATCHING','relay_begin_not_authorized');
   job=begun.value;requireThat(job.threadId===THREAD&&typeof job.requestText==='string'&&job.requestText.length>0,'relay_frozen_request_missing');
   const still=await rpc('peek');if(!still.ok||still.value.paused||still.value.next?.id!==job.id||still.value.next.state!=='DISPATCHING'||still.value.next.attemptToken!==job.attemptToken||still.value.next.dispatchContinuationAllowed!==true||still.value.next.cancelRequested){await rpc('unknown',{jobId:job.id,attemptToken:job.attemptToken,reason:'worker_stopped_before_native_call_after_state_change'});summary.unknown++;break;}
   const cutover=await rpc('cutover');if(!cutover.ok||cutover.value?.allowed!==true){await rpc('unknown',{jobId:job.id,attemptToken:job.attemptToken,reason:'previous_chatgpt_channel_changed_before_native_send_no_retry'});summary.unknown++;break;}
   let accepted;
   try{accepted=await tools.mcp__codex_app__send_message_to_thread({threadId:THREAD,prompt:job.requestText});}
   catch{await rpc('unknown',{jobId:job.id,attemptToken:job.attemptToken,reason:'native_send_threw_outcome_unknown_no_resend'});summary.unknown++;break;}
   if(!acceptedOriginal(accepted)){await rpc('unknown',{jobId:job.id,attemptToken:job.attemptToken,reason:'native_send_tool_error_outcome_unknown_no_resend'});summary.unknown++;break;}
   const ack=await rpc('submitted',{jobId:job.id,attemptToken:job.attemptToken,accepted:true});
   if(!ack.ok){summary.unknown++;break;}
   summary.sent++;notify('ChatGPT 接力已提交一条消息，正在等待原会话回执。');
   if(cfg.once)break;
  }else break;
  if(Date.now()-started>=maxMs)break;
  await rpc('heartbeat',{workerId:WORKER});
  await new Promise(r=>setTimeout(r,pollMs));
 }while(Date.now()-started<maxMs);
 return summary;
}
try{return await run();}
finally{try{await rpc('close');}catch{}}


