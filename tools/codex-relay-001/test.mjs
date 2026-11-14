import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,writeFileSync,existsSync,symlinkSync,renameSync,rmdirSync,lstatSync,readdirSync}from'node:fs';
import{resolve,join}from'node:path';import{createServer}from'node:http';import{spawn}from'node:child_process';import{createInterface}from'node:readline';import{once}from'node:events';import{createHash}from'node:crypto';import{pathToFileURL}from'node:url';
const root=resolve('.'),folder=mkdtempSync(join(root,'test-output','relay-worker-')),sha=s=>createHash('sha256').update(s).digest('hex'),threadId='6af098fa-46bc-83e8-97c5-418f00e213b9',title='Nagi（继承的你1）';
const jobs={id:'fixture-job',state:'SUBMITTED',threadId,attemptToken:'fixed-fixture-attempt',requestText:"TRB_CHAT fixed fixture\n'@\n$(do-not-run) 中文",requestSha256:''};jobs.requestSha256=sha(jobs.requestText);
test('fixed-profile JSONL helper safely transports raw text and rejects unsupported source data',async t=>{
 const codeDir=join(folder,'tools','codex-relay-001'),dataDir=join(folder,'data','codex-relay-001');mkdirSync(codeDir,{recursive:true});mkdirSync(dataDir,{recursive:true});copyFileSync(join(root,'tools/codex-relay-001/worker.mjs'),join(codeDir,'worker.mjs'));
 let onRequest;const requests=[],token='f'.repeat(64),server=createServer(async(req,res)=>{let raw='';for await(const b of req)raw+=b;requests.push({path:req.url,auth:req.headers.authorization,body:raw?JSON.parse(raw):null});onRequest?.(req);res.setHeader('Content-Type','application/json');if(req.headers.authorization!=='Bearer '+token){res.writeHead(401);res.end('{}');return;}if(req.url==='/api/relay/peek')res.end(JSON.stringify({mode:'CODEX_RELAY',threadId,next:jobs,inflight:[jobs]}));else if(req.url==='/api/relay/receipt')res.end(JSON.stringify({id:jobs.id,state:'COMPLETED'}));else res.end(JSON.stringify({recorded:true}));});
 server.listen(0,'127.0.0.1');await once(server,'listening');const cfg={port:server.address().port,token,mode:'CODEX_RELAY',profileId:'codex-relay-001',databaseFile:'relay-workbench.sqlite'},cfgFile=join(dataDir,'workbench-config.json');writeFileSync(cfgFile,JSON.stringify(cfg));
 const child=spawn(resolve('runtime/node.exe'),[join(codeDir,'worker.mjs'),'--pipe'],{windowsHide:true,stdio:['pipe','pipe','pipe']});const lines=createInterface({input:child.stdout}),waiting=new Map();let seq=0,stderr='';child.stderr.on('data',d=>stderr+=d);lines.on('line',line=>{const r=JSON.parse(line);waiting.get(r.id)?.(r);waiting.delete(r.id);});
 const rpc=(op,input={})=>new Promise((ok,bad)=>{const id='f'+(++seq),timer=setTimeout(()=>bad(Error('fixture RPC timeout')),10000);waiting.set(id,r=>{clearTimeout(timer);ok(r);});child.stdin.write(JSON.stringify({id,op,input})+'\n');});
 const native=(reply='5')=>({thread:{id:threadId,kind:'chatgpt',title},turns:[{id:'native-user-and-turn',status:'completed',error:null,items:[{type:'userMessage',id:'native-user-and-turn',content:[{type:'text',text:jobs.requestText}]},{type:'agentMessage',id:'native-reply',text:reply}]}]});
 try{
 await t.test('read has no arbitrary params or arbitrary operations',async()=>{const n=requests.length;assert.equal((await rpc('peek',{path:'C:/private'})).ok,false);assert.equal((await rpc('delete',{})).ok,false);assert.equal(requests.length,n);});
 await t.test('same-turn original Unicode is hashed and submitted without shell interpolation',async()=>{const reply="中文结果\n'@\n$(not-a-command)\n"+'字'.repeat(15000),r=await rpc('observe',{jobId:jobs.id,native:native(reply)});assert.equal(r.ok,true);assert.equal(r.value.state,'COMPLETED');const received=requests.at(-1).body;assert.equal(received.requestText,jobs.requestText);assert.equal(received.replyText,reply);assert.equal(received.replySha256,sha(reply));assert.equal(received.nativeTurnId,received.nativeUserMessageId);assert.equal(JSON.stringify(r).includes('字'.repeat(10)),false);});

 await t.test('native single reply accepts 19999 characters and rejects the exact 20000 read cap without a receipt',async()=>{
  const accepted=await rpc('observe',{jobId:jobs.id,native:native('字'.repeat(19999))});assert.equal(accepted.ok,true);assert.equal(accepted.value.state,'COMPLETED');assert.equal(requests.at(-1).body.replyText.length,19999);
  const before=requests.filter(r=>r.path==='/api/relay/receipt').length,rejected=await rpc('observe',{jobId:jobs.id,native:native('字'.repeat(20000))});
  assert.equal(rejected.ok,false);assert.match(rejected.error,/relay_native_ids_or_text_unavailable/);assert.equal(requests.filter(r=>r.path==='/api/relay/receipt').length,before);
 });

 await t.test('wrong thread mismatched request and truncated reply never submit receipt',async()=>{const count=()=>requests.filter(r=>r.path==='/api/relay/receipt').length,before=count();const bad=native();bad.thread.id='foreign';assert.equal((await rpc('observe',{jobId:jobs.id,native:bad})).ok,false);const mismatch=native();mismatch.turns[0].items[0].content[0].text='foreign request';const missed=await rpc('observe',{jobId:jobs.id,native:mismatch});assert.equal(missed.value.matched,false);const cut=native();cut.turns[0].items[1].truncated=true;assert.equal((await rpc('observe',{jobId:jobs.id,native:cut})).ok,false);assert.equal(count(),before);});
 await t.test('invalid and different profile config never leaks credential or sends HTTP',async()=>{const before=requests.length;writeFileSync(cfgFile,'{"token":"secret-fixture-do-not-print" INVALID}');const r=await rpc('status');assert.equal(r.ok,false);assert.equal(JSON.stringify(r).includes('secret-fixture'),false);writeFileSync(cfgFile,JSON.stringify({...cfg,mode:'SIMULATION_ONLY'}));assert.equal((await rpc('status')).ok,false);assert.equal(requests.length,before);writeFileSync(cfgFile,JSON.stringify(cfg));});
 await t.test('GET status sanitizes duplicated inflight payload',async()=>{const r=await rpc('peek');assert.equal(r.ok,true);assert.equal(r.value.next.requestText,jobs.requestText);assert.equal(r.value.inflight[0].requestText,undefined);assert.equal(r.value.inflight[0].attemptToken,undefined);});

 await t.test('one-shot non-TTY spool RPC preserves Unicode and removes only validated own file',async()=>{
  const spool=join(codeDir,'spool');mkdirSync(spool,{recursive:true});const request={id:'spool_fixture',op:'observe',input:{jobId:jobs.id,native:native('果'.repeat(18000))}},encoded=Buffer.from(JSON.stringify(request)).toString('base64url'),file=join(spool,'spool_fixture.request.b64');const module=await import(pathToFileURL(join(codeDir,'worker.mjs')).href);for(let at=0;at<encoded.length;at+=6000)module.spoolChunk(request.id,at,encoded.slice(at,at+6000));
  const run=async args=>{const p=spawn(resolve('runtime/node.exe'),[join(codeDir,'worker.mjs'),...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let out='';p.stdout.on('data',b=>out+=b);p.stderr.resume();const [code]=await once(p,'exit');return{code,out};};
  const result=await run(['--rpc-file','spool_fixture']);assert.equal(result.code,0);assert.equal(JSON.parse(result.out).value.state,'COMPLETED');assert.equal(existsSync(file),false);assert.equal(requests.at(-1).body.replyText,'果'.repeat(18000));
  const outside=join(codeDir,'retain.txt');writeFileSync(outside,'retain');const before=requests.length,bad=await run(['--rpc-file','../retain']);assert.equal(bad.code,1);assert.equal(readFileSync(outside,'utf8'),'retain');assert.equal(requests.length,before);
 });


 await t.test('real Windows spool and ancestor junctions into platform and outside are rejected without target write read or delete',async()=>{
  assert.equal(process.platform,'win32','This regression requires actual Windows junctions');
  for(const ancestor of ['spool','tools'])for(const side of ['inside','outside']){
   const caseRoot=join(folder,'junction-'+ancestor+'-'+side),platform=join(caseRoot,'platform'),scripts=join(platform,'tools','codex-relay-001');
   mkdirSync(scripts,{recursive:true});copyFileSync(join(root,'tools/codex-relay-001/worker.mjs'),join(scripts,'worker.mjs'));
   const module=await import(pathToFileURL(join(scripts,'worker.mjs')).href),link=ancestor==='spool'?join(scripts,'spool'):join(platform,'tools'),held=join(platform,'held-tools');
   const target=side==='inside'?join(platform,'retained-target'):join(caseRoot,'external-target'),targetSpool=ancestor==='spool'?target:join(target,'codex-relay-001','spool');
   mkdirSync(targetSpool,{recursive:true});const id='blocked_fixture',payload=Buffer.from(JSON.stringify({id,op:'heartbeat',input:{workerId:'must-never-read-target'}})).toString('base64url'),targetFile=join(targetSpool,id+'.request.b64');writeFileSync(targetFile,payload);
   if(ancestor==='tools')renameSync(link,held);symlinkSync(target,link,'junction');assert.equal(lstatSync(link).isSymbolicLink(),true);
   const before=requests.length,listing=readdirSync(targetSpool);
   try{
    assert.throws(()=>module.spoolChunk('must_not_create',0,'YQ'),/spool_directory/);
    assert.throws(()=>module.spoolChunk(id,payload.length,'YQ'),/spool_directory/);
    await assert.rejects(()=>module.runSpoolRequest(id),/spool_directory/);
    assert.equal(requests.length,before);assert.equal(readFileSync(targetFile,'utf8'),payload);assert.deepEqual(readdirSync(targetSpool),listing);
   }finally{assert.equal(lstatSync(link).isSymbolicLink(),true);rmdirSync(link);if(ancestor==='tools')renameSync(held,link);}
  }
 });
 await t.test('cleanup rechecks full chain and leaves replacement junction targets and current unowned files intact',async()=>{
  for(const side of ['inside','outside']){
   const caseRoot=join(folder,'cleanup-'+side),platform=join(caseRoot,'platform'),scripts=join(platform,'tools','codex-relay-001'),data=join(platform,'data','codex-relay-001'),spool=join(scripts,'spool'),held=join(scripts,'held-spool'),target=side==='inside'?join(platform,'retained-target'):join(caseRoot,'external-target');
   mkdirSync(scripts,{recursive:true});mkdirSync(data,{recursive:true});mkdirSync(target,{recursive:true});copyFileSync(join(root,'tools/codex-relay-001/worker.mjs'),join(scripts,'worker.mjs'));writeFileSync(join(data,'workbench-config.json'),JSON.stringify(cfg));
   const module=await import(pathToFileURL(join(scripts,'worker.mjs')).href),id='cleanup_fixture',encoded=Buffer.from(JSON.stringify({id,op:'peek',input:{}})).toString('base64url');module.spoolChunk(id,0,encoded);
   const targetFile=join(target,id+'.request.b64');writeFileSync(targetFile,'retained synthetic target');
   let swapped=false;onRequest=()=>{onRequest=undefined;renameSync(spool,held);symlinkSync(target,spool,'junction');swapped=true;};
   try{const result=await module.runSpoolRequest(id);assert.equal(result.ok,true);assert.equal(swapped,true);assert.equal(readFileSync(targetFile,'utf8'),'retained synthetic target');assert.equal(readFileSync(join(held,id+'.request.b64'),'utf8'),encoded);}
   finally{onRequest=undefined;if(swapped){assert.equal(lstatSync(spool).isSymbolicLink(),true);rmdirSync(spool);renameSync(held,spool);}}
  }
  const module=await import(pathToFileURL(join(codeDir,'worker.mjs')).href),id='wrong_ownership',file=join(codeDir,'spool',id+'.request.b64'),encoded=Buffer.from(JSON.stringify({id:'different_id',op:'close',input:{}})).toString('base64url');writeFileSync(file,encoded);
  await assert.rejects(()=>module.runSpoolRequest(id),/request_id_mismatch/);assert.equal(readFileSync(file,'utf8'),encoded);
 });

 }finally{await rpc('close');child.stdin.end();await once(child,'exit');lines.close();await new Promise(r=>server.close(r));assert.equal(stderr.includes(token),false);}
});
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor,source=readFileSync('tools/codex-relay-001/executor.js','utf8'),execute=new AsyncFunction('tools','notify','options',source);
function fake({state='QUEUED',busy=false,wrong=false,error=false,paused=false,afterBegin=null}={}){
 const j={id:'new-job',state,threadId,requestText:'TRB_CHAT fictitious-only',attemptToken:state==='QUEUED'?undefined:'fixture-token',cancelRequested:false,blockReason:''},events=[],nativeCalls=[],encodedParts=[];let exists=true,afterApplied=false;
 const native=()=>({thread:{id:wrong?'foreign':threadId,title,kind:'chatgpt',status:{type:busy?'active':'idle'}},turns:[]});
 const handle=r=>{const {op,input}=r;events.push(op);let value={};
  if(op==='peek'&&j.state==='DISPATCHING'&&afterBegin&&!afterApplied){afterApplied=true;if(['restart','expired'].includes(afterBegin))j.state='UNKNOWN';if(afterBegin==='wrong-token')j.attemptToken='different-attempt';}
  if(op==='peek')value={mode:'CODEX_RELAY',profileId:'codex-relay-001',threadId,paused,next:exists?{...j,dispatchContinuationAllowed:j.state==='DISPATCHING'&&!paused&&afterBegin!=='scope-pause'}:null};
  if(op==='begin'){j.state='DISPATCHING';j.attemptToken='fixture-token';value={...j,maySend:true};}if(op==='submitted'){j.state='SUBMITTED';value={...j};}if(op==='unknown'){j.state='UNKNOWN';value={...j};}if(op==='observe')value={matched:false,state:j.state};
  return{exit_code:0,output:JSON.stringify({id:r.id,ok:true,status:200,value})+'\n'};
 };
 return{events,nativeCalls,j,encodedParts,tools:{exec_command:async args=>{
  assert.equal(args.tty,undefined,'no interactive terminal in production RPC');
  let m=args.cmd.match(/--rpc '([A-Za-z0-9_-]+)'$/);
  if(m)return handle(JSON.parse(Buffer.from(m[1],'base64url').toString('utf8')));
  m=args.cmd.match(/--spool-chunk '([A-Za-z0-9_-]+)' '([0-9]+)' '([A-Za-z0-9_-]+)'$/);if(m){assert.equal(Number(m[2]),encodedParts.join('').length);encodedParts.push(m[3]);return{exit_code:0,output:JSON.stringify({id:m[1],offset:Number(m[2])+m[3].length,ok:true})+'\n'};}
  m=args.cmd.match(/--rpc-file '([A-Za-z0-9_-]+)'$/);if(m)return handle(JSON.parse(Buffer.from(encodedParts.join(''),'base64url').toString('utf8')));
  throw Error('unexpected command outside fixed RPC');
 },write_stdin:async()=>{throw Error('no terminal stdin allowed');},mcp__codex_app__read_thread:async params=>{assert.ok(Number.isInteger(params.maxOutputCharsPerItem)&&params.maxOutputCharsPerItem<=20000,'native read cap must not exceed actual interface');return{content:[{type:'text',text:JSON.stringify(native())}]};},mcp__codex_app__send_message_to_thread:async p=>{nativeCalls.push(p);return error?{isError:true}:{content:[{type:'text',text:'{"threadId":"'+threadId+'"}'}]};}}};
}

test('executor queues without native write when paused or original app busy',async()=>{for(const c of [{paused:true},{busy:true}]){const f=fake(c);await execute(f.tools,()=>{},{once:true});assert.equal(f.nativeCalls.length,0);assert.equal(f.j.state,'QUEUED');assert.equal(f.events.includes('close'),false);}});
test('executor persists dispatch before exactly one original-chat tool call',async()=>{const f=fake();const r=await execute(f.tools,()=>{},{once:true});assert.equal(r.sent,1);assert.equal(f.nativeCalls.length,1);assert.deepEqual(Object.keys(f.nativeCalls[0]).sort(),['prompt','threadId']);assert.equal(f.nativeCalls[0].threadId,threadId);assert.ok(f.events.indexOf('begin')<f.events.indexOf('submitted'));assert.equal(f.j.state,'SUBMITTED');});
test('native error becomes UNKNOWN and next wake only reconciles never resends',async()=>{const f=fake({error:true});await execute(f.tools,()=>{},{once:true});assert.equal(f.j.state,'UNKNOWN');await execute(f.tools,()=>{},{once:true});assert.equal(f.nativeCalls.length,1);assert.ok(f.events.includes('observe'));});
test('unresolved SUBMITTED is read-only across wake and mismatched original ID never dispatches',async()=>{const pending=fake({state:'SUBMITTED'});await execute(pending.tools,()=>{},{once:true});assert.equal(pending.nativeCalls.length,0);assert.equal(pending.j.state,'SUBMITTED');const bad=fake({wrong:true});await assert.rejects(()=>execute(bad.tools,()=>{},{once:true}),/identity/);assert.equal(bad.nativeCalls.length,0);assert.equal(bad.j.state,'QUEUED');});

test('begin followed by restart expiry changed attempt or scope pause never sends',async()=>{for(const afterBegin of ['restart','expired','wrong-token','scope-pause']){const f=fake({afterBegin});const r=await execute(f.tools,()=>{},{once:true});assert.equal(f.nativeCalls.length,0,afterBegin);assert.equal(r.unknown,1);assert.equal(f.events.includes('close'),false);}});
test('success-shaped native acknowledgement for another thread remains UNKNOWN',async()=>{const f=fake();f.tools.mcp__codex_app__send_message_to_thread=async p=>{f.nativeCalls.push(p);return{content:[{type:'text',text:'{"threadId":"foreign"}'}]};};await execute(f.tools,()=>{},{once:true});assert.equal(f.nativeCalls.length,1);assert.equal(f.j.state,'UNKNOWN');});

test('real isolated Relay Host and JSONL worker complete a fictional native-shaped turn',async()=>{
 const {RelayCore}=await import('../../src/relay-core.mjs');
 const isolated=mkdtempSync(join(root,'test-output','relay-worker-host-')),data=join(isolated,'data','codex-relay-001'),toolsDir=join(isolated,'tools','codex-relay-001');mkdirSync(data,{recursive:true});mkdirSync(toolsDir,{recursive:true});copyFileSync(join(root,'tools/codex-relay-001/worker.mjs'),join(toolsDir,'worker.mjs'));
 const core=new RelayCore(join(data,'relay-workbench.sqlite'));core.control({paused:false});const p=core.project('虚构worker联调'),ws=core.workspace(p.id,'文字'),ctx={projectId:p.id,workspaceId:ws.id};core.bindRelay(ctx);core.configure(ctx,{paused:false,recipients:['chatgpt']});core.chat(ctx,{text:'虚构输入：'+'树'.repeat(5900),targets:['chatgpt']});core.close();
 const token='a'.repeat(64),config={port:0,token,mode:'CODEX_RELAY',profileId:'codex-relay-001',databaseFile:'relay-workbench.sqlite'};writeFileSync(join(data,'workbench-config.json'),JSON.stringify(config));
 const host=spawn(resolve('runtime/node.exe'),['src/workbench-server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,TRB_WORKBENCH_DATA_DIR:data,TRB_WORKBENCH_MODE:'CODEX_RELAY',TRB_WORKBENCH_PROFILE:'codex-relay-001',TRB_WORKBENCH_EMPTY:'1'},stdio:['ignore','pipe','pipe']});let log='';host.stdout.on('data',d=>log+=d);host.stderr.on('data',d=>log+=d);
 let helper,lines,info;
 try{
  for(let n=0;n<100;n++){await new Promise(r=>setTimeout(r,100));try{info=JSON.parse(readFileSync(join(data,'workbench-service.json'),'utf8'));if(info.pid===host.pid)break;}catch{}if(host.exitCode!==null)throw Error('fixture host failed: '+log);}
  assert.equal(info?.pid,host.pid);writeFileSync(join(data,'workbench-config.json'),JSON.stringify({...config,port:info.port}));
  helper=spawn(resolve('runtime/node.exe'),[join(toolsDir,'worker.mjs'),'--pipe'],{windowsHide:true,stdio:['pipe','pipe','pipe']});helper.stderr.resume();lines=createInterface({input:helper.stdout});const pending=new Map();let seq=0;lines.on('line',l=>{const r=JSON.parse(l);pending.get(r.id)?.(r);pending.delete(r.id);});
  const rpc=(op,input={})=>new Promise((ok,bad)=>{const id='i'+(++seq),timer=setTimeout(()=>bad(Error('host worker RPC timeout')),15000);pending.set(id,r=>{clearTimeout(timer);ok(r);});helper.stdin.write(JSON.stringify({id,op,input})+'\n');});
  assert.equal((await rpc('heartbeat',{workerId:'fictional-integration'})).ok,true);
  const pendingJob=(await rpc('peek')).value.next,begin=await rpc('begin',{jobId:pendingJob.id,workerId:'fictional-integration'});assert.equal(begin.ok,true);assert.equal((await rpc('peek')).value.next.dispatchContinuationAllowed,true);
  const j=begin.value;assert.equal((await rpc('submitted',{jobId:j.id,attemptToken:j.attemptToken,accepted:true})).ok,true);
  const reply='果'.repeat(19999),native={thread:{id:threadId,kind:'chatgpt',title},turns:[{id:'same-fixture-user-turn',status:'completed',error:null,items:[{type:'userMessage',id:'same-fixture-user-turn',content:[{type:'text',text:j.requestText}]},{type:'agentMessage',id:'independent-fixture-reply',text:reply}]}]};
  const received=await rpc('observe',{jobId:j.id,native});assert.equal(received.ok,true,JSON.stringify(received));assert.equal(received.value.state,'COMPLETED');assert.equal((await rpc('peek')).value.next,null);
  const view=await fetch(info.url+'/api/workspaces/'+ws.id+'?projectId='+p.id,{headers:{Authorization:'Bearer '+token}}).then(r=>r.json()),answer=view.messages.find(m=>m.author==='chatgpt');assert.equal(answer.body,reply);assert.equal(answer.source.simulation,false);assert.equal(answer.source.independentAuthentication,false);assert.equal(answer.source.fullToolTraceVerified,false);
  writeFileSync(join(root,'evidence/codex-relay-001/worker-integration.json'),JSON.stringify({passed:true,at:new Date().toISOString(),fixture:isolated,largeUnicodeReplyPreserved:true,realHttpHost:true,realJsonlWorker:true,nativeTool:'FAKE_NATIVE_SHAPED_DATA',realNativeOperations:0,originalSessionAuthenticationVerified:false},null,2));
  await rpc('close');helper.stdin.end();await once(helper,'exit');helper=null;
 }finally{
  if(helper){helper.stdin.end();await once(helper,'exit');}lines?.close();
  if(info){try{await fetch(info.url+'/api/service/stop',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});}catch{}}
  if(host.exitCode===null)await Promise.race([once(host,'exit'),new Promise((_,bad)=>setTimeout(()=>bad(Error('fixture host did not stop')),10000))]);
 }
});


test('executor chunks large Unicode observation as encoded data without shell interpolation',async()=>{
 const f=fake({state:'SUBMITTED'}),reply="虚构长回复\n'@\n$(never-run)\n😀"+'果'.repeat(18000);
 f.tools.mcp__codex_app__read_thread=async()=>({content:[{type:'text',text:JSON.stringify({thread:{id:threadId,title,kind:'chatgpt',status:{type:'idle'}},turns:[{id:'native-turn-user',status:'completed',error:null,items:[{type:'userMessage',id:'native-turn-user',content:[{type:'text',text:f.j.requestText}]},{type:'agentMessage',id:'native-answer',text:reply}]}]})}]});
 await execute(f.tools,()=>{},{once:true});assert.equal(f.nativeCalls.length,0);assert.ok(f.encodedParts.length>1);assert.ok(f.encodedParts.every(v=>v.length<=6000&&/^[A-Za-z0-9_-]+$/.test(v)));const request=JSON.parse(Buffer.from(f.encodedParts.join(''),'base64url').toString('utf8'));assert.equal(request.op,'observe');assert.equal(request.input.native.turns[0].items[1].text,reply);assert.equal(request.input.jobId,f.j.id);
});




