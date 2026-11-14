import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {assert, ROLES, INTENT_MESSAGE_METADATA} from './workbench.mjs';
import {GovernanceGuard} from '../governance/guard.mjs';
import {maskNonInstructions,parseCollaborationPlan} from './collaboration-plan.mjs';

// A deliberately bounded local command adapter. It never calls a model, adapter,
// authorisation endpoint or engineering package delivery endpoint.
const aliases = {hermes:'hermes',dsh:'deepseek',deepseek:'deepseek','deepseek harness':'deepseek',chatgpt:'chatgpt',observer:'chatgpt','chatgpt observer':'chatgpt'};
const names = '(?:ChatGPT Observer|DeepSeek Harness|ChatGPT|DeepSeek|Observer|Hermes|DSH)';
const aliasAtStart = new RegExp('^('+names+')(?![A-Za-z0-9_])','i');
const answer = (status,intent,summary,extra={}) => ({status,intent,summary,...extra});
const unsupported = summary => answer('UNSUPPORTED','unsupported','未执行：'+summary);
const clarify = (intent,question) => answer('CLARIFICATION_REQUIRED',intent,'未执行：需要补充一项信息。',{question});

// Only active user prose is classified. Quoted material remains untouched in the
// eventual body, but mentions inside it cannot select recipients or actions.
export function activeInstruction(text) {
  return maskNonInstructions(text).trim();
}

function directed(instruction) {
  let rest=instruction, recipients=[];
  // Explicit mentions select targets only in an address prefix, never by scanning
  // the whole message (including quotations, history, code or incidental names).
  while(rest.startsWith('@')) {
    const m=rest.slice(1).match(/^(全部|all)(?![A-Za-z0-9_])/i)||rest.slice(1).match(aliasAtStart);
    if(!m)return {invalid:true};
    recipients.push(/^(?:全部|all)$/i.test(m[1])?'all':aliases[m[1].toLowerCase()]);
    rest=rest.slice(1+m[1].length).replace(/^[\s,，、:：]+/,'');
  }
  if(recipients.length)return {recipients:[...new Set(recipients)],command:rest,all:recipients.includes('all')};
  const natural=new RegExp('^(?:请)?(?:帮我请|委派给|发送给|发给|交给|交由|由|告诉|让|请|向)\\s*('+names+')(?![A-Za-z0-9_])(?:[\\s,，:：]*)','i');
  const m=rest.match(natural);
  if(m)return {recipients:[aliases[m[1].toLowerCase()]],command:rest.slice(m[0].length),taskAddress:/(?:委派给|交给|交由|由)/.test(m[0])};
  const address=rest.match(new RegExp('^('+names+')(?![A-Za-z0-9_])\\s*[,，:：]\\s*','i'));
  return address?{recipients:[aliases[address[1].toLowerCase()]],command:rest.slice(address[0].length)}:{recipients:[],command:rest};
}

function classify(command) {
  const c=command.replace(/^(?:(?:请|帮我|帮忙|麻烦)\s*)+/,'').trim();
  if(/^(?:(?:查询|查看|显示)\s*)?(?:当前|这个|所选)?协作(?:计划)?(?:的)?(?:状态|进度)[？?。！!]*$/.test(c))return 'plan_status';
  if(/^(?:(?:查询|查看|显示|看一下)\s*)?(?:(?:当前|这个|所选|选中)\s*)?(?:任务|事项)(?:的)?(?:状态|进度)(?:是什么|怎么样|如何|如何了)?[？?。！!]*$/.test(c))return 'task_status';
  if(/^(?:(?:按|根据)\s*MAG(?:-001)?\s*)?(?:(?:说明|解释|查询)\s*)?(?:是否需要第三方|第三方是否需要|需要第三方吗|第三方(?:何时|什么时候)需要介入)[？?。！!]*$/i.test(c))return 'review_policy';
  if(/^(?:对[\s\S]+?)?(?:发起|开始|进行)?\s*正式(?:文字)?审查/.test(c))return 'formal_text_review';
  if(/^(?:对[\s\S]+?)?(?:(?:发起|开始|进行)\s*(?:正式)?审批|正式审批)/.test(c))return 'formal_text_review';
  if(/^(?:对[\s\S]+?)?(?:做|进行)?\s*独立(?:检查|复核|审查|审阅)/.test(c))return 'independent_review';
  if(/^(?:总结|汇总|概括|整理总结|请求总结)/.test(c))return 'request_summary';
  if(/^(?:委派|安排|负责|执行|完成|处理|继续|接着|撰写|编写|写一|起草|分析|整理)/.test(c))return 'delegate_task';
  return 'chat';
}

