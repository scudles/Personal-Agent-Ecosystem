// Pure bounded grammar for one text-task owner followed by one independent
// reviewer. Persistence and scheduling belong to TextCollaborationPlans, never
// to this parser. Unknown chains deliberately return null for the caller's
// existing unsupported/clarification handling.
const roleNames='(?:ChatGPT Observer|DeepSeek Harness|ChatGPT|DeepSeek|Observer|Hermes|DSH)';
const roleId=name=>({hermes:'hermes',dsh:'deepseek',deepseek:'deepseek','deepseek harness':'deepseek',chatgpt:'chatgpt',observer:'chatgpt','chatgpt observer':'chatgpt'})[name.toLowerCase()];
const blank=part=>part.replace(/[^\r\n]/g,' ');

export function maskNonInstructions(text) {
  return text.replace(/```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)/g,blank)
    .replace(/^(?: {4}| {0,3}\t)[^\r\n]*$/gm,blank)
    .replace(/^[ \t]*>[^\r\n]*$/gm,blank)
    .replace(/`[^`\n]*`|“[^”]*”|「[^」]*」|『[^』]*』|"[^"\n]*"|'[^'\n]*'/g,blank);
}

const grammar=new RegExp('^(?<ownerPrefix>(?:请)?(?:让|请|交给|交由|由)?\\s*@?(?<owner>'+roleNames+')(?![A-Za-z0-9_])\\s*(?:负责|来)?\\s*)(?<instruction>.+?)(?:[,，;；]\\s*|\\s*(?:完成|做完)后\\s*)(?:(?:待|等)?(?:任务)?(?:完成|做完)后\\s*)?(?:再)?(?:让|请|交给|交由|由)?\\s*@?(?<reviewer>'+roleNames+')(?![A-Za-z0-9_])\\s*(?:负责)?\\s*(?:独立)?(?:复核|审查|审阅|检查)(?:一下)?(?:成果|结果|这个任务|此任务|该任务)?(?:[,，;；]\\s*@?(?<excluded>'+roleNames+')(?![A-Za-z0-9_])\\s*(?:暂不参与|不参与|无需参与|不用参与))?[。.!！]?$', 'id');

export function parseCollaborationPlan(text) {
  if(typeof text!=='string')return null;
  const masked=maskNonInstructions(text),offset=masked.length-masked.trimStart().length,active=masked.trim();
  const match=grammar.exec(active);
  if(!match||!/(?:让|请|交给|交由|由|负责|来|@)/.test(match.groups.ownerPrefix))return null;
  const ownerId=roleId(match.groups.owner),reviewerId=roleId(match.groups.reviewer),excludedIds=match.groups.excluded?[roleId(match.groups.excluded)]:[];
  if(ownerId===reviewerId)return {status:'UNSUPPORTED',summary:'负责人不能同时作为本任务的独立复核者。'};
  if(excludedIds.includes(ownerId)||excludedIds.includes(reviewerId))return {status:'UNSUPPORTED',summary:'同一参与者同时被指定分工和排除，请明确本次分工。'};
  const span=match.indices.groups.instruction;
  const instruction=text.slice(offset+span[0],offset+span[1]).trim();
  if(!instruction||!match.groups.instruction.trim()||/(?:如果|若是|一旦|否则|通过后|不通过|循环|反复)/.test(match.groups.instruction)||new RegExp('[,，;；、]\\s*(?:让|请|交由|交给|由)?\\s*@?'+roleNames+'\\s*(?:负责|复核|审查|审阅|检查|参与|暂不参与|不参与|独立)','i').test(match.groups.instruction))return {status:'UNSUPPORTED',summary:'仅支持负责人完成文字任务后交一名独立复核者，暂不支持分支、循环或其他多角色条件链。'};
  return {status:'READY',format:'TRB_TEXT_COLLAB_PLAN_V1',ownerId,reviewerId,excludedIds,instruction,dependency:'OWNER_VERIFIED_TEXT_RESULT'};
}
