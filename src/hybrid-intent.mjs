import {activeInstruction} from './collaboration-intent.mjs';
import {assert,INTENT_MESSAGE_METADATA,ROLES} from './workbench.mjs';
const aliases={'chatgpt':'chatgpt','chatgpt observer':'chatgpt','observer':'chatgpt','hermes':'hermes','deepseek':'deepseek','deepseek harness':'deepseek','dsh':'deepseek'};
export function executeHybridIntent(w,p,ctx,b){
 assert(typeof b.text==='string'&&b.text.trim()&&b.text.length<=6000,'hybrid_intent_text_required');
 const unsupported=summary=>({status:'UNSUPPORTED',intent:'unsupported',summary:'未执行：'+summary}),clarify=question=>({status:'CLARIFICATION_REQUIRED',intent:'clarification',question,summary:'未执行：'+question});
 let text=activeInstruction(b.text),rs=[];
 if(/^(?:请)?接受(?:这个|该|所选)?任务结果[。!！]*$/.test(text)){
  if(!b.selectedItemId)return clarify('要接受哪个文字任务结果？请选择一个任务。');
  return {status:'EXECUTED',intent:'task_accept',summary:'已接受所选文字任务结果；不构成工程实施授权。',result:w.acceptTextTask(ctx,b.selectedItemId,b,p)};
 }
 while(text.startsWith('@')){const m=text.slice(1).match(/^(ChatGPT Observer|DeepSeek Harness|ChatGPT|Observer|Hermes|DeepSeek|DSH)(?![A-Za-z0-9_])[\s,，:：]*/i);if(!m)return unsupported('请用明确的原会话接收方，不自动推断全部参与者。');rs.push(aliases[m[1].toLowerCase()]);text=text.slice(m[0].length+1);}
 if(!rs.length){const m=text.match(/^(?:请)?(?:发送给|发给|交给|委派给|告诉|让|请|向)\s*(ChatGPT Observer|DeepSeek Harness|ChatGPT|Observer|Hermes|DeepSeek|DSH)(?![A-Za-z0-9_])[\s,，:：]*/i);if(m){rs=[aliases[m[1].toLowerCase()]];text=text.slice(m[0].length);}}
 if(!rs.length)rs=b.recipients?.length?b.recipients:JSON.parse(w.scope(ctx).recipients);rs=[...new Set(rs||[])];
 if(!rs.length||!rs.every(r=>ROLES.includes(r)))return clarify('这条文字请求发给谁？');
 const command=text.replace(/^(?:(?:请|帮我|帮忙|麻烦)\s*)+/,'');
 if(/^(?:对[\s\S]*?)?(?:发起|开始|进行)?\s*(?:正式(?:文字)?(?:审查|审批)|独立(?:复核|审查|审阅|检查))/.test(command)||/(?:完成后|然后|随后).*(?:复核|审查|审批)/.test(command))return unsupported('正式审查和自主协作链保持锁定。');
 if(/^(?:删除|移除|清空|暂停|恢复|取消|转发|转交|批准|审批|注册|创建工程|新建工程|修改配置|启动|运行命令|执行命令|继续|接着)/.test(command)||b.packageId||b.packageVersion!==undefined)return unsupported('当前只处理普通文字消息与完整的单步文字任务。');
 const task=/^(?:委派|安排|负责|执行|完成|处理|撰写|编写|写一|起草|分析|整理|总结|汇总|概括)/.test(command);if(task&&rs.length!==1)return clarify('这个文字任务由谁负责？请指定一名执行者。');
 if(task&&(b.selectedItemId||b.selectedMessageId))return unsupported('请把文字任务完整写入输入框，不自动继承旧事项。');
 const intent=task?'delegate_task':'chat',metadata={[INTENT_MESSAGE_METADATA]:{originalText:b.text,intent,context:{}}};
 const result=task?w.textTask(ctx,{...metadata,title:command.slice(0,100),body:b.text,executor:rs[0]}):w.chat(ctx,{...metadata,text:b.text,targets:rs,replyTo:b.replyTo});
 return {status:'EXECUTED',intent,summary:task?'文字任务已排队；未确认收到或完成。':'定向消息已按接收方分别排队；未确认收到。',recipients:rs,result:{...result,mode:'HYBRID_NATIVE',simulation:false,executionAuthorized:false}};
}

