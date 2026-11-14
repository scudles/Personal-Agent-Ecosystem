import{readFileSync,writeFileSync}from'node:fs';import{join}from'node:path';import{DatabaseSync}from'node:sqlite';import{observe}from'../src/dsh-observe.mjs';import{config,base,root,data}from'../src/config.mjs';
const db=new DatabaseSync(join(data,'bridge.sqlite'),{readOnly:true});
const row=db.prepare("SELECT body FROM items WHERE kind='probe' AND id=?").get(process.argv[2]);
db.close();if(!row)throw Error('probe_not_found');const p=JSON.parse(row.body);
if(p.role!=='deepseek')throw Error('wrong_role');
const{rows,...o}=observe();if(o.busy||o.identity!==p.identity)throw Error('not_idle_or_wrong_session');
const plain=c=>(c||[]).filter(x=>x.type==='text').map(x=>x.text).join('');
const request=rows.findLast(x=>x.type==='user/message'&&plain(x.data?.content)===p.prompt);
if(!request)throw Error('request_not_observed_no_resend');
const reply=rows.findLast(x=>x.type==='assistant/message'&&x.seq>request.seq&&plain(x.data?.message?.content).trim()===p.ack);
if(!reply)throw Error('reply_not_observed');
const intervening=rows.filter(x=>x.seq>=request.seq&&x.seq<=reply.seq);
if(intervening.some(x=>x.type==='tool/call'))throw Error('unexpected_tool_call');
const source={transport:'desktop-cua-send/persisted-session-readback',identity:o.identity,title:o.title,sourceFile:o.sourceFile,beforeCount:p.before.messageCount,afterCount:o.messageCount,request:{id:request.data.id,seq:request.seq,text:plain(request.data.content)},reply:{id:reply.data.message.id,seq:reply.seq,text:plain(reply.data.message.content)},newEventTypes:rows.filter(x=>x.seq>=request.seq).map(x=>({type:x.type,seq:x.seq})),noToolCalls:true};
writeFileSync(join(root,'evidence','deepseek-source.json'),JSON.stringify(source,null,2));
async function event(state,extra={}){const r=await fetch(base+'/bridge/event',{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify({id:p.id,claim:p.claim,event:{identity:p.identity,state,...extra}})});const x=await r.json();if(!r.ok)throw Error(x.error);return x;}
if(p.state==='sending'){await event('sent');await event('waiting');}else if(p.state==='sent')await event('waiting');else if(!['waiting','passed'].includes(p.state))throw Error('unexpected_probe_state');
if(p.state!=='passed'){const out=await event('received',{promptText:source.request.text,reply:source.reply.text,busy:false,sourceTurn:source.reply.id,messageCount:o.messageCount});console.log(JSON.stringify({id:out.id,state:out.state,reply:out.reply,sourceFile:o.sourceFile}));}else console.log('Already verified; nothing resent.');
