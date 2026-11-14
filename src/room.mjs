import {hash}from'./core.mjs';import{structuredObjects,PINNED}from'./workflow.mjs';
export const NAMES={chatgpt:'ChatGPT',deepseek:'DeepSeek',hermes:'Hermes'};
const labels={approve:'通过',request_changes:'要求修改',reject:'拒绝',abstain:'无法判断'};
export function mentionTargets(text,explicit=[]){
 const found=[...String(text).matchAll(/@(chatgpt|deepseek|hermes|gpt|ds|全部)(?![\w])/gi)].flatMap(m=>m[1]==='全部'?Object.keys(NAMES):[{gpt:'chatgpt',ds:'deepseek'}[m[1].toLowerCase()]||m[1].toLowerCase()]);
 const out=[...new Set([...explicit,...found])];if(!out.length||out.some(x=>!NAMES[x]))throw Error('请用 @ChatGPT、@DeepSeek、@Hermes 或接收方按钮指定对象');return out;
}
export function readable(raw){
 if(!raw)return'';if(/^TRB_ACK [a-f0-9-]+ [a-f0-9]+$/.test(raw.trim()))return '已收到原会话接通验证回执，原始编号保留在技术详情中。';
 const old=raw.match(/^TRB_REQUEST [a-f0-9]{64} (\{[\s\S]*\})$/);
 if(old){try{const p=JSON.parse(old[1]);return [p.operation,p.case?.title?'事项：'+p.case.title:'',p.case?.material,...Object.entries(p.reviews||{}).map(([r,v])=>NAMES[r]+'：'+(labels[v.verdict]||v.verdict)+'\n'+v.reason)].filter(Boolean).join('\n\n');}catch{}}
 const roots=structuredObjects(raw),v=roots.find(x=>x.type&&x.case_id)||roots.find(x=>x.protocol==='TRB_ACTION_V2');
 if(v){
  let prose=raw.replace(/(?:^|\n)\u0060{3}(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n\u0060{3}(?=\r?\n|$)/gi,(block,body)=>{try{const x=structuredObjects(body)[0];return x&&(x.case_id||x.protocol==='TRB_ACTION_V2')?'':block;}catch{return block;}}).trim();
  if(prose.startsWith('{')&&prose.endsWith('}'))prose='';
  if(prose)return prose;
  if(v.type==='review')return (labels[v.verdict]||'审查意见')+'\n\n'+v.reason+(v.conditions?.length?'\n\n需要处理：\n'+v.conditions.map(x=>'• '+x).join('\n'):'');
  return v.result||v.body||v.comment||[v.title,v.body].filter(Boolean).join('\n\n');
 }
 return raw.replace(/\n\n请先用自然文字表达真实判断[\s\S]*$/,'').replace(/^TRB_(?:CHAT|REQUEST) [a-f0-9]{64}\r?\n/,'').replace(/\n【仅供平台核对】[\s\S]*$/,'').trim();
}
export function roomSnapshot(w){
 const rows=[],deliveries=w.list('delivery'),cases=w.list('case'),sources=w.list('room_source');
 for(const i of cases){
  if(i.scope==='text_only_chat')rows.push({id:'chat:'+i.id,speaker:'user',targets:i.targets,text:i.body,at:i.createdAt,kind:'chat',replyTo:i.replyTo,status:deliveries.filter(d=>d.caseId===i.id).map(d=>({role:d.role,state:d.state,paused:w.control().paused||w.control().rolePaused?.[d.role],reason:d.reason}))});
 }
 for(const d of deliveries){
  const i=cases.find(x=>x.id===d.caseId);if(!i)continue;
  if(i.scope!=='text_only_chat')rows.push({id:'request:'+d.id,speaker:i.author==='user'?'user':i.author,targets:[d.role],text:readable(d.prompt||w.render(d)),at:d.sentAt||d.createdAt,kind:d.kind,archived:!!i.suspended,status:[{role:d.role,state:d.state,paused:w.control().paused||w.control().rolePaused?.[d.role],reason:d.reason}],source:{deliveryId:d.id,sessionId:d.sessionId},raw:d.prompt});
  if(d.rawReply)rows.push({id:'answer:'+d.id,speaker:d.role,text:readable(d.rawReply),at:d.receivedAt,kind:'assistant',archived:!!i.suspended,source:{deliveryId:d.id,sessionId:d.sessionId,coverage:d.proof?.coverage},raw:d.rawReply});
 }
 for(const m of sources){
  const d=m.deliveryId?deliveries.find(x=>x.id===m.deliveryId):null;
  if(d&&(m.speaker==='user'||d.rawReply))continue;
  rows.push({...m,text:readable(m.raw),kind:'mirror'});
 }
 rows.sort((a,b)=>String(a.at).localeCompare(String(b.at))||a.id.localeCompare(b.id));
 return{at:new Date().toISOString(),control:w.control(),messages:rows.slice(-200),mirrors:w.list('mirror_status'),pinned:PINNED};
}
export class RoomMirror{
 constructor(w,bridge){this.w=w;this.bridge=bridge;this.busy=false;}
 start(){this.timer=setInterval(()=>this.tick(),5000);this.tick();}stop(){clearInterval(this.timer);}
 async tick(){if(this.busy)return;this.busy=true;try{for(const role of Object.keys(NAMES)){
  try{const source=await this.bridge.passive(role);if(source.error)throw Error(source.error);
   for(const m of source.messages||[]){if(!m.text?.trim())continue;const id=hash(role+':'+m.id);const old=this.w.get('room_source',id);const d=this.w.list('delivery').find(x=>x.role===role&&x.prompt&&(x.prompt===m.userText||x.prompt===m.text));
    this.w.put('room_source',id,{id:'source:'+id,role,speaker:m.speaker==='assistant'?role:'user',targets:m.speaker==='user'?[role]:[],raw:m.text,at:old?.at||m.at||new Date().toISOString(),deliveryId:d?.id,streaming:!!m.streaming,source:{sessionId:PINNED[role].id,sourceId:m.id,coverage:source.coverage}});
   }
   this.w.put('mirror_status',role,{role,status:'synced',detail:source.detail||'只读同步，不触碰草稿',at:new Date().toISOString(),coverage:source.coverage});
  }catch(e){this.w.put('mirror_status',role,{role,status:'cached',detail:e.message==='original_not_visible'?'原会话当前未显示，仅展示已同步消息；切回指定原会话后恢复只读同步':e.message,at:new Date().toISOString()});}
 }}finally{this.busy=false;}}
}