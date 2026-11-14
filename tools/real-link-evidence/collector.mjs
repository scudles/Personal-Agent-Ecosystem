import {resolve,join,dirname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {fixedRoot,checkedPath,boundedRead,checkOutput,exclusiveWrite,within} from '../safe-local-files.mjs';

// File import only. No adapter, RPC, browser, UI, network or command runner.
const root=fixedRoot;
const roles=['hermes','deepseek','chatgpt'];
export const directions=roles.flatMap(from=>roles.filter(to=>to!==from).map(to=>({from,to,key:from+'->'+to})));
const provenances=['HUMAN_REPORTED','AGENT_CLAIM','PLATFORM_OBSERVATION_IMPORT','SIMULATED'];
const modes=['HUMAN_ASSISTED_REAL','AUTOMATIC_REAL','SIMULATED'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_.:-]{1,160}$/.test(value);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const relativePath=value=>typeof value==='string'&&value&&!isAbsolute(value)&&!value.split(/[\\/]/).some(part=>!part||part==='.'||part==='..');
const samePackage=(r,p)=>r.packageId===p?.id&&r.packageVersion===p?.version&&r.manifestHash===p?.manifestHash;

export function collectBatch(batch,{loadArtifact}={}){
  const importErrors=[],artifacts=new Map(),rows=[],used=new Map();
  const invalid=message=>importErrors.push(message);
  if(batch?.format!=='TRB_REAL_LINK_BATCH_V1')invalid('invalid_batch_format');
  if(!id(batch?.runId))invalid('invalid_run_id');
  if(!['FAKE_TEST','REAL_EVIDENCE_IMPORT'].includes(batch?.environment))invalid('explicit_environment_required');
  for(const role of roles)if(!digest(batch?.participants?.[role]))invalid('missing_session_fingerprint:'+role);
  if(!Array.isArray(batch?.roundTrips)||batch.roundTrips.length>30)invalid('round_trips_must_be_array_at_most_30');
  if(!Array.isArray(batch?.artifacts)||batch.artifacts.length>60)invalid('artifacts_must_be_array_at_most_60');
  const structuralBatchInvalid=importErrors.length>0;
  for(const a of (Array.isArray(batch?.artifacts)?batch.artifacts:[]).slice(0,60)){
    const problems=[];
    if(!id(a?.id)||!relativePath(a?.path)||!digest(a?.sha256)||!provenances.includes(a?.provenance))problems.push('invalid_artifact_descriptor');
    if(artifacts.has(a?.id)){
      const previous=artifacts.get(a.id);previous.problems.push('duplicate_artifact_id');
      invalid('duplicate_artifact_id:'+a.id);continue;
    }
    let receipt=null,actualHash=null;
    if(!problems.length){try{
      if(!loadArtifact)throw Error('explicit_artifact_loader_required');
      const bytes=loadArtifact(a);if(!(bytes instanceof Uint8Array)||bytes.length>1024*1024)throw Error('artifact_size_or_type_invalid');
      actualHash=sha(bytes);if(actualHash!==a.sha256)throw Error('local_artifact_hash_mismatch');
      receipt=JSON.parse(Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/,''));
      if(receipt?.format!=='TRB_REAL_LINK_RECEIPT_V1')throw Error('invalid_receipt_format');
    }catch(error){problems.push(error.message);}}
    artifacts.set(a?.id,{id:a?.id,path:a?.path,declaredProvenance:a?.provenance,expectedHash:a?.sha256,actualHash,receipt,problems});
    if(problems.length)invalid('artifact:'+a?.id+':'+problems.join(','));
  }
  const reserve=(key,row)=>{const set=used.get(key)||[];set.push(row);used.set(key,set);};
  for(const trip of (Array.isArray(batch?.roundTrips)?batch.roundTrips:[]).slice(0,30)){
    const row={id:trip?.id,direction:trip?.from+'->'+trip?.to,slot:trip?.slot,mode:trip?.mode,issues:[],declaredEvidence:[],localArtifactHashesVerified:false,independentlyObserved:false,receiverBytesVerifiedByCollector:false};
    rows.push(row);const issue=code=>{if(!row.issues.includes(code))row.issues.push(code);};
    if(structuralBatchInvalid)issue('INVALID_BATCH');
    if(!id(trip?.id))issue('INVALID_ROUND_TRIP_ID');else reserve('trip:'+trip.id,row);
    const route=directions.find(d=>d.from===trip?.from&&d.to===trip?.to);if(!route)issue('INVALID_DIRECTION');
    if(!Number.isInteger(trip?.slot)||trip.slot<1||trip.slot>5)issue('INVALID_SLOT');else if(route)reserve('slot:'+row.direction+':'+trip.slot,row);
    if(!modes.includes(trip?.mode))issue('INVALID_MODE');
    if(!id(trip?.package?.id)||!Number.isInteger(trip?.package?.version)||trip.package.version<1||!digest(trip?.package?.manifestHash))issue('INVALID_EXPECTED_PACKAGE');
    if(!id(trip?.challengeId))issue('MISSING_CHALLENGE');else reserve('challenge:'+trip.challengeId,row);
    const legRecords={};
    for(const [name,from,to] of [['forward',trip?.from,trip?.to],['return',trip?.to,trip?.from]]){
      const artifactId=trip?.[name]?.artifactId,a=artifacts.get(artifactId);
      if(!a){issue('MISSING_'+name.toUpperCase()+'_EVIDENCE');continue;}
      reserve('artifact:'+artifactId,row);
      row.declaredEvidence.push({leg:name,artifactId,declaredProvenance:a.declaredProvenance,localHashVerified:!a.problems.length,originAuthenticatedByCollector:false});
      if(a.problems.length||!a.receipt){issue('INVALID_'+name.toUpperCase()+'_ARTIFACT');continue;}
      const r=a.receipt;legRecords[name]=r;
      if(r.from!==from||r.to!==to)issue('WRONG_TARGET_OR_DIRECTION');
      if(r.fromSessionFingerprint!==batch?.participants?.[from]||r.toSessionFingerprint!==batch?.participants?.[to])issue('WRONG_SESSION');
      if(!samePackage(r,trip?.package))issue('PACKAGE_VERSION_OR_HASH_MISMATCH');
      if(r.challengeId!==trip?.challengeId)issue('CHALLENGE_MISMATCH');
      if(r.state!=='RECEIVED'||r.completed!==true)issue(r.state==='UNKNOWN'?'UNKNOWN':'RECEIPT_NOT_COMPLETED');
      if(r.submissionAttempts!==1)issue('SUBMISSION_NOT_EXACTLY_ONCE');
      for(const field of ['attemptId','sourceMessageId','receivedMessageId','replyId'])if(!id(r[field]))issue('MISSING_'+field.toUpperCase());
      for(const field of ['sourceBodyHash','replyBodyHash'])if(!digest(r[field]))issue('MISSING_'+field.toUpperCase());
      if(id(r.attemptId))reserve('attempt:'+r.attemptId,row);
      const sourceKeys=name==='forward'?[[from,r.sourceMessageId],[to,r.receivedMessageId],[to,r.replyId]]:[[to,r.receivedMessageId],[to,r.replyId]];
      // In the return tuple, `to` is the original sender. return.sourceMessageId
      // intentionally equals forward.replyId and is not a second use of a new ID.
      for(const [role,messageId] of sourceKeys)if(id(messageId))reserve('message:'+role+':'+messageId,row);
      if(trip?.mode==='AUTOMATIC_REAL'&&a.declaredProvenance!=='PLATFORM_OBSERVATION_IMPORT')issue('AUTOMATIC_MODE_REQUIRES_PLATFORM_IMPORT_FOR_BOTH_LEGS');
      if(trip?.mode!=='SIMULATED'&&a.declaredProvenance==='SIMULATED')issue('SIMULATED_EVIDENCE_CANNOT_COUNT_AS_REAL');
      row[name]={attemptId:r.attemptId,sourceMessageId:r.sourceMessageId,receivedMessageId:r.receivedMessageId,replyId:r.replyId,state:r.state,completed:r.completed,submissionAttempts:r.submissionAttempts,package:{id:r.packageId,version:r.packageVersion,manifestHash:r.manifestHash},receiverByteClaim:r.receiverByteClaim||'NOT_SUPPLIED'};
    }
    if(legRecords.forward&&legRecords.return){
      if(legRecords.return.sourceMessageId!==legRecords.forward.replyId||legRecords.return.sourceBodyHash!==legRecords.forward.replyBodyHash)issue('RETURN_NOT_BOUND_TO_FORWARD_REPLY');
      row.localArtifactHashesVerified=row.declaredEvidence.length===2&&row.declaredEvidence.every(a=>a.localHashVerified);
    }
  }
  for(const [key,owners] of used)if(owners.length>1)for(const row of new Set(owners))if(!row.issues.includes('DUPLICATE_ID_OR_SLOT'))row.issues.push('DUPLICATE_ID_OR_SLOT');
  for(const row of rows){row.structurallyComplete=row.issues.length===0;row.countsAsReportedRealClosedLoop=row.structurallyComplete&&row.mode!=='SIMULATED'&&batch?.environment==='REAL_EVIDENCE_IMPORT';row.verdict=row.structurallyComplete?'STRUCTURALLY_COMPLETE_IMPORTED':'NOT_COUNTED';}
  const routeSummary=directions.map(d=>{
    const entries=rows.filter(r=>r.direction===d.key),complete=entries.filter(r=>r.countsAsReportedRealClosedLoop);
    return {...d,required:5,imported:entries.length,structurallyCompleteImported:entries.filter(r=>r.structurallyComplete).length,reportedComplete:complete.length,humanAssistedReportedComplete:complete.filter(r=>r.mode==='HUMAN_ASSISTED_REAL').length,automaticClaimsStructurallyComplete:complete.filter(r=>r.mode==='AUTOMATIC_REAL').length,independentlyVerifiedComplete:0,missingSlots:[1,2,3,4,5].filter(slot=>!complete.some(r=>r.slot===slot)),acceptancePassed:false};
  });
  return {format:'TRB_REAL_LINK_IMPORT_REPORT_V1',at:new Date().toISOString(),runId:batch?.runId,environment:batch?.environment,importErrors,rows,directions:routeSummary,
    totalStructurallyCompleteImported:rows.filter(r=>r.structurallyComplete).length,totalReportedComplete:routeSummary.reduce((sum,d)=>sum+d.reportedComplete,0),realRoundTripsIndependentlyVerified:0,acceptancePassed:false,sourceAuthenticity:'NOT_INDEPENDENTLY_VERIFIED_BY_IMPORT_TOOL',uniquenessScope:'THIS_IMPORTED_BATCH',
    declaredProvenanceCounts:Object.fromEntries(provenances.map(p=>[p,[...artifacts.values()].filter(a=>a.declaredProvenance===p).length])),
    localArtifactHashChecks:[...artifacts.values()].map(a=>({id:a.id,path:a.path,expectedHash:a.expectedHash,actualHash:a.actualHash,valid:a.problems.length===0,problems:a.problems})),
    actuallyPerformed:{localFileImport:true,localArtifactHashes:true,realSending:false,rpc:false,ui:false,network:false,arbitraryCommands:false},
    limitations:['完整度只反映显式导入记录的内部绑定，不能独立证明原会话身份或平台观测来源真实。','人工报告/Agent声明不会变成自动线路或独立平台观测；平台观察文件也只是导入材料。','本机导入文件hash匹配不证明接收端重新计算原材料hash，receiverByteClaim始终是声明。','相同runId的其他未导入批次不在唯一性检查范围，续批须合并完整账本再导入。']};
}

