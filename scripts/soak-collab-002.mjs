import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,existsSync,renameSync,appendFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID,randomBytes} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {CollaborationCore} from '../src/collaboration-core.mjs';
import {DatabaseSync} from 'node:sqlite';
import {root,sha,readJson,format,captureSources,checkDatabase,verifyPackageBytes,verifyReport} from './verify-collab-002-soak.mjs';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const roles=['hermes','deepseek','chatgpt'];
const alive=child=>child&&child.exitCode===null&&child.signalCode===null;
async function idlePort(){const listener=createServer();await new Promise((ok,bad)=>{listener.once('error',bad);listener.listen(0,'127.0.0.1',ok);});const port=listener.address().port;await new Promise((ok,bad)=>listener.close(error=>error?bad(error):ok()));return port;}
async function waitUntil(fn,label,timeout=20000){const start=performance.now();let last;while(performance.now()-start<timeout){try{const result=await fn();if(result)return result;}catch(error){last=error;}await sleep(150);}throw Error(label+' timed out'+(last?': '+last.message:''));}
export async function runSoak({seconds=30,acceptance=false}={}){
  assert.ok(Number.isInteger(seconds)&&seconds>=30&&seconds<=7200,'seconds must be an integer in 30..7200');
  assert.ok(seconds<3600||acceptance,'a formal run requires explicit --acceptance after candidate freeze and review');
  assert.ok(!acceptance||seconds>=3600,'acceptance requires at least 3600 real seconds');
  const exe=join(root,'runtime/native/TriReviewBridge.UX.Collab.exe');assert.ok(existsSync(exe),'Collab WPF candidate is not built yet');
  const sourceHashes=captureSources(),runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8),folder=join(root,'test-output','collab-002-soak-'+runId),evidence=join(folder,'evidence');
  mkdirSync(join(root,'test-output'),{recursive:true});mkdirSync(folder);mkdirSync(evidence);mkdirSync(join(folder,'sources'));
  const cfgPath=join(folder,'workbench-config.json'),uiPath=join(evidence,'ui-proof.json'),reportPath=join(evidence,'report.json');
  const cfg={port:await idlePort(),token:randomBytes(32).toString('hex'),mode:'SIMULATION_ONLY',databaseFile:'collab-002.sqlite',engineeringEnabled:true};writeFileSync(cfgPath,JSON.stringify(cfg,null,2));
  const report={format,taskId:'TRB-OFFLINE-COLLAB-002',runId,folder,mode:acceptance?'ACCEPTANCE':'SMOKE',phase:'PREPARING',passed:false,acceptance:false,requestedSeconds:seconds,requiredAcceptanceSeconds:3600,startedAt:new Date().toISOString(),sourceHashes,sourceHashesUnchanged:false,heartbeats:0,maxHeartbeatGapMs:0,maxObservedRate:0,restarts:0,cycles:[],faults:{},realAgentOperations:0,sourceCodeExecuted:false,uiLivedThroughout:false,uiProofPath:uiPath,plannedSubmissions:{initialNLTasks:6,materials:18,plan:2,ordinaryChat:1,total:27,sharedHourlyCap:30}};
  const save=()=>{const tmp=reportPath+'.tmp';writeFileSync(tmp,JSON.stringify(report,null,2));renameSync(tmp,reportPath);};
  let service,ui,timer,uiExpectedExit=false,uiEarlyExit=false,begin,wallBegin,previous,lastSave=0,lastLog=0;
  const call=async(path,body,key)=>{const response=await fetch('http://127.0.0.1:'+cfg.port+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+cfg.token,...(body===undefined?{}:{'Content-Type':'application/json'}),...(key?{'Idempotency-Key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});return{status:response.status,body:await response.json()};};
  const request=async(path,body,key)=>{const result=await call(path,body,key);assert.equal(result.status,200,result.body?.error);return result.body;};
  const post=(scope,action,body={},key)=>request(scope.path+'/'+action,{projectId:scope.projectId,...body},key);
  const view=scope=>request(scope.path+'?projectId='+scope.projectId);
  const withCore=fn=>{assert.ok(!alive(service),'direct fixture writes require this run backend to be stopped');const core=new CollaborationCore(join(folder,cfg.databaseFile));try{return fn(core);}finally{core.close();}};
  const query=fn=>{const db=new DatabaseSync(join(folder,cfg.databaseFile),{readOnly:true});try{return fn(db);}finally{db.close();}};
  const submissionCount=()=>query(db=>db.prepare("SELECT count(*) n FROM records WHERE kind='mock_submission'").get().n+db.prepare('SELECT coalesce(sum(submission_count),0) n FROM uec_exchange_attempts').get().n);
  const startBackend=async()=>{
    service=spawn(join(root,'runtime/node.exe'),[join(root,'src/workbench-server.mjs')],{cwd:root,windowsHide:true,env:{...process.env,TRB_WORKBENCH_DATA_DIR:folder,TRB_WORKBENCH_EMPTY:'1',TRB_ENGINEERING_ENABLED:'1'},stdio:['ignore','pipe','pipe']});
    service.stdout.on('data',bytes=>appendFileSync(join(evidence,'backend.stdout.log'),bytes));service.stderr.on('data',bytes=>appendFileSync(join(evidence,'backend.stderr.log'),bytes));
    let spawnError;service.once('error',error=>{spawnError=error;});
    await waitUntil(async()=>{if(spawnError)throw spawnError;assert.ok(alive(service),'backend exited before ready');const path=join(folder,'workbench-service.json');if(!existsSync(path)||readJson(path).pid!==service.pid)return false;const healthy=await call('/health');assert.equal(healthy.body.realAdaptersAuthorized,false);assert.equal(healthy.body.mode,'SIMULATION_ONLY');return healthy.status===200;},'isolated fixed-port backend');
    assert.equal(readJson(join(folder,'workbench-service.json')).port,cfg.port);
  };
  const stopBackend=async(force=false)=>{if(!alive(service))return;if(force)service.kill('SIGKILL');else await call('/api/service/stop',{});await waitUntil(()=>!alive(service),'backend stop');};
  const reboot=async(force=false)=>{await stopBackend(force);await startBackend();report.restarts++;};
  const uiProof=()=>{try{return readJson(uiPath);}catch{return null;}};
  const uiCheck=()=>{assert.ok(alive(ui)&&!uiEarlyExit,'WPF exited before the soak ended');const proof=uiProof();if(proof){assert.equal(proof.realAgentOperations,0);assert.ok(!proof.stopped,'WPF stopped prematurely');if(proof.heartbeats>0)assert.ok(proof.maxHeartbeatGapMs<10000);}return proof;};
  try{
    withCore(core=>core.control({paused:false,maxPerHour:30,reason:'new fictitious COLLAB-002 soak only; shared cap remains 30'}));
    await startBackend();const scopes=[];
    for(let p=0;p<3;p++){
      const project=await request('/api/projects',{name:'虚构COLLAB-002耐久项目 '+p}),sourcePath=join(folder,'sources','project-'+p);mkdirSync(sourcePath);writeFileSync(join(sourcePath,'fiction.js'),'export const fictionalCycle = -1;\n');let sourceId;
      for(let w=0;w<2;w++){
        const workspace=await request('/api/projects/'+project.id+'/workspaces',{name:'隔离会话 '+w,participants:roles}),scope={projectId:project.id,workspaceId:workspace.id,path:'/api/workspaces/'+workspace.id,sourcePath};
        for(const role of roles)await post(scope,'bind-simulation',{agentId:role,title:'虚构COLLAB-002 '+role});await post(scope,'configure',{paused:false,recipients:['hermes']});
        if(scopes.length===0){await post(scope,'simulate-fault',{agentId:'hermes',mode:'existing_draft'});const cancelled=await post(scope,'tasks',{title:'虚构未提交取消',body:'只核对未提交取消，不执行源码',executor:'hermes'});await post(scope,'cancel',{itemId:cancelled.id});const state=await view(scope);assert.ok(state.deliveries.filter(d=>d.caseId===cancelled.id).every(d=>d.state==='cancelled'&&!d.sentAt));report.faults.cancelledUnsubmitted=true;}
        if(scopes.length===1)await post(scope,'simulate-fault',{agentId:'hermes',mode:'submit_timeout'});
        const intent=await post(scope,'intent',{text:'让Hermes整理虚构耐久材料说明 '+p+'-'+w,recipients:['hermes']},'collab002-initial-'+scopes.length);assert.equal(intent.status,'EXECUTED');assert.equal(intent.intent,'delegate_task');scope.taskId=intent.result.id;
        if(!sourceId)sourceId=(await post(scope,'materials-source',{path:sourcePath,repositoryType:'directory'})).id;scope.sourceId=sourceId;
        assert.equal((await post(scope,'materials-governance-register',{taskId:scope.taskId,definition:{ownerId:'hermes',kind:'api_change',riskLevel:'L1',riskBasis:'虚构只读材料协调',reviewerIds:['deepseek'],goal:'验证材料链路',scope:'仅当前模拟流程',acceptanceCriteria:['字节完整与来源记录']}})).blocked,false);scopes.push(scope);
      }
    }
    report.scopes=scopes.map(({projectId,workspaceId,taskId,sourceId})=>({projectId,workspaceId,taskId,sourceId}));
    const ordinary=await post(scopes[0],'intent',{text:'@Hermes 这是一条虚构普通交流，供界面选择和草稿回归；不会创建新审批。',recipients:['hermes']});assert.equal(ordinary.status,'EXECUTED');assert.equal(ordinary.intent,'chat');report.ordinaryChatId=ordinary.result.id;
    const empty=await request('/api/projects/'+scopes[0].projectId+'/workspaces',{name:'独立文字协作计划',participants:['hermes','deepseek']}),planScope={projectId:scopes[0].projectId,workspaceId:empty.id,path:'/api/workspaces/'+empty.id};
    for(const role of ['hermes','deepseek'])await post(planScope,'bind-simulation',{agentId:role,title:'虚构计划 '+role});await post(planScope,'configure',{paused:false});
    const plan=await post(planScope,'intent',{text:'让Hermes整理虚构颜色说明，DSH独立复核，ChatGPT暂不参与',recipients:[]},'collab002-plan');assert.equal(plan.status,'EXECUTED');assert.ok(plan.result.planId);report.planId=plan.result.planId;report.planScope=planScope;
    ui=spawn(exe,['--config',cfgPath,'--project-id',scopes[0].projectId,'--workspace-id',scopes[0].workspaceId,'--soak-probe',uiPath,'--soak-alt-project',scopes[0].projectId,'--soak-alt-workspace',scopes[1].workspaceId,'--draft-profile','soak-main'],{cwd:root,windowsHide:true,stdio:'ignore'});
    ui.once('exit',()=>{if(!uiExpectedExit)uiEarlyExit=true;});let uiSpawnError;ui.once('error',error=>{uiSpawnError=error;});
    await waitUntil(()=>{if(uiSpawnError)throw uiSpawnError;uiCheck();const proof=uiProof();return proof?.ready&&proof.pid===ui.pid;},'native WPF soak readiness',30000);
    begin=performance.now();wallBegin=Date.now();previous=begin;report.phase='RUNNING';report.wallStartedAt=new Date(wallBegin).toISOString();report.uiPid=ui.pid;
    timer=setInterval(()=>{const now=performance.now();report.maxHeartbeatGapMs=Math.max(report.maxHeartbeatGapMs,now-previous);previous=now;report.heartbeats++;report.elapsedMonotonicSeconds=(now-begin)/1000;report.elapsedWallSeconds=(Date.now()-wallBegin)/1000;report.elapsedSeconds=Math.min(report.elapsedMonotonicSeconds,report.elapsedWallSeconds);if(now-lastSave>=5000){lastSave=now;save();}if(now-lastLog>=60000){lastLog=now;console.log(JSON.stringify({runId,phase:report.phase,elapsedSeconds:report.elapsedSeconds,cycles:report.cycles.length,restarts:report.restarts,uiAlive:alive(ui)}));}},1000);
    save();
    const unknown=await waitUntil(async()=>{uiCheck();const data=await view(scopes[1]);return data.deliveries.find(d=>d.caseId===scopes[1].taskId&&d.state==='unknown');},'original text UNKNOWN');assert.equal(unknown.attempts,1);
    assert.equal(query(db=>db.prepare("SELECT count(*) n FROM records WHERE kind='mock_submission' AND id=?").get(unknown.id).n),1);
    const blockedDraft=(await view(scopes[0])).deliveries.find(d=>d.caseId===scopes[0].taskId);assert.ok(blockedDraft&&!blockedDraft.sentAt);
    await stopBackend();withCore(core=>core.control({paused:true,rolePaused:{hermes:true},reason:'fictitious pause persistence probe'}));const beforePause=submissionCount();await startBackend();report.restarts++;
    await sleep(3300);uiCheck();assert.equal((await view(scopes[0])).controlSummary.paused,true);assert.equal((await view(scopes[0])).controlSummary.rolePaused.hermes,true);assert.equal(submissionCount(),beforePause);
    await reboot(true);await sleep(3300);uiCheck();assert.equal((await view(scopes[0])).controlSummary.paused,true);assert.equal((await view(scopes[0])).controlSummary.rolePaused.hermes,true);assert.equal(submissionCount(),beforePause);report.faults.pauseSurvivedGracefulAndForcedRestart=true;
    await stopBackend();withCore(core=>{core.control({paused:false,rolePaused:{hermes:false},reason:'explicit restoration of this fictitious probe only'});for(const scope of scopes.slice(0,2)){const binding=core.binding(scope,'hermes');core.put('sim_fault',binding.id,{...scope,mode:'none'});}});await startBackend();report.restarts++;
    await waitUntil(async()=>{uiCheck();return(await view(scopes[1])).deliveries.find(d=>d.id===unknown.id&&d.state==='received');},'late known-source text reconciliation');
    assert.equal(query(db=>db.prepare("SELECT count(*) n FROM records WHERE kind='mock_submission' AND id=?").get(unknown.id).n),1);assert.equal((await view(scopes[1])).deliveries.find(d=>d.id===unknown.id).attempts,1);report.faults.textUnknownNotResent=true;
    const cycleInterval=acceptance?600000:Math.max(1000,(seconds*1000-10000)/6);let nextCycle=0;
    while(performance.now()-begin<seconds*1000||nextCycle<6){
      uiCheck();const elapsed=performance.now()-begin;
      if(nextCycle<6&&elapsed>=nextCycle*cycleInterval){
        const n=nextCycle,scope=scopes[n],source='export const fictionalCycle = '+n+';\n';writeFileSync(join(scope.sourcePath,'fiction.js'),source);
        const snapshot=await post(scope,'materials-snapshot',{sourceId:scope.sourceId}),input={taskId:scope.taskId,snapshotId:snapshot.id,objective:'虚构COLLAB-002材料周期 '+n,acceptanceCriteria:['材料原字节与模拟收件相同']},pkg=await post(scope,'materials-package',input,'collab002-package-'+n);assert.equal((await post(scope,'materials-package',input,'collab002-package-'+n)).id,pkg.id);
        assert.equal((await post(scope,'materials-governance-review',{taskId:scope.taskId,packageId:pkg.id,version:pkg.version})).blocked,false);
        const attempts=await post(scope,'materials-queue',{packageId:pkg.id,version:pkg.version,recipients:roles},'collab002-queue-'+n);assert.equal(attempts.length,3);assert.deepEqual((await post(scope,'materials-queue',{packageId:pkg.id,version:pkg.version,recipients:roles},'collab002-queue-'+n)).map(a=>a.id),attempts.map(a=>a.id));
        const cycle={n,projectId:scope.projectId,workspaceId:scope.workspaceId,packageId:pkg.id,version:pkg.version,manifestHash:pkg.manifestHash,originalSourceHash:sha(Buffer.from(source)),attempts:attempts.map(a=>({id:a.id,bindingId:a.binding_id,role:a.role})),at:new Date().toISOString()};
        for(const attempt of attempts){
          if(n===0&&attempt.role==='hermes')assert.equal((await post(scope,'materials-receive',{attemptId:attempt.id,mode:'existing_draft'})).state,'PAUSED');
          if(n===0&&attempt.role==='deepseek'){
            assert.equal((await post(scope,'materials-receive',{attemptId:attempt.id,mode:'submit_unknown'})).state,'UNKNOWN');
            const inbox=join(folder,'engineering-store','mock-inboxes',attempt.binding_id,attempt.id,'manifest.json'),original=sha(readFileSync(inbox));
            assert.equal((await call(scope.path+'/materials-receive',{projectId:scope.projectId,attemptId:attempt.id})).status,400);
            await reboot(true);uiCheck();const materialView=await request(scope.path+'/materials?projectId='+scope.projectId);assert.equal(materialView.exchangeAttempts.find(a=>a.id===attempt.id).state,'UNKNOWN');assert.equal(materialView.exchangeAttempts.find(a=>a.id===attempt.id).submission_count,1);assert.equal(sha(readFileSync(inbox)),original);
            assert.equal((await call(scope.path+'/materials-receive',{projectId:scope.projectId,attemptId:attempt.id})).status,400);
            const receipt=await post(scope,'materials-reconcile',{attemptId:attempt.id});assert.equal(receipt.realAgentReceived,false);assert.equal(sha(readFileSync(inbox)),original);report.faults.materialUnknownNotResent=true;
          }else{const receipt=await post(scope,'materials-receive',{attemptId:attempt.id});assert.equal(receipt.manifestHash,pkg.manifestHash);assert.equal(receipt.realAgentReceived,false);}
        }
        cycle.sealedHashes=verifyPackageBytes(folder,cycle);
        const dsh=attempts.find(a=>a.role==='deepseek');await post(scope,'materials-review-evidence',{packageId:pkg.id,version:pkg.version,authorId:'deepseek',attemptId:dsh.id,body:'虚构独立材料意见 '+n+'，原文保留。',verdict:'COMMENT',references:[]});
        await post(scope,'materials-governance-issue',{taskId:scope.taskId,operation:'create',problemKey:'collab002-optional-'+n,severity:'P2'});await post(scope,'materials-mock-self-test',{taskId:scope.taskId,packageId:pkg.id,version:pkg.version});assert.equal((await post(scope,'materials-governance-assess',{taskId:scope.taskId,operation:'delivery',packageId:pkg.id,version:pkg.version,acceptanceSatisfied:true})).blocked,false);
        const other=scopes[(n+2)%scopes.length];assert.equal((await call(other.path+'/materials-reconcile',{projectId:other.projectId,attemptId:attempts[0].id})).status,400);
        report.cycles.push(cycle);nextCycle++;if(n===2)await reboot(false);if(n===4)await reboot(true);save();
      }
      const counts=checkDatabase(folder);report.counts=counts;report.maxObservedRate=Math.max(report.maxObservedRate,counts.rollingHourly);
      if(performance.now()-begin>=seconds*1000&&nextCycle===6)break;
      assert.ok(performance.now()-begin<(seconds+45)*1000,'six cycles could not finish within bounded smoke grace');await sleep(450);
    }
    await waitUntil(async()=>{uiCheck();return(await view(planScope)).collaborationPlans.find(p=>p.id===report.planId&&p.state==='REVIEW_APPROVED');},'one persistent owner-to-reviewer plan completion');
    await waitUntil(()=>{uiCheck();const counts=checkDatabase(folder);return counts.textSent===9&&query(db=>db.prepare("SELECT count(*) n FROM records WHERE kind='delivery' AND json_extract(json,'$.sentAt') IS NOT NULL AND json_extract(json,'$.state')<>'received'").get().n)===0;},'all nine text submissions and receipts');
    uiCheck();report.uiLivedThroughout=true;uiExpectedExit=true;writeFileSync(uiPath+'.stop',runId);await waitUntil(()=>!alive(ui),'native WPF stop/save',20000);assert.equal(ui.exitCode,0);report.ui=uiProof();assert.ok(report.ui?.stopped&&report.ui.passed,'WPF proof did not pass');
    report.elapsedMonotonicSeconds=(performance.now()-begin)/1000;report.elapsedWallSeconds=(Date.now()-wallBegin)/1000;report.elapsedSeconds=Math.min(report.elapsedWallSeconds,report.elapsedMonotonicSeconds);assert.ok(report.elapsedSeconds>=seconds);
    assert.deepEqual(captureSources(),sourceHashes,'candidate changed during stability run');report.sourceHashesUnchanged=true;
    for(const cycle of report.cycles)verifyPackageBytes(folder,cycle);report.counts=checkDatabase(folder,{final:true});await stopBackend();
    report.phase='COMPLETED';report.passed=true;report.acceptance=acceptance&&report.elapsedSeconds>=3600;report.endedAt=new Date().toISOString();save();
    verifyReport(reportPath,{requireAcceptance:acceptance});console.log(JSON.stringify({report:reportPath,passed:true,acceptance:report.acceptance,elapsedSeconds:report.elapsedSeconds}));return reportPath;
  }catch(error){report.phase='FAILED';report.passed=false;report.acceptance=false;report.error=error.stack;throw error;}
  finally{
    clearInterval(timer);
    if(alive(ui)){uiExpectedExit=true;writeFileSync(uiPath+'.stop',runId);try{await waitUntil(()=>!alive(ui),'failed-run WPF cleanup',10000);}catch{ui.kill('SIGKILL');report.uiCleanupForced=true;}}
    try{await stopBackend();}catch(error){report.passed=false;report.acceptance=false;report.stopError=error.stack;report.phase='FAILED';}
    report.ui=uiProof()||report.ui;report.finishedAt=new Date().toISOString();save();
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const i=process.argv.indexOf('--seconds');runSoak({seconds:i>=0?Number(process.argv[i+1]):30,acceptance:process.argv.includes('--acceptance')}).catch(error=>{console.error(error.stack);process.exitCode=1;});
}
