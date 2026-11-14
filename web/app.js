let token=location.hash.slice(1)||sessionStorage.getItem('trb-local-token')||'';if(token)sessionStorage.setItem('trb-local-token',token);history.replaceState(null,'',location.pathname);
const q=s=>document.querySelector(s),names={chatgpt:'ChatGPT',deepseek:'DeepSeek',hermes:'Hermes'};
const labels={idle:'等待待办',paused:'已暂停',waiting:'等待原会话',sending:'正在投递',needs_attention:'需要处理',error:'接入异常',reviewing:'审查中',changes_requested:'要求修改',rejected:'未通过',approved:'审批通过',needs_user:'待你裁决',revision_queued:'等待原发起方修订',task_queued:'汇总已排队',awaiting_user_acceptance:'文字汇总已交付'};
const el=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;};let state=null;
async function api(path,body){if(!token)throw Error('请通过 D 盘的启动验证台.cmd 打开此页。');const r=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const v=await r.json();if(!r.ok)throw Error(v.error);return v;}
function details(title,content){const d=el('details');d.append(el('summary',title),el('pre',content));return d;}
function render(s){
 state=s;q('#pause').textContent=s.control.paused?'恢复流转':'暂停新投递';q('#status').textContent=s.control.paused?'当前已暂停：不向原会话发送新消息。单独暂停的接入保持暂停，保留草稿与不确定状态。':'流转已开启：每小时至多 '+s.control.maxPerHour+' 次投递，自动修订最多 3 版；空闲检查不调用模型。';
 q('#workers').replaceChildren();for(const[role,p]of Object.entries(s.pinned)){const w=s.workers.find(x=>x.role===role);const c=el('article');c.append(el('h3',names[role]),el('p',p.title),el('strong',labels[w?.status]||w?.status||'启动中'));if(w?.detail)c.append(el('p',w.detail));c.append(el('small',w?.at?new Date(w.at).toLocaleString('zh-CN'):''));q('#workers').append(c);}
 const openPanels=new Set([...q('#cases').querySelectorAll('details[open]')].map(d=>d.dataset.panel));
 if(!q('#cases textarea')){q('#cases').replaceChildren();if(!s.cases.length)q('#cases').append(el('p','还没有审查事项。'));
 for(const i of [...s.cases].filter(x=>x.scope!=='text_only_chat').reverse()){
  const card=el('article');card.append(el('h3',i.title),el('p',(i.suspended?'已冻结 · ':'')+(labels[i.state]||i.state)+' · 第 '+i.revision+' 版 · 发起：'+(names[i.author]||'你')),el('small',i.id),el('p','材料 SHA-256（256-bit，64字符十六进制）：'+i.artifactHash),el('small','UTF-8 字节数：'+new TextEncoder().encode(i.body).length),details('查看本版材料',i.body));
  const votes=el('div',undefined,'votes');for(const r of i.reviewers){const v=i.votes[r];const box=el('section');box.append(el('strong',names[r]+'：'+(v?({approve:'通过',request_changes:'要求修改',reject:'拒绝',abstain:'无法判断'}[v.verdict]):'待回复')));if(v){box.append(el('p',v.reason));if(v.conditions.length)box.append(el('p','条件：'+v.conditions.join('；')));box.append(details('原始回复',v.raw));}votes.append(box);}card.append(votes);if(i.history.length)card.append(details('历史版本与原始意见',JSON.stringify(i.history,null,2)));if(i.suspended)card.append(el('p',i.suspendedReason||'按用户要求冻结，不再投递。','warning'));
  const problems=s.deliveries.filter(d=>d.caseId===i.id&&d.state==='unknown');for(const d of problems)card.append(el('p',names[d.role]+'：'+d.reason+'。不会自动重发。','warning'));
  if(i.taskResult)card.append(details('已交付的文字汇总',i.taskResult.text));
  if(!i.suspended&&['changes_requested','rejected','needs_user','approved','awaiting_user_acceptance'].includes(i.state)&&!problems.length){const edit=el('button','提交修订版');edit.onclick=()=>{const area=el('textarea');area.value=i.body;area.rows=7;const save=el('button','送审新版本');save.onclick=async()=>{try{await api('/api/cases/'+i.id+'/revise',{body:area.value,expectedRevision:i.revision});q('#cases').replaceChildren();await refresh();}catch(e){q('#error').textContent=e.message;}};const cancel=el('button','取消编辑');cancel.onclick=()=>{area.remove();save.remove();cancel.remove();refresh();};edit.replaceWith(area,save,cancel);};card.append(edit);}
  q('#cases').append(card);
 }
 for(const [index,card]of [...q('#cases').children].entries())for(const [n,d]of [...card.querySelectorAll('details')].entries()){d.dataset.panel=index+':'+n;if(openPanels.has(d.dataset.panel))d.open=true;}
 }
 q('#phase1').replaceChildren();for(const p of s.phase1.probes)q('#phase1').append(el('p',names[p.role]+' · '+p.state+' · '+p.id));
}
async function refresh(){try{render(await api('/api/state'));q('#error').textContent='';}catch(e){q('#error').textContent=e.message;}}
q('#pause').onclick=async()=>{try{await api('/api/control',{paused:!state.control.paused,reason:'user dashboard'});await refresh();}catch(e){q('#error').textContent=e.message;}};
q('#create').onsubmit=async e=>{e.preventDefault();const reviewers=[...document.querySelectorAll('input[name=reviewer]:checked')].map(x=>x.value);try{await api('/api/cases',{title:q('#title').value,body:q('#body').value,reviewers,assignee:q('#assignee').value||null,taskInstruction:q('#taskInstruction').value||undefined,scope:'text_only_review'});q('#title').value='';q('#body').value='';q('#taskInstruction').value='';await refresh();}catch(e){q('#error').textContent=e.message;}};
refresh();setInterval(refresh,5000);
let roomMessages=[],replying=null,lastRoomKey='';
const deliveryLabels={queued:'等待投递',leased:'核对原会话',sending:'正在投递',waiting:'等待回复',received:'已收到回复',unknown:'需要核对，不会重发',superseded:'已被新版本替代'};
function renderRoom(room){
 roomMessages=room.messages;const container=q('#feed'),nearBottom=container.scrollHeight-container.scrollTop-container.clientHeight<90;
 const key=JSON.stringify(room.messages)+q('#show-history').checked;
 q('#room-sync').textContent='每 2 秒刷新 · 最近同步 '+new Date(room.at).toLocaleTimeString('zh-CN');
 q('#mirror-status').replaceChildren();for(const m of room.mirrors||[]){const line=el('p',names[m.role]+'：'+(m.status==='synced'?'只读同步中':'缓存')+' · '+m.detail,'mirror-line');q('#mirror-status').append(line);}
 if(key===lastRoomKey)return;lastRoomKey=key;const open=new Set([...container.querySelectorAll('details[open]')].map(x=>x.dataset.id));container.replaceChildren();
 const messages=room.messages.filter(m=>q('#show-history').checked||!m.archived);
 if(!messages.length)container.append(el('p','还没有消息。可先用 @ 指定一方，进行虚构文字演练。','muted'));
 for(const m of messages){
  const card=el('article',undefined,'message '+(m.speaker==='user'?'from-user':'from-agent')+' role-'+m.speaker);card.dataset.id=m.id;
  const head=el('div',undefined,'message-head'),who=names[m.speaker]||'你';head.append(el('strong',who));if(m.targets?.length)head.append(el('span','→ '+m.targets.map(r=>names[r]).join('、')));head.append(el('time',m.at?new Date(m.at).toLocaleString('zh-CN'):''));if(m.streaming)head.append(el('span','正在生成…','live-dot'));
  card.append(head);if(m.replyTo)card.append(el('p','针对先前消息的回复','muted'));card.append(el('div',m.text||'（尚无正文）','message-body'));
  if(m.status?.length)card.append(el('p',m.status.map(x=>names[x.role]+'：'+(x.paused&&x.state==='queued'?'已排队，接入暂停':deliveryLabels[x.state]||x.state)).join(' · '),'message-status'));
  const actions=el('div',undefined,'message-actions'),reply=el('button','回复');reply.type='button';reply.onclick=()=>{replying=m;q('#reply-context').hidden=false;q('#reply-text').textContent='回复 '+who+'：'+m.text.slice(0,140);if(m.speaker!=='user'&&!q('#chat-input').value.includes('@'+(names[m.speaker]||'')))q('#chat-input').value='@'+(m.speaker==='deepseek'?'DeepSeek':names[m.speaker])+' '+q('#chat-input').value;q('#chat-input').focus();};actions.append(reply);
  if(m.source||m.raw){const d=details('对账详情',JSON.stringify(m.source||{},null,2)+(m.raw?'\n\n原始记录：\n'+m.raw:''));d.dataset.id=m.id;d.open=open.has(m.id);actions.append(d);}card.append(actions);container.append(card);
 }
 if(nearBottom||!container.dataset.loaded)container.scrollTop=container.scrollHeight;container.dataset.loaded='1';
}
async function refreshRoom(){try{renderRoom(await api('/api/room'));}catch(e){q('#room-sync').textContent='同步暂不可用：'+e.message;}}
for(const button of document.querySelectorAll('[data-mention]'))button.onclick=()=>{const input=q('#chat-input'),mention='@'+button.dataset.mention;if(!input.value.includes(mention))input.value+=(input.value?' ':'')+mention+' ';input.focus();};
q('#cancel-reply').onclick=()=>{replying=null;q('#reply-context').hidden=true;};q('#show-history').onchange=()=>{lastRoomKey='';refreshRoom();};
q('#chat-form').onsubmit=async event=>{event.preventDefault();const input=q('#chat-input'),send=q('#chat-send');send.disabled=true;q('#chat-error').textContent='';try{await api('/api/chat',{text:input.value,replyTo:replying?.id||null,quote:replying?.text||null});input.value='';replying=null;q('#reply-context').hidden=true;q('#send-hint').textContent='已加入所选接收方的队列；原会话确认前不会标记已送达。';await refreshRoom();}catch(e){q('#chat-error').textContent=e.message;}finally{send.disabled=false;}};
refreshRoom();setInterval(refreshRoom,2000);