export function main(args=process.argv.slice(2)){
  const options={};for(let n=0;n<args.length;n+=2){if(!['--input','--out'].includes(args[n])||!args[n+1]||options[args[n]])throw Error('usage: --input <explicit-batch.json> --out <new-report.json>');options[args[n]]=args[n+1];}
  if(!options['--input'])throw Error('explicit_import_file_required');
  const input=checkedPath(options['--input'],{mustExist:true}),base=dirname(input),output=resolve(options['--out']||join(root,'evidence/real-link-evidence-tools-001/import-'+Date.now()+'.json'));
  const outputOptions={allowedBases:[join(root,'evidence/real-link-evidence-tools-001'),join(root,'test-output')],inputs:[input]};checkOutput(output,outputOptions);
  const bytes=boundedRead(input,4*1024*1024);
  const batch=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
  const report=collectBatch(batch,{loadArtifact:a=>{
    if(!relativePath(a.path))throw Error('artifact_path_must_be_relative');const path=resolve(base,a.path);if(!within(base,path))throw Error('artifact_outside_import_folder');outputOptions.inputs.push(path);return boundedRead(path,1024*1024);
  }});
  report.input={path:input,sha256:sha(bytes)};exclusiveWrite(output,JSON.stringify(report,null,2),outputOptions);
  console.log(JSON.stringify({output,environment:report.environment,structurallyCompleteImported:report.totalStructurallyCompleteImported,reportedComplete:report.totalReportedComplete,independentlyVerified:0,acceptancePassed:false,importErrors:report.importErrors.length,notCounted:report.rows.filter(r=>!r.structurallyComplete).length},null,2));
  return report.importErrors.length?1:0;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=main();}catch(error){console.error(error.message);process.exitCode=1;}}
