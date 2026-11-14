import * as transport from './transports.mjs';
import {PINNED,structuredObjects}from'./workflow.mjs';
import {writeFileSync,mkdirSync,existsSync}from'node:fs';import{join}from'node:path';import{root}from'./config.mjs';
const inflight=['sending','submitted','waiting','unknown'];
export class Supervisor{
 constructor(workflow,bridge=transport,options={}){this.w=workflow;this.transport=bridge;this.evidenceDir=options.evidenceDir||join(root,'evidence','phase2');this.stopped=false;this.desktopBusy=false;this.hermesBusy=false;this.turn=0;this.lastWatch={};this.notBefore={};mkdirSync(this.evidenceDir,{recursive:true});}
 start(){this.timer=setInterval(()=>this.tick(),3000);this.tick();}
 stop(){this.stopped=true;clearInterval(this.timer);}
 status(role,status,detail=''){this.w.heartbeat(role,{status,detail,transport:role==='hermes'?'existing-gateway':'independent-windows-uia',pid:process.pid});}
 async tick(){
  if(this.stopped)return;
  if(!this.hermesBusy){this.hermesBusy=true;this.step('hermes').catch(e=>this.status('hermes','error',e.message)).finally(()=>this.hermesBusy=false);}
  if(!this.desktopBusy){this.desktopBusy=true;const role=['chatgpt','deepseek'][this.turn++%2];this.step(role).catch(e=>this.status(role,'error',e.message)).finally(()=>this.desktopBusy=false);}
 }
 async collect(role,d){
  let v;try{v=await this.transport.read(role,d);}catch(e){this.status(role,'waiting',e.message);return;}
  if(v.error){this.status(role,'waiting',v.error);return;}
  if(v.conflict){if(d.state!=='unknown')this.w.uncertain(role,d.id,d.lease,'another_user_message_arrived');this.status(role,'needs_attention','人工消息与本轮交错，未自动归属');return;}
  if(!v.requestSeen){
   if(Date.now()-Date.parse(d.sentAt)>180000&&d.state!=='unknown')this.w.uncertain(role,d.id,d.lease,'request_not_observed_no_resend');
   this.status(role,d.state==='unknown'?'needs_attention':'waiting','原会话尚未确认本条消息；不会重发');return;
  }
  if(['sending','submitted'].includes(d.state)||d.state==='unknown'&&!d.sourceUserId){this.w.confirmObserved(role,d.id,d.lease,v.sourceUserId);d=this.w.get('delivery',d.id);}
  if(!v.completed){this.status(role,'waiting','原会话仍在生成');return;}
  if(v.noToolCalls!==true){if(d.state!=='unknown')this.w.uncertain(role,d.id,d.lease,'unexpected_tool_activity_or_unverified_trace');this.status(role,'needs_attention','不能将带工具活动的回复自动计为本轮审查');return;}
  try{
   const observed=join(this.evidenceDir,d.id+'.observed.json');
   if(!existsSync(observed))writeFileSync(observed,JSON.stringify({deliveryId:d.id,proof:v},null,2));
   const item=this.w.receive(role,d.id,d.lease,v.reply,v);
   writeFileSync(join(this.evidenceDir,d.id+'.json'),JSON.stringify({delivery:{...d,lease:undefined},proof:v,caseState:item.state},null,2));
   const result=this.w.get('delivery',d.id).value;
   const actions=['chat','text_task'].includes(d.kind)?[]:[...(Array.isArray(result.outgoing_requests)?result.outgoing_requests:[]),...structuredObjects(v.reply).filter(x=>x.protocol==='TRB_ACTION_V2')];
   for(const action of actions.slice(0,2)){
    try{this.w.ingest(role,JSON.stringify(action),{...v,parentCaseId:d.caseId,containerRaw:v.reply});}
    catch(e){this.w.log('action.refused',{role,deliveryId:d.id,reason:e.message});}
   }
   this.status(role,'idle','回执已按原会话、版本、哈希与随机编号校验');
  }catch(e){if(d.state!=='unknown')this.w.uncertain(role,d.id,d.lease,e.message);this.status(role,'needs_attention',e.message);}
 }
 async step(role,context=null){
  const laneKey=context?context.workspaceId+':'+role:role;
  if(this.w.control().rolePaused?.[role]){this.status(role,'paused','该方已由用户单独暂停；不查看、不发送、不改写草稿');return;}
  const pending=this.w.list('delivery').find(d=>d.role===role&&this.w.deliveryAllowed(d,context)&&inflight.includes(d.state)&&!this.w.get('case',d.caseId)?.suspended);
  if(pending){await this.collect(role,pending);return;}
  if(this.w.control().paused){this.status(role,'paused');return;}
  if(Date.now()<(this.notBefore[laneKey]||0)){this.status(role,'waiting','等待桌面空闲或本机连接恢复');return;} let d=this.w.claim(role,context);
  if(!d){
   const queued=this.w.list('delivery').some(x=>x.role===role&&x.state==='queued');this.status(role,queued?'waiting':'idle',queued?'等待投递额度；每小时上限 '+this.w.control().maxPerHour:'');
   if(Date.now()-(this.lastWatch[laneKey]||0)>20000){this.lastWatch[laneKey]=Date.now();try{const a=await this.transport.latestAction(role);if(a?.raw)for(const action of structuredObjects(a.raw).filter(x=>x.protocol==='TRB_ACTION_V2').slice(0,2))this.w.ingest(role,JSON.stringify(action),{...a,containerRaw:a.raw});}catch(e){this.status(role,'waiting',e.message);}}
   return;
  }
  let baseline;
  try{baseline=await this.transport.inspect(role,{select:true,context});}catch(e){this.w.release(role,d.id,d.lease,e.message);this.status(role,'waiting',e.message);return;}
  if(baseline.error||baseline.title!==this.w.identity(role,d).title||baseline.busy||baseline.draft||role!=='hermes'&&!baseline.editorReady){
   const reason=baseline.error||'等待指定原会话空闲，保留现有草稿';this.w.release(role,d.id,d.lease,reason);this.notBefore[laneKey]=Date.now()+12000;this.status(role,'waiting',reason);return;
  }
  if(this.w.control().paused||this.w.control().rolePaused?.[role]||this.w.get('case',d.caseId)?.suspended||!this.w.canSend(d)){this.w.release(role,d.id,d.lease,'paused_before_input');this.status(role,'paused');return;}
  d=this.w.sending(role,d.id,d.lease,baseline);this.status(role,'sending','仅向指定原会话提交一次');
  let result;try{result=await this.transport.send(role,d,baseline);}catch(e){this.w.uncertain(role,d.id,d.lease,e.message);this.status(role,'needs_attention',e.message);return;}
  if(result.error){
   if(result.mutationStarted===false){this.w.deferUnsent(role,d.id,d.lease,result.error);this.notBefore[laneKey]=Date.now()+12000;this.status(role,'waiting',result.error);}
   else{this.w.uncertain(role,d.id,d.lease,result.error);this.status(role,'needs_attention',result.error);}
   return;
  }
  if(result.submitted||result.submittedExistingDraft)d=this.w.submitted(role,d.id,d.lease,result);
  await this.collect(role,d);
 }
}
