import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {zstdDecompressSync} from 'node:zlib';
import {boundedRead, fixedRoot, within} from '../safe-local-files.mjs';

export const SESSION = 'session-ebd654d5-1bf8-419c-bc2a-d9be1ed023fc';
const LOG = 'C:/Users/Administrator/.dsh/sessions/--E-~51EA--/'+SESSION+'/session.v4.jsonl.zstd';
export const NONCE = 'TRB-DSH-MATERIAL-20261112-001';
export const PROMPT_HASH = '351140d1d51264d6e81037ae3488b274b8d7e4ccc905c55b26365f53cd23fa23';
const MAX = 64 * 1024 * 1024, DECODED_MAX = 256 * 1024 * 1024;
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const fail = code => {throw Error(code);};
const plain = c => {if(!Array.isArray(c))fail('invalid_content');const t=c.filter(p=>p?.type==='text');if(t.some(p=>typeof p.text!=='string'))fail('invalid_text');return t.map(p=>p.text).join('');};
export function sealedPrompt() {
  const p = path.join(fixedRoot,'交付材料','DSH本次试投请求.txt');
  const text = boundedRead(p,16384).toString('utf8').replace(/\r\n/g,'\n').replace(/\n$/,'');
  if(createHash('sha256').update(text).digest('hex')!==PROMPT_HASH || !text.includes(NONCE))fail('sealed_request_changed');
  return text;
}
// V4: assistant block.id -> tool/call.data.callId -> result.message.toolCallId.
function closedTools(segment,turn) {
  const calls=new Map(),resultIds=new Set();let results=0;
  const id=v=>typeof v==='string'&&v.length>0&&v.length<=512;
  for(const e of segment) {
    if(e.type==='assistant/message') {
      if([...calls.values()].some(c=>c.state!=='closed')||e.data.interrupted===true)fail('unfinished_tools_before_assistant');
      for(const b of e.data.message.content.filter(b=>b.type==='tool-call')) {
        if(!id(b.id)||calls.has(b.id)||!Number.isSafeInteger(e.data.step))fail('invalid_or_duplicate_call');
        calls.set(b.id,{state:'declared',step:e.data.step,name:b.name});
      }
    } else if(e.type==='tool/call') {
      const c=calls.get(e.data.callId);
      if(!c||c.state!=='declared'||e.data.turn!==turn||e.data.step!==c.step||e.data.name!==c.name)fail('invalid_call_start');
      c.state='started';c.seq=e.seq;
    } else if(e.type==='tool/result') {
      const m=e.data.message,c=calls.get(m?.toolCallId);
      if(!c||c.state!=='started'||e.data.turn!==turn||e.data.step!==c.step||!uuid(m.id)||resultIds.has(m.id)||
        m.role!=='tool'||m.source?.kind!=='tool'||m.source.callId!==m.toolCallId||!Array.isArray(m.content)||
        !Array.isArray(e.sourceEventSeqs)||e.sourceEventSeqs.length!==1||e.sourceEventSeqs[0]!==c.seq)fail('invalid_or_duplicate_result');
      c.state='closed';resultIds.add(m.id);results++;
    }
  }
  if([...calls.values()].some(c=>c.state!=='closed'))fail('unfinished_tools');
  return {calls:calls.size,results};
}
// Physical access is separately gated by CLI. This pure reducer never opens a session.
export function inspectRows(rows,{fixture=true,now=Date.now(),sealedRequest}={}) {
  const prompt=sealedRequest?.text??sealedPrompt(),nonce=sealedRequest?.nonce??NONCE;
  if(sealedRequest&&(!prompt||typeof nonce!=='string'||!nonce||!prompt.includes(nonce)||!Number.isSafeInteger(sealedRequest.preparedAt)||sealedRequest.preparedAt>now||typeof sealedRequest.headerAnchor!=='string'||prompt.split('\n',1)[0]!==sealedRequest.headerAnchor))fail('invalid_request_seal');
  if(!Array.isArray(rows)||rows.length<2||rows.length>500000)fail('invalid_rows');
  const h=rows[0], session=fixture?'fixture-dsh-own-receipt':SESSION;
  if(h.type!=='session'||h.version!==4||h.id!==session||h.origin==='subagent'||
    h.cwd!==(fixture?'D:\\Fictional':'E:\\凪')||fixture&&h.fixture!==true)fail('wrong_identity');
  const events=rows.slice(1);
  for(let i=0;i<events.length;i++) {
    const e=events[i];
    if(e.seq!==i||!Number.isSafeInteger(e.time)||e.time<0||e.time>now||typeof e.type!=='string'||!e.data)fail('invalid_event');
  }
  const title=events.filter(e=>e.type==='session/title').at(-1)?.data.title;
  if(title!==(fixture?'虚构会话':'主进度'))fail('wrong_title');
  const matches=events.filter(e=>e.type==='user/message'&&plain(e.data.content)===prompt);
  if(matches.length!==1)fail('request_not_unique');
  const user=matches[0];if(events.filter(e=>e.type==='user/message'&&(sealedRequest?plain(e.data.content).split('\n',1)[0]===sealedRequest.headerAnchor:plain(e.data.content).includes(nonce))).length!==1||['time-context','runtime-context'].includes(user.data.source?.kind))fail('ambiguous_nonce');if(!uuid(user.data.id))fail('missing_user_uuid');
  if(events.filter(e=>e.type==='user/message'&&e.data.id===user.data.id).length!==1)fail('duplicate_user_uuid');
  const begin=events.slice(0,user.seq+1).findLast(e=>e.type==='turn/start');
  if(!begin||!Number.isSafeInteger(begin.data.turn))fail('missing_turn_start');
  if(events.slice(begin.seq+1,user.seq).some(e=>e.type==='turn/end'))fail('request_outside_turn');
  const end=events.slice(user.seq+1).find(e=>e.type==='turn/end'||e.type==='turn/start');
  if(!end||end.type!=='turn/end'||end.data.turn!==begin.data.turn||end.data.reason?.kind!=='completed')fail('incomplete_turn');
  const segment=events.slice(begin.seq+1,end.seq);
  if(segment.some(e=>e.type==='user/message'&&e!==user&&!['time-context','runtime-context'].includes(e.data.source?.kind)))fail('intervening_user');
  const assistants=segment.filter(e=>e.type==='assistant/message');
  if(!assistants.length||assistants.some(e=>e.seq<user.seq||e.data.turn!==begin.data.turn||!uuid(e.data.message?.id)))fail('ambiguous_reply');
  const reply=assistants.at(-1), content=reply.data.message.content;
  const text=plain(content);
  if(!text.trim()||content.some(p=>p.type==='tool-call')||reply.data.interrupted===true)fail('incomplete_reply');
  if(events.filter(e=>e.type==='assistant/message'&&e.data.message?.id===reply.data.message.id).length!==1)fail('duplicate_reply_uuid');
  const accepted=events.filter(e=>e.type==='agent/inbox/spliced'&&e.data.inserted?.some(m=>m.id===user.data.id));
  if(accepted.length>1||accepted.some(e=>e.seq>=user.seq||plain(e.data.inserted.find(m=>m.id===user.data.id).content)!==prompt))fail('ambiguous_acceptance');
  const tools=closedTools(segment,begin.data.turn);
  const own=[begin,user,...assistants,...segment.filter(e=>e.type==='tool/call'||e.type==='tool/result'),end,...accepted].sort((a,b)=>a.seq-b.seq);
  if(own.some((e,i)=>i&&e.time<own[i-1].time))fail('nonmonotonic_own_time');
  if(sealedRequest){if(user.time<sealedRequest.preparedAt||accepted.some(e=>e.time<sealedRequest.preparedAt))fail('request_before_seal');}
  else if(!fixture&&(user.time<Date.parse('2026-11-12T15:02:00Z')||user.time>Date.parse('2026-11-12T15:16:00Z')))fail('outside_canary_time_window');
  return {status:'RECEIPT_FOUND',taskId:'TRB-DSH-OWN-RECEIPT-001',fixture,nonce,sessionId:session,
    coverage:'persisted_own_turn_only',timestampMeaning:'Harness event acceptance wall-clock milliseconds; not UI click time',
    request:{id:user.data.id,seq:user.seq,time:user.time,acceptedAt:accepted[0]?.time??null,text:prompt},
    turn:{number:begin.data.turn,startSeq:begin.seq,startTime:begin.time,endSeq:end.seq,endTime:end.time},
    reply:{id:reply.data.message.id,seq:reply.seq,time:reply.time,text},
    tools,
    integrity:'NOT_BYTE_VERIFIED',executionAuthorized:false};
}
function checkAncestors(p) {
  let current=path.parse(p).root;
  for(const part of [null,...path.relative(current,p).split(path.sep)]) {
    if(part)current=path.join(current,part);
    const st=fs.lstatSync(current);
    if(st.isSymbolicLink()||fs.realpathSync(current).toLowerCase()!==current.toLowerCase())fail('linked_real_path');
  }
}
export function readFixedLog({ackPrivateHistory=false}={}) {
  if(ackPrivateHistory!==true)fail('private_history_ack_required');
  // No discovery, list, RPC, resume, flush, app import or alternate generation fallback.
  const p=path.resolve(LOG);checkAncestors(p);
  const before=fs.lstatSync(p);
  if(!before.isFile()||before.nlink!==1||before.size>MAX)fail('unbounded_or_shared_log');
  const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs&&a.nlink===b.nlink;
  const fd=fs.openSync(p,'r');
  try {
    const opened=fs.fstatSync(fd);if(!same(before,opened))fail('unstable_log');
    const bytes=Buffer.alloc(opened.size);let offset=0;
    while(offset<bytes.length){const n=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);if(!n)fail('unstable_log');offset+=n;}
    if(fs.readSync(fd,Buffer.alloc(1),0,1,bytes.length)||!same(opened,fs.fstatSync(fd))||!same(opened,fs.lstatSync(p)))fail('unstable_log');
    checkAncestors(p);
    return zstdDecompressSync(bytes,{maxOutputLength:DECODED_MAX});
  } finally {fs.closeSync(fd);}
}
export function run(args) {
  try {
    let bytes,fixture=true;
    if(args.length===2&&args[0]==='--real'&&args[1]==='--ack-private-history-read') {
      fixture=false;bytes=readFixedLog({ackPrivateHistory:true});
    } else if(args.length===2&&args[0]==='--fixture') {
      const p=path.resolve(args[1]);
      if(!within(path.join(fixedRoot,'test-output'),p)||!path.relative(path.join(fixedRoot,'test-output'),p).split(path.sep)[0].startsWith('dsh-own-receipt-fake-'))fail('fixture_path_refused');
      bytes=boundedRead(p,MAX);
    } else fail('explicit_fixture_or_real_mode_required');
    if(bytes.length>DECODED_MAX)fail('decoded_limit');
    const lines=new TextDecoder('utf-8',{fatal:true}).decode(bytes).split('\n');if(lines.at(-1)==='')lines.pop();
    if(lines.some(l=>!l||Buffer.byteLength(l)>4*1024*1024))fail('invalid_line');
    return inspectRows(lines.map(l=>JSON.parse(l)),{fixture});
  } catch {return {status:'UNKNOWN',taskId:'TRB-DSH-OWN-RECEIPT-001',reason:'receipt_not_uniquely_verified',detailsRedacted:true};}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const result=run(process.argv.slice(2));process.stdout.write(JSON.stringify(result)+'\n');
  process.exitCode=result.status==='RECEIPT_FOUND'?0:2;
}
