import asyncio,importlib.util,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
root=Path('D:/TriReviewBridge')
spec=importlib.util.spec_from_file_location('pinned_existing',root/'native/hermes-session.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
a=json.loads((root/'evidence/material-verifier-001/hermes-fixed-hash-attempt.json').read_text(encoding='utf-8-sig'))
async def run():
 ep=p.discover_gateway_endpoint(p.HOME)
 if ep.state!='ready' or ep.endpoint is None:raise RuntimeError('existing_gateway_not_ready_no_autostart')
 async with p.connect_gateway(endpoint=ep.endpoint,max_size=64*1024*1024) as client:
  snap=await client.rpc('session.resume',session_id=p.SESSION)
  obs=p.obs(snap);messages=snap.get('messages',[])
  matches=[i for i,m in enumerate(messages) if m.get('role')=='user' and p.content(m)==a['prompt']]
  if len(matches)!=1:raise RuntimeError('exact_one_authorized_prompt_required')
  start=matches[0]+1;end=next((i for i in range(start,len(messages)) if messages[i].get('role')=='user'),len(messages))
  finals=[m for m in messages[start:end] if m.get('role')=='assistant' and not m.get('tool_calls') and p.content(m).strip()]
  # Never export user messages, tool calls/results, earlier history or replies after a subsequent user turn.
  reply=finals[-1] if finals else None
  text=p.content(reply) if reply else ''
  complete=bool(reply and not obs['busy'] and a['nonce'] in text)
  out={'taskId':a['taskId'],'deliveryId':a['deliveryId'],'sessionId':p.SESSION,'nonce':a['nonce'],'requestSeen':True,'subsequentUserTurnDetected':end<len(messages),'replyBeforeSubsequentTurn':bool(reply),'completed':complete,'busy':obs['busy'],'routeFieldsUnchanged':obs['route']==a['baseline']['route'],'replyId':str(reply.get('id') or reply.get('message_id') or '') if reply else None,'reply':text if complete else None,'sourceType':'ORIGINAL_GATEWAY_AGENT_CLAIM','independentToolTraceVerified':False,'receiverByteVerified':False,'noResend':True}
  (root/'evidence/material-verifier-001/hermes-fixed-hash-bounded-receipt.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
  print(json.dumps(out,ensure_ascii=False))
asyncio.run(run())
