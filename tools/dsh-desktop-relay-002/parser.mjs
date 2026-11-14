import {createHash} from 'node:crypto';
export const APP='process:C:\\Users\\Administrator\\AppData\\Local\\Programs\\DeepSeek Harness\\DeepSeek Harness.exe';
export const WINDOW_TITLE='主进度 — DeepSeek Harness',CONVERSATION='主进度',EDITOR='发消息或创建任务, / 调用指令, @ 文件或对话';
export const ORIGINAL_ANCHOR='TRB_REAL_LINK trb-real-links-20261112-001.HD-02.ce4fa58232776ad142d9f921.FORWARD';
export const EXPECTED_NATIVE_SESSION='session-ebd654d5-1bf8-419c-bc2a-d9be1ed023fc';
export const sha=v=>createHash('sha256').update(v,'utf8').digest('hex');
export const demand=(v,c)=>{if(!v)throw Error(c);};
const roles=new Set(['编辑','文本','按钮','文档','状态','切换按钮','复选框','图像','组合框','分组','工具栏','超链接','窗口','窗格','滚动条','选项卡','列表','列表项','树','树项','进度栏']);
export function parseTree(tree){
 demand(typeof tree==='string'&&tree.length<=1000000,'dsh_accessibility_unavailable_or_oversize');const nodes=[];
 for(const line of tree.replace(/\r\n/g,'\n').split('\n')){const m=line.match(/^(\s*)(\d+)\s+(\S+)(?:\s+(.*))?$/);if(m)nodes.push({index:Number(m[2]),role:m[3],depth:m[1].length,text:m[4]||'',raw:line});else if(nodes.length){nodes.at(-1).text+='\n'+line;nodes.at(-1).raw+='\n'+line;}}
 demand(nodes.length>0&&new Set(nodes.map(n=>n.index)).size===nodes.length,'dsh_ambiguous_accessibility_indices_'+nodes.filter((n,i)=>nodes.findIndex(p=>p.index===n.index)!==i).map(n=>n.index).slice(0,5).join('_'));return nodes;
}
export function editorValue(node){
 const at=node.text.indexOf(' Value: ');if(at<0)return {observed:false,text:'',emptyByProviderOmission:true};
 return{observed:true,text:node.text.slice(at+8),emptyByProviderOmission:false};
}
const label=n=>n.text.replace(/^\([^)]*\)\s*/,'').split(' Value: ')[0].trim();
export function parseScene(state,{allowedAnchors=[{kind:'ORIGINAL_HEADER',text:ORIGINAL_ANCHOR,sha256:sha(ORIGINAL_ANCHOR)}],job}={}){
 demand(state?.window?.app===APP&&state.window.title===WINDOW_TITLE,'dsh_bound_window_identity_changed');
 const tree=state.accessibility?.tree,nodes=parseTree(tree),editors=nodes.filter(n=>n.role==='编辑'&&label(n)===EDITOR),senders=nodes.filter(n=>n.role==='按钮'&&label(n)==='发送消息');
 demand(editors.length===1&&senders.length===1&&senders[0].index>editors[0].index,'dsh_editor_or_submit_not_unique');const editor=editors[0],send=senders[0],value=editorValue(editor);
 const anchor=allowedAnchors.find(a=>['ORIGINAL_HEADER','COMPLETED_REQUEST_MARKER'].includes(a.kind)&&sha(a.text)===a.sha256&&nodes.some(n=>n.role==='文本'&&(a.kind==='ORIGINAL_HEADER'?n.text.startsWith(a.text):n.text.includes(a.text))));
 const busy=nodes.some(n=>n.role==='按钮'&&!/\(disabled\)/.test(n.text)&&/^(?:停止|停止生成|停止消息生成|Stop generating)$/.test(label(n)));
 const focused=String(state.accessibility?.focused_element||''),focusIndex=focused.match(/^\s*(\d+)\s+编辑(?:\s|$)/),editorFocused=Number(focusIndex?.[1])===editor.index;
 const own=job?ownVisibleReply(nodes,job):null;
 return {nodes,editorIndex:editor.index,sendIndex:send.index,editorSettable:/\(.*settable/.test(editor.text),editorFocused,value,sendEnabled:!/\(disabled\)/.test(send.text),draftPresent:value.observed?value.text.length>0:!/\(disabled\)/.test(send.text),busy,anchor:anchor||null,own,focused,reviewLines:nodes.filter(n=>n===editor||n===send||n.role==='按钮'&&/停止/.test(n.text)||anchor&&n.role==='文本'&&n.text.startsWith(anchor.text)||own?.indices?.includes(n.index)).map(n=>n.raw)};
}
export function ownVisibleReply(nodes,job){
 const matches=nodes.filter(n=>n.role==='文本'&&n.text===job.requestText);if(matches.length!==1)return {requestVisible:false,complete:false,reason:matches.length?'multiple_own_user_nodes':'exact_own_user_not_visible'};
 const user=matches[0],start=nodes.indexOf(user),copy=nodes.findIndex((n,i)=>i>start&&n.role==='按钮'&&label(n)==='复制');if(copy<0)return{requestVisible:true,complete:false,reason:'own_user_copy_boundary_not_visible'};
 const completed=nodes.findIndex((n,i)=>i>copy&&n.role==='按钮'&&/已完成/.test(label(n)));if(completed<0)return{requestVisible:true,complete:false,reason:'own_assistant_completed_boundary_not_visible'};if(nodes.slice(copy+1,completed).some(n=>n.role==='按钮'&&label(n)==='复制'))return{requestVisible:true,complete:false,reason:'intervening_visible_message'};
 const end=nodes.findIndex((n,i)=>i>completed&&n.role==='按钮'&&label(n)==='复制');if(end<0)return{requestVisible:true,complete:false,reason:'own_assistant_copy_boundary_not_visible'};
 const between=nodes.slice(completed+1,end);if(between.some(n=>n.role==='文本'&&/^TRBDSH[A-F0-9]{28}/.test(n.text)&&n.text!==job.requestMarker))return{requestVisible:true,complete:false,reason:'intervening_own_request_boundary'};
 const texts=between.filter(n=>n.role==='文本').map(n=>n.text);const replyText=texts.join('\n');if(!replyText.trim()||replyText.length>30000||!replyText.includes(job.requestMarker))return{requestVisible:true,complete:false,reason:'whole_visible_reply_or_marker_missing'};
 return {requestVisible:true,complete:true,userText:user.text,replyText,replySha256:sha(replyText),indices:nodes.slice(start,end+1).map(n=>n.index),projection:'UI_VISIBLE_TEXT',authorBoundaryObserved:true};
}