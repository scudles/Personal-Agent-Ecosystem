import {activeInstruction} from './collaboration-intent.mjs';
import {INTENT_MESSAGE_METADATA,assert} from './workbench.mjs';

// Bounded relay-only command surface. The simulation intent executor retains its
// own mode assertion and is never made to pretend a relay is simulated.
export function executeRelayIntent(w,principal,ctx,b){
 assert(typeof b.text==='string'&&b.text.trim()&&b.text.length<=6000,'invalid_intent_text');
 const unsupported=summary=>({status:'UNSUPPORTED',intent:'unsupported',summary:'未执行：'+summary});
 let text=activeInstruction(b.text),recipients=b.recipients;
 const address=text.match(/^(?:@|(?:请)?(?:发送给|发给|交给|委派给|告诉|让|请|向)\s*)(ChatGPT(?: Observer)?|Observer)(?![A-Za-z0-9_])[\s,，:：]*(.*)$/is);
 if(address){recipients=['chatgpt'];text=address[2];}
 else if(/^@/.test(text)||/^(?:请)?(?:发送给|发给|交给|委派给|告诉|让|请|向)\s*(?:Hermes|DeepSeek|DSH)/i.test(text))return unsupported('此接力只支持当前绑定的 ChatGPT 原对话。');
 if(/^@/.test(text))return unsupported('此接力只支持一名明确接收者。');
 if(!recipients?.length)recipients=JSON.parse(w.scope(ctx).recipients);
 if(!Array.isArray(recipients)||recipients.length!==1||recipients[0]!=='chatgpt')return unsupported('请明确选择当前绑定的 ChatGPT；不能共享或跨项目自动路由。');
 const command=text.replace(/^(?:(?:请|帮我|帮忙|麻烦)\s*)+/,'');
 if(/^(?:对[\s\S]*?)?(?:发起|开始|进行)?\s*(?:正式(?:文字)?(?:审查|审批)|独立(?:复核|审查|审阅|检查))/.test(command)||/(?:完成后|然后|随后).*(?:复核|审查|审批)/.test(command))return unsupported('正式审查与自主协作计划保持锁定；当前没有完整原生工具轨迹。');
 if(/^(?:删除|移除|清空|暂停|恢复|取消|转发|转交|批准|审批|注册|创建工程|新建工程|修改配置|启动|运行命令|执行命令)/.test(command))return unsupported('此接力仅支持明确的普通文字聊天与纯文字任务。');
 const control=w.control();if(w.scope(ctx).paused||control.paused||control.rolePaused?.chatgpt||w.binding(ctx,'chatgpt')?.paused)return unsupported('平台、空间或接入已暂停。');
 const task=/^(?:委派|安排|负责|执行|完成|处理|撰写|编写|写一|起草|分析|整理|总结|汇总|概括)/.test(command);
 if(/^(?:继续|接着)/.test(command)||b.packageId||b.packageVersion!==undefined)return unsupported('当前未支持跨步骤续接或工程材料。');
 const intent=task?'delegate_task':'chat',metadata={[INTENT_MESSAGE_METADATA]:{originalText:b.text,intent,context:{}}};
 let body=b.text;
 if(task&&(b.selectedItemId||b.selectedMessageId))return unsupported('请把纯文字任务完整写入输入框；当前未自动继承所选事项。');
 const result=task?w.textTask(ctx,{...metadata,title:command.slice(0,100),body,executor:'chatgpt',knowledgeRefs:b.knowledgeRefs}):w.chat(ctx,{...metadata,text:body,targets:['chatgpt'],replyTo:b.replyTo,knowledgeRefs:b.knowledgeRefs});
 return {status:'EXECUTED',intent,summary:task?'纯文字任务已排队；尚未确认收到或完成，不构成工程实施授权。':'定向消息已排队；尚未确认原对话收到。',recipients:['chatgpt'],result:{...result,mode:'CODEX_RELAY',simulation:false,executionAuthorized:false}};
}

