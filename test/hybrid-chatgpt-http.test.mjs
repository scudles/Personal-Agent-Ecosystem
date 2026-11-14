import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,cpSync,readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
const root=resolve('.'),THREAD='6af098fa-46bc-83e8-97c5-418f00e213b9',TITLE='Nagi（继承的你1）',PORT=48738;
const sha=s=>createHash('sha256').update(s).digest('hex'),fileHash=p=>sha(readFileSync(p)),wait=ms=>new Promise(r=>setTimeout(r,ms));
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const relevant=['src/workbench-server.mjs','src/hybrid-core.mjs','src/hybrid-http.mjs','src/hybrid-intent.mjs','src/workbench.mjs','src/workflow.mjs','src/collaboration-core.mjs','src/relay-core.mjs','tools/hybrid-native-001/chatgpt-rpc.mjs','tools/hybrid-native-001/chatgpt-executor.js'];
async function requirePortFree(){const socket=createServer();await new Promise((ok,bad)=>{socket.once('error',error=>bad(Error('Fixture port unavailable; no existing process was stopped: '+error.code)));socket.listen(PORT,'127.0.0.1',ok);});await new Promise(r=>socket.close(r));}
function clone(){
 mkdirSync(join(root,'test-output'),{recursive:true});const platform=mkdtempSync(join(root,'test-output','hybrid-chatgpt-http-'));
 for(const dir of ['src','engineering']){mkdirSync(join(platform,dir),{recursive:true});for(const name of readdirSync(join(root,dir)).filter(n=>n.endsWith('.mjs')))copyFileSync(join(root,dir,name),join(platform,dir,name));}
 cpSync(join(root,'governance'),join(platform,'governance'),{recursive:true});
 for(const dir of ['scripts','runtime','tools/hybrid-native-001'])mkdirSync(join(platform,dir),{recursive:true});
 copyFileSync(join(root,'scripts/migrate-workbench.mjs'),join(platform,'scripts/migrate-workbench.mjs'));
 copyFileSync(join(root,'runtime/node.exe'),join(platform,'runtime/node.exe'));
 for(const name of ['chatgpt-rpc.mjs','chatgpt-executor.js'])copyFileSync(join(root,'tools/hybrid-native-001',name),join(platform,'tools/hybrid-native-001',name));
 const sourceHashes=Object.fromEntries(relevant.map(p=>[p,fileHash(join(root,p))]));
 for(const p of relevant)assert.equal(fileHash(join(platform,p)),sourceHashes[p],'Unmodified snapshot source must match '+p);
 const original=readFileSync(join(platform,'tools/hybrid-native-001/chatgpt-executor.js'),'utf8'),from='D:\\\\TriReviewBridge',to=platform.replaceAll('\\','\\\\');
 assert.ok(original.includes(from),'Fixture must replace only the fixed production platform literal');
 const local=original.replaceAll(from,to);assert.ok(local.includes(to));assert.equal(local.split(to).join(from),original,'Only the fixed path literal may change in the copied executor');writeFileSync(join(platform,'tools/hybrid-native-001/chatgpt-executor.js'),local);
 const previous=join(platform,'data/codex-relay-001');mkdirSync(previous,{recursive:true});writeFileSync(join(previous,'workbench-config.json'),JSON.stringify({fixture:true,purpose:'not read for credentials'}));
 const previousDb=join(previous,'relay-workbench.sqlite'),db=new DatabaseSync(previousDb);
 db.exec('CREATE TABLE relay_profile(singleton INTEGER PRIMARY KEY,profile_id TEXT,mode TEXT);CREATE TABLE records(kind TEXT,id TEXT,json TEXT);CREATE TABLE relay_jobs(state TEXT);');
 db.prepare('INSERT INTO relay_profile VALUES(1,?,?)').run('codex-relay-001','CODEX_RELAY');db.prepare('INSERT INTO records VALUES(?,?,?)').run('control','global',JSON.stringify({paused:true}));db.close();
 return {platform,sourceHashes,execute:new AsyncFunction('tools','notify','options',local),fixtureExecutorHash:sha(local),previousDb,previousHash:fileHash(previousDb)};
}
async function startHost(f){
 const data=join(f.platform,'data/hybrid-native-001'),node=join(f.platform,'runtime/node.exe');
 const child=spawn(node,[join(f.platform,'src/workbench-server.mjs')],{cwd:f.platform,windowsHide:true,env:{...process.env,TRB_WORKBENCH_MODE:'HYBRID_NATIVE',TRB_WORKBENCH_PROFILE:'hybrid-native-001',TRB_WORKBENCH_DATA_DIR:data,TRB_WORKBENCH_PORT:String(PORT),TRB_WORKBENCH_EMPTY:'1'},stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 for(let n=0;n<160;n++){await wait(50);if(child.exitCode!==null)throw Error('Own fictional Host failed: '+log);if(!existsSync(join(data,'workbench-service.json')))continue;
  const info=JSON.parse(readFileSync(join(data,'workbench-service.json'),'utf8'));if(info.pid!==child.pid)continue;
  assert.equal(info.port,PORT);const cfg=JSON.parse(readFileSync(join(data,'workbench-config.json'),'utf8'));assert.notEqual(cfg.hybridWorkerTokens.chatgpt,cfg.token);assert.notEqual(cfg.hybridWorkerTokens.chatgpt,cfg.hybridWorkerTokens.hermes);
  const call=async(path,body,token=cfg.token)=>{const r=await fetch(info.url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...body===undefined?{}:{'Content-Type':'application/json','Idempotency-Key':randomUUID()}},...body===undefined?{}:{body:JSON.stringify(body)},signal:AbortSignal.timeout(10000)});const v=await r.json();assert.ok(r.ok,JSON.stringify({status:r.status,error:v.error}));return v;};
  return {call,child,info,cfg,stop:async()=>{await call('/api/service/stop',{});for(let n=0;n<100&&child.exitCode===null;n++)await wait(50);assert.equal(child.exitCode,0,'Only the owned fixture Host must stop cleanly');}};
 }
 child.kill();throw Error('Owned fictional Host startup timeout: '+log);
}
async function helper(f,args){
 return new Promise((ok,bad)=>{const child=spawn(join(f.platform,'runtime/node.exe'),[join(f.platform,'tools/hybrid-native-001/chatgpt-rpc.mjs'),...args],{cwd:f.platform,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',stderr='';child.stdout.setEncoding('utf8');child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>stderr+=x);child.once('error',bad);child.once('close',exit=>ok({exit_code:exit,output,stderr}));});
}
test('real isolated Host and actual non-TTY ChatGPT RPC/executor complete fake original-thread chat and task acceptance',{timeout:180000},async()=>{
 await requirePortFree();const f=clone();let host,stopped=false;const notifications=[],turns=[],events=[],cliModes={rpc:0,spoolChunk:0,rpcFile:0},counts={fakeFirstPartyReads:0,fakeFirstPartySends:0,realNativeOperations:0};
 const prefix="虚构长回复😀\n'@\n$(not-a-command)\n",chatReply=prefix+'果'.repeat(19999-prefix.length),taskReply="虚构文字任务结果：十二张纸。\n'@\n$(not-a-command)";
 assert.equal(chatReply.length,19999);
 try{
  host=await startHost(f);const call=host.call;
  const p=await call('/api/projects',{name:'虚构C接力集成'}),ws=await call('/api/projects/'+p.id+'/workspaces',{name:'虚构原线程替身窗口'}),path='/api/workspaces/'+ws.id;
  await call(path+'/bind-hybrid',{projectId:p.id,role:'chatgpt'});await call(path+'/configure',{projectId:p.id,paused:false,recipients:['chatgpt']});
  const tools={
   exec_command:async command=>{
    assert.equal(command.tty,undefined,'Actual RPC subprocesses must never request a terminal');assert.equal(command.workdir,f.platform);
    const m=command.cmd.match(/^& '([^']+)' '([^']+)' (--rpc|--spool-chunk|--rpc-file) '([A-Za-z0-9_-]+)'(?: '(0|[1-9][0-9]*)' '([A-Za-z0-9_-]+)')?$/);
    assert.ok(m,'Executor may only invoke the fixed helper and safe encoded arguments');assert.equal(resolve(m[1]),join(f.platform,'runtime/node.exe'));assert.equal(resolve(m[2]),join(f.platform,'tools/hybrid-native-001/chatgpt-rpc.mjs'));
    let args;if(m[3]==='--spool-chunk'){assert.ok(m[5]!==undefined&&m[6]);cliModes.spoolChunk++;args=[m[3],m[4],m[5],m[6]];}
    else{
     let envelope;if(m[3]==='--rpc'){cliModes.rpc++;envelope=JSON.parse(Buffer.from(m[4],'base64url').toString('utf8'));}else{cliModes.rpcFile++;envelope=JSON.parse(Buffer.from(readFileSync(join(f.platform,'tools/hybrid-native-001/spool',m[4]+'.request.b64'),'utf8'),'base64url').toString('utf8'));}
     events.push(envelope.op);args=[m[3],m[4]];
    }
    const result=await helper(f,args);assert.equal(result.stderr.includes(host.cfg.token),false);assert.equal(result.stderr.includes(host.cfg.hybridWorkerTokens.chatgpt),false);return result;
   },
   write_stdin:async()=>{throw Error('Non-TTY one-shot RPC must never use terminal input');},
   mcp__codex_app__read_thread:async input=>{
    counts.fakeFirstPartyReads++;assert.equal(input.threadId,THREAD);assert.equal(input.includeOutputs,false);assert.equal(input.maxOutputCharsPerItem,20000);
    return {content:[{type:'text',text:JSON.stringify({thread:{id:THREAD,title:TITLE,kind:'chatgpt',status:{type:'idle'}},turns:[...turns].reverse().slice(0,input.turnLimit),page:{hasMore:false,nextCursor:null}})}]};
   },
   mcp__codex_app__send_message_to_thread:async input=>{
    assert.deepEqual(Object.keys(input).sort(),['prompt','threadId']);assert.equal(input.threadId,THREAD);
    const peek=await call('/api/hybrid/peek?role=chatgpt');assert.equal(peek.next.state,'DISPATCHING');assert.equal(peek.next.dispatchContinuationAllowed,true);assert.equal(input.prompt,peek.next.requestText);
    counts.fakeFirstPartySends++;const n=counts.fakeFirstPartySends,id='fake-native-turn-user-'+n,replyId='fake-native-reply-'+n,text=n===1?chatReply:taskReply;
    turns.push({id,status:'completed',error:null,items:[{type:'userMessage',id,content:[{type:'text',text:input.prompt}]},{type:'agentMessage',id:replyId,text,truncated:false}]});
    return {content:[{type:'text',text:JSON.stringify({threadId:THREAD})}]};
   }
  };
  const run=options=>f.execute(tools,value=>notifications.push(value),{once:true,maxMs:170000,maxSends:1,pollMs:1,...options});
  await call('/api/hybrid/role-control',{role:'chatgpt',action:'prepare'});
  const prepared=await run({prepareOnly:true});assert.equal(prepared.identityReported,true);assert.equal(prepared.notEnabled,true);assert.equal(counts.fakeFirstPartySends,0);
  const preparedView=await call(path+'?projectId='+p.id),preparedRole=preparedView.participants.find(x=>x.id==='chatgpt');assert.equal(preparedRole.paused,true);assert.equal(preparedRole.preparationRequested,false);assert.equal(preparedRole.verificationLevel,'WORKER_REPORTED_IDENTITY_MATCH');
  await call('/api/hybrid/role-control',{role:'chatgpt',action:'enable',note:'虚构fixture明确启用，仅使用fake第一方工具'});
  const chat=await call(path+'/chat',{projectId:p.id,text:"虚构整合输入：\n'@\n$(不执行)\n"+'树'.repeat(1500),recipients:['chatgpt']});
  const submittedChat=await run({});assert.equal(submittedChat.sent,1);assert.equal((await call('/api/hybrid/peek?role=chatgpt')).next.state,'SUBMITTED');
  const pendingChat=(await call('/api/hybrid/peek?role=chatgpt')).next,bad={id:'reject-foreign-thread',op:'observe',input:{jobId:pendingChat.id,native:{thread:{id:'foreign-fictional-thread',title:TITLE,kind:'chatgpt'},turns:[]}}};
  const rejected=await helper(f,['--rpc',Buffer.from(JSON.stringify(bad)).toString('base64url')]);assert.equal(rejected.exit_code,0);assert.equal(JSON.parse(rejected.output).ok,false);assert.equal((await call('/api/hybrid/peek?role=chatgpt')).next.state,'SUBMITTED');
  const receivedChat=await run({});assert.equal(receivedChat.completed,1);assert.equal((await call('/api/hybrid/peek?role=chatgpt')).next,null);
  let view=await call(path+'?projectId='+p.id),chatItem=view.items.find(i=>i.id===chat.id),chatMessage=view.messages.find(m=>m.case_id===chat.id&&m.author==='chatgpt');assert.equal(chatItem.state,'chat_replied');assert.equal(chatMessage.body,chatReply);assert.equal(chatMessage.source.replySha256,sha(chatReply));assert.deepEqual(chatMessage.source.replyIds,['fake-native-reply-1']);
  const task=await call(path+'/tasks',{projectId:p.id,title:'虚构文字任务',body:'仅整理虚构十二张纸的文字，不实施项目',executor:'chatgpt'});
  const submittedTask=await run({});assert.equal(submittedTask.sent,1);assert.equal((await call('/api/hybrid/peek?role=chatgpt')).next.state,'SUBMITTED');
  const receivedTask=await run({});assert.equal(receivedTask.completed,1);
  view=await call(path+'?projectId='+p.id);const taskItem=view.items.find(i=>i.id===task.id),taskMessage=view.messages.find(m=>m.case_id===task.id&&m.author==='chatgpt');assert.equal(taskItem.state,'awaiting_user_acceptance');assert.equal(taskMessage.body,taskReply);
  const accepted=await call(path+'/task-accept',{projectId:p.id,itemId:task.id,expectedRevision:taskItem.revision,artifactHash:taskItem.artifactHash,note:'接受虚构文字结果'});assert.equal(accepted.state,'text_task_accepted');assert.equal(accepted.userAuthorized,false);assert.equal(accepted.acceptanceEvidence.engineeringExecutionAuthorized,false);
  for(const message of [chatMessage,taskMessage]){assert.equal(message.source.source,'WORKER_REPORTED_FIRST_PARTY_THREAD_READ');assert.equal(message.source.simulation,false);assert.equal(message.source.independentAuthentication,false);assert.equal(message.source.fullToolTraceVerified,false);assert.equal(message.source.toolActivity,'NOT_OBSERVED');assert.equal(message.source.noToolCalls,undefined);}
  assert.equal(counts.fakeFirstPartySends,2);assert.equal(events.filter(x=>x==='cutover').length,4);assert.equal(events.filter(x=>x==='begin').length,2);assert.ok(cliModes.spoolChunk>1);assert.ok(cliModes.rpcFile>=1);assert.equal(readdirSync(join(f.platform,'tools/hybrid-native-001/spool')).filter(x=>x.endsWith('.request.b64')).length,0);
  assert.equal(fileHash(f.previousDb),f.previousHash,'Previous synthetic Bridge database must remain byte-identical');
  for(const [file,digest] of Object.entries(f.sourceHashes))assert.equal(fileHash(join(root,file)),digest,'Frozen production source drifted: '+file);
  const snapshotSourceHashes=Object.fromEntries(relevant.map(file=>[file,fileHash(join(f.platform,file))]));
  await host.stop();stopped=true;
  const proof={passed:true,at:new Date().toISOString(),environment:'COPIED_REAL_NODE_HTTP_SQLITE_AND_ACTUAL_NON_TTY_RPC_WITH_FAKE_FIRST_PARTY_TOOLS',fixtureRoot:f.platform,port:PORT,ownHostExited:host.child.exitCode===0,ordinaryChatCompleted:true,chatReplyCharacters:chatReply.length,chatReplySha256:sha(chatReply),textTaskCompleted:true,textTaskUserAccepted:true,engineeringExecutionAuthorized:false,identityPrepareDidNotEnable:true,cutoverChecks:4,previousBridgeReadOnlyAndUnchanged:true,foreignThreadReceiptRejected:true,allReplyTextPreserved:true,nonTty:true,cliModes,counts,nativeSource:'FAKE_FIRST_PARTY_THREAD_DATA_ONLY',realSessionsRead:0,realSessionsSent:0,realNativeOperations:0,sourceHashes:f.sourceHashes,snapshotSourceHashes,fixtureExecutorOnlyChange:'Replaced fixed D:\\TriReviewBridge path literal with fixtureRoot in copied executor only',fixtureExecutorHash:f.fixtureExecutorHash};
  const proofFile=join(f.platform,'fake-chatgpt-http-proof.json');writeFileSync(proofFile,JSON.stringify(proof,null,2));console.log('Fake ChatGPT HTTP proof: '+proofFile);
 }finally{if(host&&!stopped)await host.stop();}
});

