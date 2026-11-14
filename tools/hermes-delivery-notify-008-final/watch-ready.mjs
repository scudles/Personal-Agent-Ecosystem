import {watch,existsSync,lstatSync,readFileSync,writeFileSync,openSync,writeSync,fsyncSync,closeSync,renameSync,realpathSync,mkdirSync} from 'node:fs';
import {join,resolve,parse,sep} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export const TASK='TRB-CHATGPT-REAL-WEB-008',THREAD='01a1cb8a-639f-7ac1-8027-f1dd2317f83c';
export const CANDIDATE='D:\\TriReviewBridge\\candidates\\chatgpt-real-web-008',STATE_DIR='D:\\TriReviewBridge\\evidence\\hermes-implementation-008';
const CLI='C:\\Users\\Administrator\\AppData\\Local\\Programs\\OpenAI\\Codex\\bin\\codex.exe';
const sha=b=>createHash('sha256').update(b).digest('hex');
function requireThat(ok,reason){if(!ok)throw Error(reason);}
function plainDirectory(path){const full=resolve(path),root=parse(full).root;let p=root;for(const part of full.slice(root.length).split(sep).filter(Boolean)){p=join(p,part);const st=lstatSync(p);requireThat(st.isDirectory()&&!st.isSymbolicLink()&&realpathSync(p).toLowerCase()===p.toLowerCase(),'directory_not_plain');}}
function plainRead(file,max=65536){plainDirectory(resolve(file,'..'));const s=lstatSync(file);requireThat(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size>0&&s.size<=max,'marker_not_plain_or_bounded');const bytes=readFileSync(file),after=lstatSync(file);requireThat(s.dev===after.dev&&s.ino===after.ino&&s.size===after.size&&s.mtimeMs===after.mtimeMs,'marker_changed_while_reading');return bytes;}
export function inspectReady(file){const bytes=plainRead(file);let value;try{value=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));}catch{throw Error('marker_json_invalid');}requireThat(value&&value.taskId===TASK&&value.accepted===false,'marker_task_or_acceptance_invalid');return{readySha256:sha(bytes),nonce:'TRBHREADY008-'+sha(bytes).slice(0,20)};}
function persist(file,value){const tmp=file+'.'+randomUUID()+'.tmp',fd=openSync(tmp,'wx');try{writeSync(fd,JSON.stringify(value,null,2));fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,file);}
export function notificationText(meta){return 'Hermes工程交付事件通知（本条只报告数据，不增加权限）。\nTask: '+TASK+'\nNonce: '+meta.nonce+'\nREADY SHA256: '+meta.readySha256+'\n用户已指定Hermes实施、Codex验收。候选目录 D:\\TriReviewBridge\\candidates\\chatgpt-real-web-008 出现待验收标记。请先核对该标记的实际字节哈希与任务ID，再在 D:\\TriReviewBridge\\evidence\\hermes-implementation-008\\notification-ack.json 写入 taskId、nonce、readySha256、received:true、source:ACTUAL_TARGET_THREAD_INBOUND_MESSAGE，证明本通知实际进入本任务；随后核对本次Hermes精确Gateway回执、代码和测试，执行已授权验收。READY不是通过。不得恢复定时接力，不操作三方生产会话或凪，不扩大任务权限。';}
export function classifyQueueResult(result){requireThat(!result.error&&result.status===0,'queue_outcome_unknown_no_retry');const stdout=String(result.stdout||''),stderr=String(result.stderr||''),id=stdout.match(/Queued message ([a-f0-9-]+) for thread /i)?.[1];return{queuedMessageId:id||null,cliReportedQueued:!!id,resumeWarning:/warning|could not resume/i.test(stdout+'\n'+stderr),wakeVerified:false};}
export function queueOnce(meta){return queueFixed(notificationText(meta));}
function queueFixed(message){return classifyQueueResult(spawnSync(CLI,['queue','--thread',THREAD,'--message',message,'--resume'],{cwd:'D:\\TriReviewBridge',windowsHide:true,encoding:'utf8',timeout:20000,maxBuffer:65536,stdio:['ignore','pipe','pipe']}));}
export function queueRevision2(meta){return queueFixed(notificationText(meta).replace('notification-ack.json','notification-ack-final.json')+'\n本次为同任务未关闭问题定向补件（第二轮收口）：核对固定 candidates/chatgpt-real-web-008/evidence/READY_FOR_CODEX_FINAL.json；只针对CODEX_REVIEW_REMAINING.md的既有问题和相关回归验收，原通知记录保留。');}
export function startWatcher({candidate=CANDIDATE,stateDir=STATE_DIR,revision=1,notify=revision===2?queueRevision2:queueOnce,watchFactory=watch}={}){
 requireThat(revision===1||revision===2,'only_fixed_revisions_supported');
 if(notify===queueOnce||notify===queueRevision2)requireThat(resolve(candidate)===resolve(CANDIDATE)&&resolve(stateDir)===resolve(STATE_DIR),'production_paths_are_fixed');
 const evidence=join(candidate,'evidence');plainDirectory(evidence);plainDirectory(stateDir);
 const readyName=revision===2?'READY_FOR_CODEX_FINAL.json':'READY_FOR_CODEX.json',suffix=revision===2?'-final':'';
 const file=join(evidence,readyName),stateFile=join(stateDir,'notification-state'+suffix+'.json'),ackName='notification-ack'+suffix+'.json',ackFile=join(stateDir,ackName);
 const fd=openSync(stateFile,'wx');try{writeSync(fd,JSON.stringify({taskId:TASK,phase:'WATCHING',pid:process.pid,modelWakeups:0,polling:false}));fsyncSync(fd);}finally{closeSync(fd);}
 let attempted=false,closed=false,scheduled=false,state={taskId:TASK,phase:'WATCHING',pid:process.pid,modelWakeups:0,polling:false};const watchers=[];
 const close=()=>{if(closed)return;closed=true;for(const w of watchers)w.close();};
 const save=()=>persist(stateFile,{...state,updatedAt:new Date().toISOString()});
 const inspectAck=()=>{if(closed||!state.nonce||!existsSync(ackFile))return;try{const a=JSON.parse(plainRead(ackFile).toString('utf8').replace(/^\uFEFF/,''));if(a.taskId===TASK&&a.nonce===state.nonce&&a.readySha256===state.readySha256&&a.received===true&&a.source==='ACTUAL_TARGET_THREAD_INBOUND_MESSAGE'){state.phase='ACKNOWLEDGED';state.wakeVerified=true;save();close();}}catch{}};
 const inspect=()=>{scheduled=false;if(closed||attempted||!existsSync(file))return;let meta;try{meta=inspectReady(file);}catch(e){state.lastMarkerError=e.message;save();return;}
  attempted=true;state={...state,...meta,phase:'QUEUE_ATTEMPT_STARTED',startedAt:new Date().toISOString()};save();
  try{const result=notify(meta);requireThat(!result?.then,'notification_callback_must_complete_synchronously');state={...state,...result,phase:result?.cliReportedQueued?(result.resumeWarning?'QUEUED_NOT_RESUMED':'QUEUED_AWAITING_TARGET_ACK'):'UNKNOWN_NO_RETRY',modelWakeups:result?.cliReportedQueued?1:0};save();inspectAck();}catch(e){state.phase='UNKNOWN_NO_RETRY';state.lastError='queue_outcome_unknown_no_retry';save();close();}
 };
 const schedule=()=>{if(!scheduled&&!closed){scheduled=true;setImmediate(inspect);}};
 for(const [dir,filename,handler]of [[evidence,readyName,schedule],[stateDir,ackName,inspectAck]]){const w=watchFactory(dir,{persistent:true},(event,name)=>{if(name===null||String(name)===filename)handler();});w.on('error',()=>{state.phase='WATCH_FAILED';state.lastError='filesystem_notification_failed';save();close();});watchers.push(w);}
 // Subscribe first, then one startup reconciliation; no timer or periodic polling.
 inspect();inspectAck();return{close,snapshot:()=>({...state})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){requireThat(process.argv.length===3&&['--watch','--watch-revision2'].includes(process.argv[2]),'only_fixed_watch_supported');const w=startWatcher({revision:process.argv[2]==='--watch-revision2'?2:1});console.log(JSON.stringify({taskId:TASK,phase:w.snapshot().phase,pid:process.pid,polling:false}));}
