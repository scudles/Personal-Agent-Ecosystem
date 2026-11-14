import {fileURLToPath} from 'node:url';
import {GovernanceGuard} from '../governance/guard.mjs';

const roles=new Set(['hermes','deepseek','chatgpt']);
const owner={id:'local-owner',kind:'user'};
const root=fileURLToPath(new URL('../governance',import.meta.url));

// No new store and no JSONL writer: decisions share the host's SQLite transaction.
class CoreGuard extends GovernanceGuard {
  constructor(core,governanceRoot){super(governanceRoot,{simulation:true});this.core=core;}
  record(type,payload){this.core.log('collaboration.'+type,{simulation:true,...payload});}
  events(){
    if(!this.core.db.prepare("SELECT 1 FROM sqlite_schema WHERE name='uec_governance_events' AND type='table'").get())return [];
    return this.core.db.prepare('SELECT payload FROM uec_governance_events ORDER BY sequence').all().map(r=>JSON.parse(r.payload));
  }
}

export class CollaborationGovernance {
  constructor(core,{governanceRoot=root}={}){this.core=core;this.guard=new CoreGuard(core,governanceRoot);this.lastBlocked=new Map();}
  recordBlocked(error){
    if(error?.collaborationGovernance&&!error.governanceAuditRecorded&&!this.core.txDepth){
      const decision=error.collaborationGovernance,key=JSON.stringify([decision.code,decision.projectId,decision.workspaceId,decision.taskId,decision.operation]);
      if(Date.now()-(this.lastBlocked.get(key)||0)>1000){this.core.log('collaboration.governance.blocked',decision);this.lastBlocked.set(key,Date.now());if(this.lastBlocked.size>500)this.lastBlocked.delete(this.lastBlocked.keys().next().value);}
      error.governanceAuditRecorded=true;
    }
  }
  deny(code,ctx={},details={}){
    const error=new Error(code);
    error.collaborationGovernance={code,...ctx,simulation:true,executionAuthorized:false,
      request:details.request||'请求继续当前协作动作',rule:details.rule||'MAG-001 二 / 四 / 5.1 / 十',
      impact:details.impact||'继续执行可能绕过指定分工、版本或工程治理保护。',
      alternative:details.alternative||'核对明确对象及既有分工；工程事项使用保留的Governance Host入口。',...details};
    this.recordBlocked(error);throw error;
  }
  require(condition,code,ctx,details){if(!condition)this.deny(code,ctx,details);}
  integrity(ctx={}){
    try{return this.guard.load();}catch(error){this.deny('collaboration_governance_integrity_failure',ctx,{
      rule:'MAG-001 9.1 / 十',impact:'规则缺失或完整性异常，不能据此作出治理通过判断。',
      alternative:'停止新的协作动作，核对已确认的受保护版本；不自动降级。',cause:error.message});}
  }
  uniqueOwner(input,fallback,ctx){
    for(const key of ['owners','ownerIds'])if(input[key]!==undefined)this.require(Array.isArray(input[key])&&input[key].length===1,'collaboration_one_owner_required',ctx);
    const explicit=input.ownerId??input.owners?.[0]??input.ownerIds?.[0];
    this.require(typeof (explicit??fallback)==='string'&&(explicit??fallback).trim().length>0,'collaboration_one_owner_required',ctx);
    if(explicit!==undefined)this.require([input.owners?.[0],input.ownerIds?.[0]].filter(x=>x!==undefined).every(x=>x===explicit),'collaboration_one_owner_required',ctx);
    return explicit??fallback;
  }
  governedAncestor(ctx,id){
    if(!id)return null;
    const hasTable=!!this.core.db.prepare("SELECT 1 FROM sqlite_schema WHERE name='uec_governed_tasks' AND type='table'").get();
    const seen=new Set();
    while(id){
      this.require(!seen.has(id),'collaboration_parent_cycle',ctx);seen.add(id);
      const item=this.core.owned(ctx,'case',id);
      if(hasTable){const row=this.core.db.prepare('SELECT definition FROM uec_governed_tasks WHERE task_id=? AND project_id=? AND workspace_id=?').get(id,ctx.projectId,ctx.workspaceId);if(row)return {item,definition:JSON.parse(row.definition)};}
      id=item.parentCaseId;
    }
    return null;
  }
  requireTextPath(ctx,id,operation){
    const governed=this.governedAncestor(ctx,id);
    this.require(!governed,'collaboration_engineering_host_required',ctx,{taskId:governed?.item.id,operation,
      request:'通过普通文字入口处理已登记工程任务的后续'+operation,
      rule:'MAG-001 5.1 / 5.3 / 5.4 / 7.3',
      alternative:'使用原工程Governance Host核对冻结范围、准确材料、轮次与Issue；文字审批不替代工程复核。'});
  }
  task(ctx,input){
    this.integrity(ctx);const executor=this.uniqueOwner(input,input.executor,ctx);
    this.require(roles.has(executor)&&executor===input.executor,'collaboration_one_owner_required',ctx);
    this.requireTextPath(ctx,input.parentCaseId,'task');return executor;
  }
  review(ctx,input,author='user',parentId=input.parentCaseId){
    this.integrity(ctx);
    const reviewers=input.reviewers;const sourceAuthor=input.sourceMessageId?this.core.message(ctx,input.sourceMessageId).author:null;
    this.require(Array.isArray(reviewers)&&reviewers.length>0&&reviewers.every(r=>roles.has(r))&&new Set(reviewers).size===reviewers.length,'collaboration_invalid_reviewers',ctx);
    this.requireTextPath(ctx,parentId,'review');
    const parent=parentId?this.core.owned(ctx,'case',parentId):null;
    // A legacy post-approval text executor is not automatically the author.
    const parentOwner=parent?.governanceOwnerId??(parent?.scope==='text_only_task'?parent.assignee:null);
    const responsible=this.uniqueOwner(input,parentOwner??author,ctx);
    this.require(responsible==='user'||responsible==='local-owner'||roles.has(responsible),'collaboration_one_owner_required',ctx);
    if(parentOwner)this.require(responsible===parentOwner,'collaboration_frozen_owner_or_parent',ctx);
    this.require(!reviewers.includes(author)&&!reviewers.includes(responsible)&&(!sourceAuthor||!reviewers.includes(sourceAuthor)),'collaboration_self_review_forbidden',ctx);
    if(input.reviewPlan==='independent_then_cross'){
      const cross=input.crossReviewers??reviewers;
      this.require(Array.isArray(cross)&&cross.length>0&&cross.every(r=>roles.has(r)&&r!==author&&r!==responsible&&r!==sourceAuthor)&&new Set(cross).size===cross.length,'collaboration_invalid_reviewers',ctx);
    }
    return responsible;
  }
  revision(ctx,item,input){
    this.integrity(ctx);this.requireTextPath(ctx,item.id,'revision');this.require(input.sourceMessageId===undefined||input.sourceMessageId===item.sourceMessageId||(!item.sourceMessageId&&input.sourceMessageId===null),'collaboration_frozen_message_source',ctx);this.require(input.sourceAuthorId===undefined||input.sourceAuthorId===item.sourceAuthorId,'collaboration_frozen_message_source',ctx);
    const retainedOwner=item.governanceOwnerId??(item.parentCaseId?this.core.owned(ctx,'case',item.parentCaseId).assignee:null)??item.author;
    this.require(this.uniqueOwner(input,retainedOwner,ctx)===retainedOwner,'collaboration_frozen_owner_or_parent',ctx);
    this.review(ctx,{...item,...input,sourceMessageId:item.sourceMessageId,sourceAuthorId:item.sourceAuthorId,ownerId:item.governanceOwnerId??input.ownerId,reviewers:input.reviewers??item.reviewers},item.author,item.parentCaseId);
  }
  approval(ctx,item){
    this.integrity(ctx);this.requireTextPath(ctx,item.id,'authorization');
    this.require(item.scope==='text_only_review','review_not_approved',ctx);
    const cross=item.reviewPlan==='independent_then_cross';
    if(cross)this.require(item.reviewStage==='cross_complete'&&this.core.crossComplete?.(item),'collaboration_all_votes_required',ctx);
    const required=cross?[...new Set([...item.reviewers,...item.crossReviewers])]:item.reviewers;
    const votes=cross?{...item.votes,...item.crossVotes}:item.votes;
    this.require(Array.isArray(required)&&required.length>0&&required.every(role=>{
      const vote=votes?.[role];
      return vote?.type==='review'&&vote.case_id===item.id&&vote.revision===item.revision&&vote.artifact_hash===item.artifactHash&&vote.verdict==='approve'&&Array.isArray(vote.conditions)&&vote.conditions.length===0;
    }),'collaboration_all_votes_required',ctx,{alternative:'收齐当前不可变快照的全部指定无条件通过票；用户决定不能补票，旧版票不继承。'});
  }
  dispatch(ctx,item,kind){
    this.integrity(ctx);
    const governed=this.governedAncestor(ctx,item.id);
    if(governed&&item.scope!=='text_only_chat'){
      // The Host owns material-review rounds and delivery. Do not recreate those
      // transitions from text dispatch or infer a scope exception from prose.
      this.require(item.id===governed.item.id&&kind==='text_task','collaboration_engineering_host_required',ctx,{taskId:governed.item.id,operation:'dispatch'});
      const result=this.guard.assessTask(governed.definition,{phase:'execution'});
      this.require(result.decision!=='STOP'&&!result.blockers.length,'collaboration_engineering_execution_blocked',ctx,{taskId:item.id,blockers:result.blockers});
    }
    if(kind==='task'&&item.scope==='text_only_review')this.approval(ctx,item);
  }
}
