import assert from'node:assert/strict';
import{readFileSync,writeFileSync,existsSync,lstatSync,readdirSync}from'node:fs';
import{resolve,join,relative,isAbsolute}from'node:path';
import{randomUUID,createHash}from'node:crypto';
import{inspect,send,read}from'../src/transports.mjs';
import{PINNED}from'../src/workflow.mjs';
const dir=resolve('evidence/real-material-canary-001'),attemptPath=join(dir,'hermes-attempt.json'),json=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,'')),sha=b=>createHash('sha256').update(b).digest('hex'),pkg=json(join(dir,'package.json'));
assert.equal(pkg.taskId,'TRB-REAL-MATERIAL-CANARY-001');assert.equal(pkg.packageVersion,1);assert.equal(pkg.totalOriginalFileCount,5);
const source=resolve(pkg.sourceDir),testRoot=resolve('test-output'),rel=relative(testRoot,source);assert(!isAbsolute(rel)&&!rel.startsWith('..')&&!lstatSync(source).isSymbolicLink());
assert.deepEqual(readdirSync(source).sort(),pkg.originalFiles.map(f=>f.path).sort());
for(const file of pkg.originalFiles){assert(!/[\\/]/.test(file.path));const path=join(source,file.path);assert(!lstatSync(path).isSymbolicLink());const bytes=readFileSync(path);assert.equal(bytes.length,file.sizeBytes);assert.equal(sha(bytes),file.sha256);}
const action=process.argv[2];assert(['send-once','read'].includes(action));
if(action==='send-once'){
 assert(!existsSync(attemptPath),'One-shot attempt already exists; no automatic retry, including UNKNOWN.');
 const prompt='TRB_CHAT '+randomUUID()+'\n这是用户刚明确授权的一次虚构工程材料接收验证，不是凪工程任务。请保持本原会话、模型、私有记忆和设置不变。\n只允许读取这一封存目录的五个文件：'+source+'\n五个文件名：README.txt、orchard.json、notes.txt、manifest.json、manifest.sha256。包ID '+pkg.packageId+'，版本1。\n仅使用现有允许的只读文件/原字节校验工具；不执行shell、命令、脚本、包内代码或任何代码；不写文件，不读取此目录以外的文件/记忆/配置/凭证，不启动任何项目，不委派其他Agent。若现有工具无法安全读取或计算SHA-256，明确说明不支持，不扩大权限。\n读取后用自然语言报告：实际包ID/版本、manifest hash是自行计算还是仅抄录清单、实际读取的文件数、orchard名称及三个count之和、notes中的marker和最后一行。若有原生只读SHA-256能力，逐文件报告实际字节数/计算哈希及工具依据；没有就写未完成字节校验，不宣称VERIFIED。不要把文字赞同视为审批或实施授权。';
 const baseline=await inspect('hermes');assert(!baseline.error&&baseline.sessionId===PINNED.hermes.id&&baseline.title==='Nagi'&&!baseline.busy,'Pinned Hermes original session must be confirmed idle; no changes made.');
 const attempt={taskId:pkg.taskId,deliveryId:randomUUID(),packageId:pkg.packageId,packageVersion:1,manifestHash:pkg.manifestHash,sessionId:PINNED.hermes.id,prompt,baseline,at:new Date().toISOString(),state:'SENDING',userAuthorized:true,automaticQueueResumed:false,newSession:false,submissionAttempts:1,byteVerified:false};
 writeFileSync(attemptPath,JSON.stringify(attempt,null,2),{flag:'wx'});
 try{const result=await send('hermes',{id:attempt.deliveryId,prompt},baseline);attempt.result=result;attempt.state=result.submitted===true?'SUBMITTED':result.mutationStarted===true?'UNKNOWN':'FAILED_KNOWN_UNSENT';}catch(error){attempt.state='UNKNOWN';attempt.error=error.message;}
 attempt.updatedAt=new Date().toISOString();writeFileSync(attemptPath,JSON.stringify(attempt,null,2));console.log(JSON.stringify({state:attempt.state,deliveryId:attempt.deliveryId,sessionId:attempt.sessionId,submissionAttempts:1,byteVerified:false}));
}else{
 const attempt=json(attemptPath);assert.equal(attempt.sessionId,PINNED.hermes.id);const result=await read('hermes',{prompt:attempt.prompt});
 const observation={at:new Date().toISOString(),taskId:pkg.taskId,packageId:pkg.packageId,deliveryId:attempt.deliveryId,result,receiverByteVerified:false,source:'original_gateway_prompt_match',noResend:true};writeFileSync(join(dir,'hermes-receipt-observation.json'),JSON.stringify(observation,null,2));
 console.log(JSON.stringify({requestSeen:result.requestSeen,sessionId:result.sessionId,busy:result.busy,completed:result.completed,conflict:result.conflict,error:result.error,reply:result.reply,coverage:result.coverage,noToolCalls:result.noToolCalls,receiverByteVerified:false},null,2));
}