function selectedContext(w,ctx,b,view) {
  let item=b.selectedItemId?w.owned(ctx,'case',b.selectedItemId):null;
  const message=b.selectedMessageId?w.message(ctx,b.selectedMessageId):null;
  const reply=b.replyTo?w.message(ctx,b.replyTo):null;
  if(message?.case_id && item && message.case_id!==item.id)return {conflict:true};
  if(!item&&message?.case_id)item=w.owned(ctx,'case',message.case_id);
  if(reply?.case_id && item && reply.case_id!==item.id)return {conflict:true};
  if(!item&&reply?.case_id)item=w.owned(ctx,'case',reply.case_id);
  const tasks=view.items.filter(i=>!i.legacy&&!i.cancelled&&i.scope==='text_only_task');
  if(!item&&!message&&tasks.length===1)item=tasks[0];
  return {item,message,reply,ambiguous:!item&&!message&&tasks.length>1};
}

function contextText(context) {
  if(context.message)return '所选消息（作者 '+context.message.author+'，原文）：\n'+context.message.body;
  if(context.item)return '所选事项“'+context.item.title+'”的原文：\n'+context.item.body;
  return '';
}

function recipientsFor(w,ctx,b,route,context,intent) {
  if(route.recipients.length)return route.recipients;
  if(b.recipients!==undefined) {
    assert(Array.isArray(b.recipients)&&b.recipients.every(r=>ROLES.includes(r)),'explicit_workspace_recipients_required');
    if(b.recipients.length)return [...new Set(b.recipients)];
  }
  if(context.reply&&context.reply.author!=='user')return [context.reply.author];
  const current=JSON.parse(w.scope(ctx).recipients);
  if(current.length===1)return current;
  if(intent==='delegate_task'&&context.item?.assignee)return [context.item.assignee];
  return [];
}

function policy() {
  const {active}=new GovernanceGuard(fileURLToPath(new URL('../governance',import.meta.url))).load();
  if(active.status!=='ACTIVE'||active.version!=='MAG-001')return unsupported('当前治理版本需要人工核对，请使用治理入口。');
  const rules=readFileSync(new URL('../governance/REVIEW_LEVELS.md',import.meta.url),'utf8');
  return answer('EXECUTED','review_policy','MAG-001：普通任务不默认三方；L0自测，L1/L2一名必要复核者，第三方按实质需要介入。当前任务风险未由自然语言自动判定。',{
    result:{readOnly:true,version:active.version,riskAssessment:'NOT_INFERRED',source:'governance/REVIEW_LEVELS.md',rules}
  });
}

