import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './config.mjs';
import {hash} from './core.mjs';
import {observe} from './dsh-observe.mjs';
import {PINNED} from './workflow.mjs';
const python=process.env.TRB_HERMES_PYTHON||'D:\\HermesAgent\\Data\\installs\\83877ba9c77f9088\\environments\\5bc19e6f42ea45dabc55719dcad90d00\\venv\\Scripts\\python.exe';
function child(executable,args,input,timeout=20000){
 return new Promise((resolve,reject)=>{
  const p=spawn(executable,args,{cwd:root,windowsHide:true,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'},stdio:['pipe','pipe','pipe']});
  let out='',err='',timedOut=false;const timer=setTimeout(()=>{timedOut=true;p.kill();},timeout);
  p.stdout.on('data',b=>{out+=b.toString('utf8');if(out.length>2000000)p.kill();});
  p.stderr.on('data',b=>{err+=b.toString('utf8');});
  p.on('error',e=>{clearTimeout(timer);reject(Error(e?.code==='ENOENT'?'transport_executable_missing:'+executable+' (is TRB_HERMES_PYTHON correct?)':String(e?.message||e)));});
  p.on('close',code=>{clearTimeout(timer);if(timedOut)return reject(Error('transport_timeout_outcome_unknown'));
   try{const v=JSON.parse(out.replace(/^\uFEFF/,'').trim());resolve(v);}catch{reject(Error('transport_failed_'+code+':'+err.slice(0,200)));}});
  p.stdin.on('error',()=>{});p.stdin.end(input||'','utf8');
 });
}
export const native=(role,operation,prompt)=>child(join(root,'runtime','desktop','DesktopSession.exe'),[role,operation],prompt||'');
const gateway=(operation,body)=>existsSync(python)?child(python,['-B',join(root,'native','hermes-v2.py'),operation],JSON.stringify(body||{}),30000):Promise.reject(Error('hermes_python_missing:'+python+' (set TRB_HERMES_PYTHON)'));
export async function inspect(role,{select=false}={}){
 if(role==='hermes')return gateway('inspect');
 const v=await native(role,select?'select':'inspect');
 if(v.error)return v;
 const editor=v.editors?.filter(e=>role==='deepseek'?e.name==='发消息或创建任务, / 调用指令, @ 文件或对话':e.name==='询问 ChatGPT');
 const draft=editor?.length!==1?true:editor[0].valueLength>0&&!editor[0].valueIsPlaceholder;
 let extra={};
 if(role==='deepseek'){const{rows,...o}=observe();extra={tailHash:o.tailHash,messageCount:o.messageCount,logBusy:o.busy};}
 return {...v,...extra,sessionId:PINNED[role].id,draft,editorReady:editor?.length===1,busy:v.busy||extra.logBusy||false};
}
export async function send(role,d,baseline){
 if(role==='hermes')return gateway('send',{deliveryId:d.id,prompt:d.prompt,baseline});
 return native(role,'send',d.prompt);
}
export async function read(role,d){
 if(role==='hermes')return gateway('read',{prompt:d.prompt});
 if(role==='deepseek'){
  const{rows,...o}=observe();const plain=c=>(c||[]).filter(x=>x.type==='text').map(x=>x.text).join('');
  const user=rows.findLast(x=>x.type==='user/message'&&plain(x.data?.content)===d.prompt);
  if(!user)return{requestSeen:false,sessionId:PINNED[role].id,busy:o.busy};
  const later=rows.filter(x=>x.seq>user.seq);
  const reply=later.findLast(x=>x.type==='assistant/message'&&plain(x.data?.message?.content));
  const intervening=later.some(x=>x.type==='user/message'&&x.data?.source?.kind!=='time-context');
  return {requestSeen:true,sessionId:PINNED[role].id,conflict:intervening,busy:o.busy,completed:!o.busy&&!!reply,
   noToolCalls:!later.some(x=>x.type==='tool/call'),promptText:d.prompt,sourceUserId:'request:'+hash(d.prompt),
   replyId:reply?.data?.message?.id,reply:reply?plain(reply.data.message.content):'',coverage:'persisted_session_events',requestSeq:user.seq};
 }
 const v=await native(role,'read');if(v.error)return v;
 if(v.title!==PINNED[role].title)return {error:'wrong_original_conversation'};
 const segment=v.segments?.findLast(s=>s.userText===d.prompt);
 if(!segment)return {requestSeen:false,sessionId:PINNED[role].id,busy:v.busy,anchorPresent:v.anchorPresent};
 return {requestSeen:true,sessionId:PINNED[role].id,busy:v.busy,completed:!v.busy,noToolCalls:v.toolButtons?.length===0,
  sourceUserId:'request:'+hash(d.prompt),replyId:'uia:'+hash(segment.userText+'\n'+segment.text),
  promptText:segment.userText,reply:segment.text,coverage:'visible_uia',anchorPresent:v.anchorPresent};
}
export async function latestAction(role){
 if(role==='deepseek'){
  const{rows,busy}=observe();if(busy)return null;
  const last=rows.findLast(x=>x.type==='assistant/message');
  const raw=last?.data?.message?.content?.filter(x=>x.type==='text').map(x=>x.text).join('')||'';
  return{raw,sessionId:PINNED[role].id,replyId:last?.data?.message?.id,completed:true,noToolCalls:!rows.slice(rows.findLastIndex(x=>x.type==='turn/start')).some(x=>x.type==='tool/call')};
 }
 // Idle ChatGPT monitoring never selects another conversation or takes focus.
 if(role==='chatgpt'){
  const o=await inspect(role);if(o.error||o.title!==PINNED[role].title||o.busy)return null;
  const v=await native(role,'read');if(v.error||v.title!==PINNED[role].title||v.busy||!v.assistantText)return null;
  return{raw:v.assistantText,sessionId:PINNED[role].id,replyId:'uia:'+hash(v.assistantText),completed:true,noToolCalls:v.toolButtons?.length===0};
 }
 if(role==='hermes')return gateway('latest'); return null;
}

export async function passive(role){
 if(role==='hermes')return gateway('tail');
 if(role==='deepseek'){
  const {rows,busy}=observe();let user='';const messages=[];
  for(const x of rows.filter(x=>x.type==='assistant/message'||x.type==='user/message'&&x.data?.source?.kind!=='time-context').slice(-50)){
   const isUser=x.type==='user/message';const content=isUser?x.data?.content:x.data?.message?.content;
   const text=(content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');if(!text)continue;if(isUser)user=text;
   messages.push({id:'dsh-event:'+x.seq,speaker:isUser?'user':'assistant',text,userText:user,streaming:busy&&!isUser&&x.seq===rows.at(-1)?.seq});
  }return{messages,coverage:'persisted_session_events'};
 }
 const v=await native('chatgpt','peek');if(v.error)return v;
 const messages=[];for(const s of v.segments||[]){const id=hash(s.userText);messages.push({id:'uia-user:'+id,speaker:'user',text:s.userText,userText:s.userText});messages.push({id:'uia-assistant:'+id,speaker:'assistant',text:s.text,userText:s.userText,streaming:!!v.busy});}
 return{messages,coverage:'visible_uia',detail:'仅同步原会话当前可见消息，不切换窗口或读取草稿'};
}
