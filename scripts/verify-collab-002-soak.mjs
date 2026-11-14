import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync,existsSync} from 'node:fs';
import {resolve,join,relative,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

export const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const readJson=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
export const format='TRB_OFFLINE_COLLAB_002_WALL_CLOCK_SOAK_V1';
export const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
export function inside(parent,path){const rel=relative(resolve(parent),resolve(path));return rel!==''&&!isAbsolute(rel)&&!rel.startsWith('..'+sep)&&rel!=='..';}
export function captureSources(){
  const paths=[];
  const visit=dir=>{for(const entry of readdirSync(join(root,dir),{withFileTypes:true})){
    if(['audit','evidence','runtime','test-output','.git','node_modules'].includes(entry.name))continue;
    const file=join(dir,entry.name),stat=lstatSync(join(root,file));assert.ok(!stat.isSymbolicLink(),'source symlink not allowed: '+file);
    if(stat.isDirectory())visit(file);else if(stat.isFile())paths.push(file);
  }};
  for(const dir of ['src','engineering','desktop','native','governance'])visit(dir);
  paths.push('runtime/native/TriReviewBridge.UX.Collab.exe','scripts/soak-collab-002.mjs','scripts/verify-collab-002-soak.mjs');
  return Object.fromEntries([...new Set(paths)].sort().map(file=>[file.replaceAll('\\','/'),sha(readFileSync(join(root,file)))]));
}
export function checkDatabase(folder,{final=false}={}){
  assert.ok(inside(join(root,'test-output'),folder),'soak database must be a new test-output child');
  const cfg=readJson(join(folder,'workbench-config.json'));assert.equal(cfg.databaseFile,'collab-002.sqlite');assert.equal(cfg.mode,'SIMULATION_ONLY');assert.ok(Number.isInteger(cfg.port)&&cfg.port>0);
  const db=new DatabaseSync(join(folder,cfg.databaseFile),{readOnly:true});
  try{
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
    const records=kind=>db.prepare('SELECT json FROM records WHERE kind=? ORDER BY rowid').all(kind).map(r=>JSON.parse(r.json));
    const deliveries=records('delivery'),cases=records('case'),plans=records('collaboration_plan'),submissions=records('mock_submission');
    const control=records('control').find(x=>Object.hasOwn(x,'maxPerHour'));assert.equal(control.maxPerHour,30,'shared hourly cap was changed');
    const bindings=db.prepare('SELECT n.kind,n.external_id,b.paused FROM bindings b JOIN native_sessions n ON n.id=b.native_session_id').all();
    assert.ok(bindings.every(b=>b.kind==='simulated'&&b.external_id.startsWith('simulation:')),'original binding found');
    assert.equal(db.prepare("SELECT count(*) n FROM native_sessions WHERE kind<>'simulated'").get().n,0);
    assert.ok(deliveries.every(d=>d.simulation===true&&!d.legacy&&d.attempts<=1),'duplicate or real text submission');
    assert.equal(new Set(submissions.map(s=>s.id)).size,submissions.length);
    for(const submitted of submissions){const delivery=deliveries.find(d=>d.id===submitted.id);assert.ok(delivery?.sentAt);assert.equal(submitted.sessionId,delivery.sessionId);assert.equal(submitted.prompt,delivery.prompt);}
    assert.equal(db.prepare('SELECT count(*) n FROM uec_exchange_attempts WHERE submission_count>1 OR submission_count<0').get().n,0);
    assert.equal(db.prepare('SELECT count(*) n FROM uec_exchange_attempts a JOIN uec_packages p ON p.id=a.package_id AND p.version=a.version WHERE a.project_id<>p.project_id OR a.workspace_id<>p.workspace_id').get().n,0);
    const attempts=db.prepare('SELECT * FROM uec_exchange_attempts ORDER BY created_at,id').all();
    const receipts=db.prepare('SELECT * FROM uec_exchange_receipts ORDER BY created_at,id').all();
    for(const receipt of receipts){const payload=JSON.parse(receipt.payload),attempt=attempts.find(a=>a.id===receipt.attempt_id);assert.ok(attempt);assert.equal(payload.realAgentReceived,false);assert.equal(payload.simulation,true);assert.equal(payload.verificationStatus,'SIMULATED_BYTE_VERIFIED');assert.equal(payload.packageId,attempt.package_id);assert.equal(payload.packageVersion,attempt.version);const pkg=db.prepare('SELECT * FROM uec_packages WHERE id=? AND version=?').get(attempt.package_id,attempt.version);assert.equal(payload.snapshotId,pkg.snapshot_id);assert.equal(payload.manifestHash,pkg.manifest_hash);assert.equal(payload.packageHash,pkg.package_hash);assert.equal(payload.receivedFileCount,JSON.parse(pkg.manifest).core.file_count);}
    for(const plan of plans){
      assert.equal(plan.frozenHash,sha(canonical(plan.frozen)));assert.equal(plan.executionAuthorized,false);assert.equal(plan.realAgentReceived,false);
      const children=cases.filter(i=>i.parentCaseId===plan.ownerTaskId&&i.scope==='text_only_review');assert.ok(children.length<=1,'duplicate plan child review');
      if(plan.reviewItemId){assert.equal(children.length,1);assert.equal(children[0].id,plan.reviewItemId);assert.deepEqual(children[0].reviewers,[plan.reviewerId]);assert.equal(children[0].assignee,null);}
      const routed=deliveries.filter(d=>d.caseId===plan.ownerTaskId||d.caseId===plan.reviewItemId);assert.ok(routed.every(d=>d.role===plan.ownerId||d.role===plan.reviewerId));
      for(const excluded of plan.excludedIds)assert.ok(routed.every(d=>d.role!==excluded));
    }
    const textSent=deliveries.filter(d=>d.sentAt).length,materialSent=attempts.reduce((sum,a)=>sum+a.submission_count,0);
    const at=Date.now()-3600000,rolling=textSent?deliveries.filter(d=>d.sentAt&&Date.parse(d.sentAt)>at).length:0;
    const hourly=rolling+attempts.filter(a=>a.submission_count>0&&Date.parse(a.submitted_at||a.created_at)>at).length;
    assert.ok(hourly<=30,'shared rolling hourly cap exceeded');assert.ok(textSent+materialSent<=27,'the 27-submission soak budget was exceeded');
    if(final){assert.equal(textSent,9);assert.equal(submissions.length,9);assert.ok(deliveries.filter(d=>d.sentAt).every(d=>d.state==='received'));assert.equal(materialSent,18);assert.equal(attempts.length,18);assert.ok(attempts.every(a=>a.state==='CONFIRMED'&&a.submission_count===1));assert.equal(receipts.length,18);assert.equal(plans.length,1);assert.equal(plans[0].state,'REVIEW_APPROVED');assert.equal(plans[0].reservedReview,false);assert.ok(deliveries.some(d=>d.state==='cancelled'&&!d.sentAt));assert.equal(db.prepare('SELECT count(*) n FROM authorizations').get().n,0);}
    return{integrity:'ok',foreignKeys:0,textSent,materialSent,totalSubmitted:textSent+materialSent,rollingHourly:hourly,sharedCap:control.maxPerHour,receipts:receipts.length,attempts:attempts.length,plans:plans.length,planStates:plans.map(p=>({id:p.id,state:p.state,reviewItemId:p.reviewItemId})),realBindings:0,submissionDuplicates:0};
  }finally{db.close();}
}
export function verifyPackageBytes(folder,cycle){
  const store=join(folder,'engineering-store'),sealed=join(store,'packages',cycle.packageId,'v'+cycle.version);
  assert.ok(inside(join(store,'packages'),sealed));assert.ok(Number.isInteger(cycle.version)&&cycle.version>0);assert.ok(!/[\\/]/.test(cycle.packageId));
  const manifest=readJson(join(sealed,'manifest.json'));
  assert.equal(sha(readFileSync(join(sealed,'manifest.json'))),cycle.manifestHash);
  const paths=['manifest.json','manifest.sha256',...manifest.core.included_files.map(f=>f.path)],hashes={};
  for(const path of paths){assert.ok(!path.split(/[\\/]/).includes('..')&&!resolve(sealed,path).startsWith('\\\\'));const full=resolve(sealed,path);assert.ok(inside(sealed,full));assert.ok(!lstatSync(full).isSymbolicLink());hashes[path]=sha(readFileSync(full));}
  if(cycle.sealedHashes)assert.deepEqual(hashes,cycle.sealedHashes,'sealed original bytes changed');
  for(const file of manifest.core.included_files)assert.equal(hashes[file.path],file.sha256);
  const original=manifest.core.included_files.find(f=>f.source_type==='REPOSITORY'&&f.path.endsWith('/fiction.js'))||manifest.core.included_files.find(f=>f.path.endsWith('/fiction.js'));
  assert.ok(original,'fictional original source missing');assert.equal(hashes[original.path],cycle.originalSourceHash,'packaged bytes differ from original fictional source');
  for(const attempt of cycle.attempts){assert.ok(!/[\\/]/.test(attempt.bindingId)&&!/[\\/]/.test(attempt.id));const inbox=join(store,'mock-inboxes',attempt.bindingId,attempt.id);assert.ok(inside(join(store,'mock-inboxes'),inbox));for(const path of paths)assert.equal(sha(readFileSync(join(inbox,path))),hashes[path],'mock inbox bytes differ: '+attempt.role+'/'+path);}
  return hashes;
}
export function verifyReport(reportPath,{requireAcceptance=false}={}){
  const report=readJson(reportPath);assert.equal(report.format,format);assert.ok(typeof report.runId==='string'&&report.runId.length>20&&!/[\\/]/.test(report.runId));assert.equal(resolve(report.folder),join(root,'test-output','collab-002-soak-'+report.runId));assert.ok(inside(join(root,'test-output'),report.folder));assert.equal(resolve(reportPath),join(resolve(report.folder),'evidence','report.json'));
  assert.equal(report.phase,'COMPLETED');assert.equal(report.passed,true);assert.equal(report.realAgentOperations,0);assert.equal(report.cycles.length,6);assert.equal(report.sourceHashesUnchanged,true);assert.deepEqual(captureSources(),report.sourceHashes,'frozen candidate changed after the run');
  assert.ok(report.elapsedSeconds>=report.requestedSeconds);assert.ok(report.elapsedWallSeconds>=report.requestedSeconds);assert.ok(report.elapsedMonotonicSeconds>=report.requestedSeconds);assert.ok(Date.parse(report.endedAt)-Date.parse(report.wallStartedAt)>=report.requestedSeconds*1000);assert.ok(report.maxHeartbeatGapMs<10000);assert.ok(report.heartbeats>=Math.floor(report.requestedSeconds*.8));
  assert.equal(report.uiLivedThroughout,true);assert.equal(report.ui.ready,true);assert.equal(report.ui.pid,report.uiPid);assert.equal(report.ui.passed,true);assert.equal(report.ui.stopped,true);assert.equal(report.ui.realAgentOperations,0);assert.ok(report.ui.elapsedSeconds>=report.requestedSeconds);assert.ok(report.ui.heartbeats>=Math.floor(report.requestedSeconds/5));assert.ok(report.ui.maxHeartbeatGapMs<10000);assert.equal(report.ui.draftPreserved,true);assert.ok(report.ui.themeToggles>=2&&report.ui.scopeSwitches>=2&&report.ui.pendingSelectionChecks>=1);
  assert.equal(report.faults.cancelledUnsubmitted,true);assert.equal(report.faults.textUnknownNotResent,true);assert.equal(report.faults.materialUnknownNotResent,true);assert.equal(report.faults.pauseSurvivedGracefulAndForcedRestart,true);assert.ok(report.restarts>=4);
  const counts=checkDatabase(report.folder,{final:true});assert.equal(counts.totalSubmitted,27);assert.equal(report.maxObservedRate<=30,true);
  for(const cycle of report.cycles)verifyPackageBytes(report.folder,cycle);
  if(requireAcceptance){assert.equal(report.acceptance,true);assert.equal(report.mode,'ACCEPTANCE');assert.ok(report.requestedSeconds>=3600);assert.ok(report.elapsedSeconds>=3600);assert.ok(report.ui.elapsedSeconds>=3600);}
  return{passed:true,acceptance:report.acceptance,runId:report.runId,report:reportPath,elapsedSeconds:report.elapsedSeconds,counts,realAgentOperations:0};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const i=process.argv.indexOf('--report');assert.ok(i>=0&&process.argv[i+1],'--report <run/evidence/report.json> required');console.log(JSON.stringify(verifyReport(resolve(process.argv[i+1]),{requireAcceptance:process.argv.includes('--acceptance')}),null,2));}
  catch(error){console.error(error.stack);process.exitCode=1;}
}