function packageReview(w,materials,principal,ctx,b,context,route,intent) {
  if(!materials)return unsupported('此服务未启用工程材料，请使用文字审查或已启用的材料入口。');
  if(b.knowledgeRefs?.length)return unsupported('密封工程包不能在发起复核时附加额外知识；请先通过材料入口形成包含所需引用的准确版本。');
  const e=materials.e;
  let packageId=b.packageId,version=b.packageVersion;
  const available=e.listPackages(principal,ctx).filter(p=>!context.item||p.taskId===context.item.id||p.task_id===context.item.id);
  if(!packageId) {
    const latest=available.filter(p=>!available.some(other=>other.id===p.id&&other.version>p.version));
    if(latest.length!==1)return clarify(intent,'本次要复核哪个工程包？请选择一个准确版本。');
    packageId=latest[0].id;version=latest[0].version;
  }
  if(version===undefined)return clarify(intent,'要复核这个工程包的哪个版本？');
  assert(Number.isInteger(version)&&version>0,'invalid_intent_package_version');
  const pkg=e.getPackage(principal,ctx,packageId,version),task=w.owned(ctx,'case',pkg.task_id);
  if(context.item&&context.item.id!==task.id)return clarify(intent,'选中的任务和工程包属于不同事项；本次要处理哪一个？');
  const definition=e.db.prepare('SELECT definition FROM uec_governed_tasks WHERE task_id=? AND project_id=? AND workspace_id=?').get(task.id,ctx.projectId,ctx.workspaceId);
  if(!definition)return clarify(intent,'该任务尚无冻结的风险与复核分工；请先在保留的治理入口登记这一项定义。');
  const governed=JSON.parse(definition.definition);
  const requested=route.recipients.length?route.recipients:b.recipients?.length?b.recipients:governed.reviewerIds;
  assert(Array.isArray(requested)&&requested.every(r=>ROLES.includes(r)),'explicit_workspace_recipients_required');
  const recipients=[...new Set(requested)];
  if(!recipients.length||recipients.length!==governed.reviewerIds.length||!recipients.every(r=>governed.reviewerIds.includes(r)))return clarify(intent,'接收者与此任务已冻结的必要复核者不一致；请在治理入口核对本次复核分工。');
  w.targets(ctx,recipients,false);
  const control=w.control();
  if(w.scope(ctx).paused||control.paused||recipients.some(r=>control.rolePaused?.[r]))return unsupported('平台、会话或必要复核者暂停，暂停保持，未创建审查或投递。');
  const rounds=materials.governance.rounds(ctx,task.id),existing=rounds.find(r=>r.packageId===packageId&&r.version===version);
  const attempts=materials.exchange.list(principal,ctx).filter(a=>a.package_id===packageId&&a.version===version&&recipients.includes(a.role));
  if(existing)return answer('EXECUTED',intent,'已查询本版已有审查；未重复发起或重投，未知投递仍待核对。',{
    recipients,result:{readOnly:true,round:existing,attempts,simulation:true,realAgentReceived:false,executionAuthorized:false}
  });
  // Do not turn an uncertain/manual material attempt into an implicit retry.
  if(attempts.length)return unsupported('本版已有材料投递记录，请先在材料入口核对；未重复投递或新增审查。');
  let review,queued;
  w.transaction(()=>{
    review=materials.governance.startReview(principal,ctx,{taskId:task.id,packageId,version});
    if(review.blocked)return;
    queued=materials.exchange.queue(principal,ctx,{packageId,version,recipients});
  });
  if(review.blocked)return answer('UNSUPPORTED',intent,'未执行：现有治理Host阻止了本次审查，请查看阻断原因。',{result:review});
  return answer('EXECUTED',intent,'已建立本版必要复核并创建模拟材料排队记录；未上传、未确认收件、尚无审查结论。',{
    recipients,result:{round:review.round,attempts:queued,simulation:true,realAgentReceived:false,executionAuthorized:false}
  });
}

