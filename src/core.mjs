import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
export const roles=['chatgpt','deepseek','hermes'];
export const hash=x=>createHash('sha256').update(x).digest('hex');
export const active=['queued','claimed','prepared','sending','sent','waiting','unknown'];
export function identity(role,value){
 if(!roles.includes(role))throw Error('unknown_role');
 if(role==='deepseek'&&/^dsh:session-[a-zA-Z0-9-]{16,100}$/.test(value))return value;
 if(role==='hermes'){if(!/^[a-zA-Z0-9_-]{8,128}$/.test(value)||value==='latest')throw Error('explicit_session_id_required');return value;}
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)throw Error('canonical_conversation_url_required');
 const valid=role==='chatgpt'?u.hostname==='chatgpt.com'&&/^\/(?:g\/[^/]+\/)?c\/[a-zA-Z0-9_-]{16,128}\/?$/.test(u.pathname):u.hostname==='chat.deepseek.com'&&/^\/a\/chat\/s\/[a-zA-Z0-9_-]{16,128}\/?$/.test(u.pathname);
 if(!valid)throw Error('existing_conversation_url_required');return u.origin+u.pathname.replace(/\/$/,'');
}
export class Store{
 constructor(file){this.db=new DatabaseSync(file);this.db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS items(kind TEXT,id TEXT,body TEXT NOT NULL,PRIMARY KEY(kind,id)); CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY,at TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL);");}
 get(k,id){const row=this.db.prepare('SELECT body FROM items WHERE kind=? AND id=?').get(k,id);return row?JSON.parse(row.body):null;}
 list(k){return this.db.prepare('SELECT body FROM items WHERE kind=? ORDER BY rowid').all(k).map(x=>JSON.parse(x.body));}
 put(k,id,v){this.db.prepare('INSERT INTO items VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body').run(k,id,JSON.stringify(v));return v;}
 log(kind,body){this.db.prepare('INSERT INTO events(at,kind,body) VALUES(?,?,?)').run(new Date().toISOString(),kind,JSON.stringify(body));}
 target(role,value){const canonical=identity(role,value);if(this.list('probe').some(p=>p.role===role&&active.includes(p.state)))throw Error('active_probe_prevents_rebind');const t={role,identity:canonical,revision:randomUUID(),at:new Date().toISOString()};this.put('target',role,t);this.log('target.specified',t);return t;}
 bind(role,observed){
 const t=this.get('target',role);if(!t||identity(role,observed.identity)!==t.identity)throw Error('target_mismatch');
 if(observed.messageCount<2||!observed.tailHash||observed.busy||observed.draft)throw Error('existing_idle_conversation_required');
 const b={role,identity:t.identity,revision:t.revision,verifiedAt:new Date().toISOString(),tailHash:observed.tailHash,messageCount:observed.messageCount,adapter:observed.adapter};this.put('binding',role,b);this.log('binding.verified',b);return b;
 }
 queue(role){const t=this.get('target',role),b=this.get('binding',role);if(!t||!b||b.revision!==t.revision)throw Error('verified_binding_required');if(this.list('probe').some(p=>p.role===role&&active.includes(p.state)))throw Error('probe_already_active');
 const id=randomUUID(),nonce=randomBytes(16).toString('hex');const ack='TRB_ACK '+id+' '+nonce;
 const prompt='[TRB_PHASE1 '+id+']\n这是用户授权的现有会话连通性验证，不是新任务或新的角色设定。请延续本对话既有上下文；不要调用工具，不要读写文件，不要执行项目任务，不要重置或新建会话。只原样回复以下一行，不加解释：\n'+ack;
 const p={id,role,identity:t.identity,revision:t.revision,nonce,ack,prompt,promptHash:hash(prompt),state:'queued',createdAt:new Date().toISOString()};this.put('probe',id,p);this.log('probe.queued',{id,role,identity:t.identity,promptHash:p.promptHash});return p;
 }
 claim(role,observed){const t=this.get('target',role),b=this.get('binding',role);if(!t||!b||t.revision!==b.revision||observed.identity!==t.identity||observed.busy||observed.draft)throw Error('binding_or_idle_check_failed');
 const p=this.list('probe').find(x=>x.role===role&&x.state==='queued');if(!p)return null;
 if(observed.tailHash!==b.tailHash||observed.messageCount!==b.messageCount)throw Error('conversation_changed_rebind_required');
 p.state='claimed';p.claim=randomBytes(24).toString('hex');p.before=observed;this.put('probe',p.id,p);this.log('probe.claimed',{id:p.id,role});return p;
 }
 event(id,claim,event){
 const p=this.get('probe',id);if(!p||p.claim!==claim)throw Error('invalid_claim');
 const t=this.get('target',p.role);if(!t||t.identity!==p.identity||t.revision!==p.revision)throw Error('binding_changed');
 const transitions={claimed:['prepared','blocked','unknown'],prepared:['sending','blocked','unknown'],sending:['sent','unknown'],sent:['waiting','received','unknown'],waiting:['received','unknown','blocked']};
 if(!(transitions[p.state]||[]).includes(event.state))throw Error('invalid_transition');
 if(event.identity!==p.identity)throw Error('wrong_conversation');
 if(event.state==='received'){
  if(event.reply?.trim()!==p.ack||event.promptText!==p.prompt||event.busy!==false||!event.sourceTurn||!(event.messageCount>p.before.messageCount || (p.before.counterKind==='window' && event.baselineFound===true && event.beforeTurn===p.before.tailId && event.sourceTurn!==p.before.tailId)))throw Error('reply_evidence_mismatch');
  p.reply=event.reply;p.replyHash=hash(event.reply);p.evidence={identity:event.identity,sourceTurn:event.sourceTurn,messageCount:event.messageCount,finishedAt:new Date().toISOString()};p.state='passed';
 }else p.state=event.state;
 if(event.reason)p.reason=String(event.reason).slice(0,500);
 this.put('probe',id,p);this.log('probe.'+p.state,{id,role:p.role,evidence:p.evidence,reason:p.reason});return p;
 }
 recover(){for(const p of this.list('probe'))if(['claimed','prepared','sending','sent','waiting'].includes(p.state)){p.state='unknown';p.reason='service_restarted_no_automatic_resend';this.put('probe',p.id,p);this.log('probe.unknown',{id:p.id,reason:p.reason});}}
 snapshot(){return {phase:1,targets:this.list('target'),bindings:this.list('binding'),probes:this.list('probe').map(({claim,...p})=>p)};}
 close(){this.db.close();}
}
