import {createServer} from 'node:http';
import{roomSnapshot,RoomMirror,mentionTargets}from'./room.mjs';import * as roomTransport from'./transports.mjs';
import{readJson as body}from'./http-body.mjs';
import {readFileSync,writeFileSync}from'node:fs';
import {join}from'node:path';import{timingSafeEqual}from'node:crypto';
import {Store}from'./core.mjs';import{Workflow}from'./workflow.mjs';import{Supervisor}from'./supervisor.mjs';
import{root,data,config,base}from'./config.mjs';
let legacy,w,supervisor,mirror;
const json=(r,status,v)=>{r.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});r.end(JSON.stringify(v));};
function auth(req){const a=Buffer.from(req.headers.authorization||''),b=Buffer.from('Bearer '+config.token);return a.length===b.length&&timingSafeEqual(a,b);}
const server=createServer(async(req,res)=>{
 try{
  if(req.headers.host!=='127.0.0.1:'+config.port)return json(res,403,{error:'invalid_host'});
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const path=new URL(req.url,base).pathname;
  if(req.method==='GET'&&['/','/app.js','/style.css'].includes(path)){const file=path==='/'?'index.html':path.slice(1);res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8','Cache-Control':'no-store'});return res.end(readFileSync(join(root,'web',file)));}
  if(!auth(req))return json(res,401,{error:'authentication_required'});
  if(req.headers.origin&&req.headers.origin!==base)return json(res,403,{error:'origin_denied'});
  if(!w)return json(res,503,{error:'starting'});
  if(req.method==='GET'&&path==='/api/room')return json(res,200,roomSnapshot(w));
  if(req.method==='GET'&&path==='/api/state')return json(res,200,{...w.snapshot(),phase1:legacy.snapshot()});
  if(req.method==='GET'&&path==='/api/phase1')return json(res,200,legacy.snapshot());
  if(req.method!=='POST')return json(res,404,{error:'not_found'});
  const b=await body(req);let out;if(!['/api/shutdown','/api/control'].includes(path))return json(res,409,{error:'legacy_read_only_real_adapters_disabled'});
  if(path==='/api/shutdown'){w.control({paused:true,reason:'operator shutdown; drain in-flight transports'});supervisor.stop();mirror?.stop();json(res,202,{stopping:true});const began=Date.now();const timer=setInterval(()=>{if(!supervisor.desktopBusy&&!supervisor.hermesBusy&&!mirror?.busy){clearInterval(timer);shutdown();}else if(Date.now()-began>40000){clearInterval(timer);console.error('Shutdown drain timed out; service left paused, not force-killed.');}},200);return;}
  if(path==='/api/control'){if(b.paused!==true||Object.values(b.rolePaused||{}).some(v=>v!==true))return json(res,409,{error:'legacy_pause_must_be_preserved'});out=w.control({paused:true,reason:b.reason||'legacy_read_only'});}
  else if(/^\/api\/deliveries\/[a-f0-9]{64}\/resume-verified-draft$/.test(path))return json(res,409,{error:'draft_recovery_disabled_user_chose_preserve'});
  else if(path==='/api/chat')out=w.createChat({...b,targets:mentionTargets(b.text,b.targets||[])});
  else if(path==='/api/cases')out=w.create(b,'user');
  else if(/^\/api\/cases\/[a-f0-9-]+\/revise$/.test(path)){const id=path.split('/')[3];if(w.get('case',id)?.revision!==b.expectedRevision)throw Error('revision_changed_reload');out=w.revise(id,b.body,{taskInstruction:b.taskInstruction});}
  else if(['/api/target','/api/probe','/bridge/bind','/bridge/claim','/bridge/event'].includes(path))return json(res,409,{error:'phase1_archived_use_phase2'});
  else return json(res,404,{error:'not_found'});
  json(res,200,out);
 }catch(e){json(res,400,{error:e.message});}
});
server.on('error',e=>{console.error('Platform could not bind its own loopback listener: '+e.code);process.exitCode=1;});
server.listen(config.port,'127.0.0.1',()=>{
 // Initialize and recover only after owning the port. A second launch cannot quarantine live work.
 legacy=new Store(join(data,'bridge.sqlite'));w=new Workflow(join(data,'workflow.sqlite'));
 // Legacy viewer retained read-only. No real Adapter or mirror is started in v1 development.
 supervisor={stop(){},desktopBusy:false,hermesBusy:false};mirror={stop(){},busy:false};
 writeFileSync(join(data,'service.json'),JSON.stringify({pid:process.pid,url:base,phase:2,startedAt:new Date().toISOString(),execPath:process.execPath},null,2));
 console.log('TriReviewBridge phase 2 ready on '+base+'; fixed existing conversations; text-only reviews.');
});
function shutdown(){supervisor?.stop();mirror?.stop();server.close(()=>{legacy?.close();w?.close();process.exit();});}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