export function executeCollaborationIntent(w,principal,ctx,b,{materials,planExecutor}={}) {
  assert(principal?.id==='local-owner','owner_permission_required');
  w.scope(ctx,true);w.access(principal,ctx,'read');
  assert(typeof b.text==='string'&&b.text.trim()&&b.text.length<=6000,'invalid_intent_text');
  const active=activeInstruction(b.text),route=directed(active),parsedPlan=parseCollaborationPlan(b.text);
  if(route.invalid)return unsupported('无法识别开头的接收者，请使用当前会话中的明确接收者。');
  if(!active)return unsupported('输入只有引用或代码，没有可执行指令。');
  if(parsedPlan?.status==='UNSUPPORTED')return unsupported(parsedPlan.summary);
  const hasPlan=parsedPlan?.status==='READY';
  const command=route.command||'',singleIntent=classify(command),intent=hasPlan?'collaboration_plan':route.taskAddress&&singleIntent==='chat'?'delegate_task':singleIntent;
  // Do not transform these actions into a successful chat. These boundaries are
  // intentionally conservative; this is not claimed to be general NLU.
  if(!hasPlan&&/(?:如果|若是|一旦|否则|然后|之后再|通过后|先[\s\S]+再|不通过[\s\S]+则)/.test(command))return unsupported('暂不支持条件链或多步协作；请逐步发出单个请求。');
  if(!hasPlan&&new RegExp('(?:[,，;；、。\\n]\\s*(?:让|请|交由|交给|由)?\\s*@?'+names+'\\s*(?:请)?(?:负责(?!的)|复核(?!的)|审查(?!的)|审阅(?!的)|检查(?!的)|参与|暂不参与|不参与|独立|整理|总结)|(?:让|请|交由|交给|由)\\s*@?'+names+'\\s*(?:负责|复核|审查|审阅|检查|参与|暂不参与|不参与|独立|整理|总结))','i').test(command))return unsupported('此请求包含多个Agent分工，本入口目前只支持一名负责人完成后交一名独立复核者；未执行其中任何一条。');
  if(new RegExp('^(?:和|与|及|、)\\s*@?'+names,'i').test(command))return unsupported('暂不支持这种多接收者句式；请使用输入区明确接收者或连续的开头 @ 地址。');
  if(/^(?:同意|赞同|可以|好的|好|没问题|通过|批准|确认|授权)(?:[，,。！!\s]|$)/.test(command))return unsupported('普通赞同没有记录为审批或实施授权；正式决定请使用保留的审批入口。');
  if(/^(?:请)?(?:我(?:现在|在此)?(?:决定)?)?(?:正式)?(?:批准|授权|确认通过|同意通过)/.test(command))return unsupported('正式批准未被记录，也未授予实施权限；请在保留的审批入口确认准确材料版本并记录用户决定。');
  if(/(?:授权实施|解除暂停|恢复投递|补[\s\S]*票|代[\s\S]*投票|上传|附件投递|原会话|真实投递|修改MAG)/i.test(command))return unsupported('该操作须使用专门入口及既有明确授权，本自然入口未执行。');
  if(intent==='chat'&&/^(?:请)?(?:删除|移除|清空|暂停|恢复|取消|转发|转交|批准|审批|注册|创建工程|新建工程|修改配置|启动|运行命令|执行命令)/.test(command))return unsupported('尚未可靠支持该操作，未将其降级为聊天；请使用保留的对应入口。');
  if(intent==='review_policy')return policy();
  if(route.all) {
    const participants=w.participants(ctx).filter(p=>p.enabled);
    const unavailable=participants.filter(p=>p.status!=='simulated_ready');
    if(!participants.length||unavailable.length)return unsupported('无法向当前会话全部参与者投递：'+(unavailable.map(p=>p.name+'（'+p.status+'）').join('、')||'没有有效参与者')+'；未省略接收者，未执行投递。');
    route.recipients=participants.map(p=>p.id);
  }
  const view=w.viewFor(principal,ctx),context=selectedContext(w,ctx,b,view);
  if(context.conflict)return clarify(intent,'选中的消息、回复或任务不是同一事项；本次要处理哪一个？');
  if(intent==='plan_status') {
    if(!planExecutor?.list)return unsupported('持久协作调度尚未启用，未将状态查询降级为聊天。');
    const plans=planExecutor.list(principal,ctx),matched=context.item?plans.filter(p=>p.ownerTaskId===context.item.id||p.reviewItemId===context.item.id):[];
    if(context.item&&!matched.length&&(b.selectedItemId||b.selectedMessageId||b.replyTo))return clarify(intent,'所选事项没有关联的协作计划；要查询哪个计划对应的任务？');
    const candidates=matched.length?matched:plans;
    if(candidates.length!==1)return clarify(intent,candidates.length?'当前有多个协作计划，要查询哪个计划对应的任务？':'当前会话尚无协作计划；请选择已创建计划对应的任务。');
    const plan=candidates[0];
    return answer('EXECUTED',intent,'已查询协作计划，当前状态 '+plan.state+'；此状态不构成实施授权。',{result:{readOnly:true,plan,simulation:true,executionAuthorized:false}});
  }
  if(intent==='task_status') {
    if(context.ambiguous)return clarify(intent,'当前有多个任务，要查询哪一个？');
    if(!context.item)return clarify(intent,'要查询哪一个任务？请选择当前会话中的任务。');
    const item=context.item,deliveries=view.deliveries.filter(d=>d.caseId===item.id);
    const unknown=deliveries.some(d=>d.state==='unknown');
    return answer('EXECUTED',intent,'已查询：'+item.title+'，事项状态 '+item.state+(unknown?'；有投递结果未知，尚未确认。':'。'),{
      result:{readOnly:true,item,deliveries,mode:view.mode,realAdaptersAuthorized:false}
    });
  }
  const isReview=['independent_review','formal_text_review'].includes(intent);
  const taskPackages=materials&&context.item?materials.e.listPackages(principal,ctx).filter(p=>p.taskId===context.item.id||p.task_id===context.item.id):[];
  if(isReview&&(b.packageId||b.packageVersion!==undefined||taskPackages.length||/(?:工程包|文件包|材料包|代码文件|仓库|工程文件)/.test(command)))return packageReview(w,materials,principal,ctx,b,context,route,intent);
  const inlineMaterial=isReview&&/(?:正式(?:文字)?审查|独立(?:检查|复核|审查|审阅))[：:]\s*\S/.test(command);
  const explicitReference=intent!=='chat'&&/(?:这个|这份|这段|所选|选中|上述|这些|该修改|该任务|已有上下文|当前(?:的)?(?:任务|事项|修改|材料|上下文|讨论|会话))/.test(command);
  const continuation=intent==='delegate_task'&&/^(?:(?:请|帮我|帮忙|麻烦)\s*)*(?:继续|接着)/.test(command);
  const needsContext=isReview&&!inlineMaterial||explicitReference||continuation;
  if(needsContext&&context.ambiguous)return clarify(intent,'当前有多个任务，本次要处理哪一个？');
  if(needsContext&&intent!=='request_summary'&&!context.item&&!context.message)return clarify(intent,'本次要处理哪条消息或哪个任务？请选择一个对象。');
  if(context.item&&(context.item.legacy||context.item.cancelled||context.item.suspended))return unsupported('所选事项已取消、冻结或仅为历史记录，未创建后续动作。');
  if(isReview&&context.item&&(context.item.scope==='text_only_review'||view.items.some(i=>i.parentCaseId===context.item.id&&i.scope==='text_only_review')))return unsupported('该事项已有文字审查；复用原审查与修订入口，未无依据重开新的审查。');
  const recipients=hasPlan?[parsedPlan.ownerId,parsedPlan.reviewerId]:recipientsFor(w,ctx,b,route,context,intent);
  if(!recipients.length)return clarify(intent,'这条请求发给谁？');
  if(['delegate_task','independent_review','formal_text_review'].includes(intent)&&recipients.length!==1)return clarify(intent,'本次请指定一名负责人或必要复核者。');
  if(isReview&&context.item?.assignee&&recipients.includes(context.item.assignee))return clarify(intent,'独立复核者应区别于当前任务负责人；请指定一名其他复核者。');
  w.targets(ctx,recipients,false);
  const scope=w.scope(ctx),control=w.control();
  if(scope.paused||control.paused||recipients.some(r=>control.rolePaused?.[r]))return unsupported('当前会话、平台或接收者处于暂停；暂停保持，未创建投递。');
  const explicitContext=Boolean(b.selectedItemId||b.selectedMessageId||b.replyTo);
  const conversationSummary=intent==='request_summary'&&!explicitContext&&!/(?:这个任务|当前任务|该任务)/.test(command);
  // The safety check follows the actual evidence fallback, including a summary
  // whose requested object is absent and would otherwise use conversation text.
  const usesConversationMessages=(needsContext||intent==='request_summary')&&(conversationSummary||!contextText(context));
  const referencedMessages=usesConversationMessages?view.messages:[context.message,context.reply].filter(Boolean);
  if(referencedMessages.some(m=>{
    const item=view.items.find(i=>i.id===m.case_id);
    return m.author!=='user'&&['independent','independent_then_cross'].includes(item?.reviewPlan)&&!w.firstComplete(item);
  }))return unsupported('当前引用包含尚未全部提交的独立初始意见；请保留原审查隔离，未转交或请求总结。');
  const linked=context.item&&!conversationSummary&&intent!=='chat'&&(needsContext||explicitContext);
  const inherited=linked?{parentCaseId:context.item.id,deadline:context.item.deadline}:{};
  if(linked) {
    const root=w.owned(ctx,'case',context.item.rootId||context.item.id);
    if(root.cancelled||root.suspended||Date.parse(root.deadline)<=Date.now()||context.item.depth>=root.limits.maxChain)return unsupported('上下文根事项已停止、到期或达到协作链上限，未创建后续动作。');
    inherited.deadline=root.deadline;
  }
  const evidence=needsContext||intent==='request_summary'?(!conversationSummary&&contextText(context))||view.messages.map(m=>m.author+'：\n'+m.body).join('\n\n'):'';
  const body=b.text+(evidence?'\n\n当前上下文（原文引用，不代表已完成或授权）：\n'+evidence:'');
  if(body.length>6000)return unsupported('当前材料超过文字入口长度上限，请使用已有任务或材料入口。');
  let result;
  const metadataContext={};
  if(context.message||context.reply)metadataContext.messageId=(context.message||context.reply).id;
  if(context.item&&(linked||explicitContext)&&!conversationSummary)Object.assign(metadataContext,{itemId:context.item.id,revision:context.item.revision,artifactHash:context.item.artifactHash});
  const messageMetadata={[INTENT_MESSAGE_METADATA]:{originalText:b.text,intent,context:metadataContext}};
  if(hasPlan) {
    if(b.packageId||b.packageVersion!==undefined)return unsupported('此组合入口仅安排离线文字任务与复核，工程包请使用已绑定版本的治理入口。');
    if(!planExecutor?.create||!planExecutor?.get)return unsupported('持久协作调度尚未启用；未仅执行负责人部分，也未创建内存依赖。');
    let durable;
    w.transaction(()=>{
      const created=planExecutor.create(principal,ctx,{format:parsedPlan.format,originalText:b.text,ownerId:parsedPlan.ownerId,reviewerId:parsedPlan.reviewerId,excludedIds:parsedPlan.excludedIds,instruction:parsedPlan.instruction,context:metadataContext,knowledgeRefs:b.knowledgeRefs});
      assert(created?.planId&&created?.ownerTaskId&&created.simulation===true&&created.executionAuthorized===false,'invalid_persistent_plan_result');
      const persisted=planExecutor.get(principal,ctx,created.planId),task=w.owned(ctx,'case',created.ownerTaskId);
      assert(persisted?.id===created.planId&&persisted.projectId===ctx.projectId&&persisted.workspaceId===ctx.workspaceId&&persisted.ownerTaskId===task.id&&persisted.ownerId===parsedPlan.ownerId&&persisted.reviewerId===parsedPlan.reviewerId&&task.assignee===parsedPlan.ownerId&&task.scope==='text_only_task','persistent_plan_verification_failed');
      assert(created.state==='WAITING_OWNER'&&persisted.state==='WAITING_OWNER'&&!persisted.reviewItemId,'plan_review_started_before_owner_result');
      assert(w.list('delivery').some(d=>d.caseId===task.id&&d.role===parsedPlan.ownerId&&d.kind==='text_task'),'plan_owner_task_not_queued');
      durable={...created,plan:persisted};
    });
    return answer('EXECUTED',intent,'负责人文字任务已排队，独立复核依赖已持久保存并等待负责人有效回执；尚无复核结论或实施授权。',{recipients,result:durable});
  }
  w.transaction(()=>{
    if(intent==='delegate_task')result=w.textTask(ctx,{...inherited,...messageMetadata,title:command.slice(0,100)||'文字任务',body,executor:recipients[0],knowledgeRefs:b.knowledgeRefs});
    else if(['independent_review','formal_text_review'].includes(intent)) {
      const item=context.item;
      result=w.createReview(ctx,{...inherited,...messageMetadata,title:'文字审查：'+(item?.title||'所选消息').slice(0,100),body,reviewers:recipients,reviewPlan:'independent',reviewScope:item?.reviewScope||'仅审查所选原文，不执行工程',constraints:item?.constraints,taskInstruction:command,knowledgeRefs:b.knowledgeRefs});
    } else result=w.chat(ctx,{...inherited,...messageMetadata,text:body,targets:recipients,replyTo:b.replyTo,knowledgeRefs:b.knowledgeRefs});
    // textTask's legacy method can return a case when its queue budget refused
    // admission. Reject and roll back instead of announcing a nonexistent action.
    assert(view.mode==='SIMULATION_ONLY'&&w.list('delivery').filter(d=>d.caseId===result.id).length===recipients.length,'intent_delivery_not_queued');
  });
  return answer('EXECUTED',intent,intent==='request_summary'?'已创建定向总结请求，尚未收到总结回复。':intent==='delegate_task'?'已创建文字任务并排队；尚未确认收到或完成。':['independent_review','formal_text_review'].includes(intent)?'已发起独立文字审查并排队；尚无审查结论或实施授权。':'定向消息已排队；尚未确认收到。',{
    recipients,result:{...result,mode:view.mode,realAdaptersAuthorized:false}
  });
}
