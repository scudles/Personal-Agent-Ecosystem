"""Standalone transport: pinned original Hermes session only. No model/permission overrides."""
import asyncio, hashlib, json, os, sys
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/"native"))
import importlib.util
spec=importlib.util.spec_from_file_location("phase1",ROOT/"native/hermes-session.py")
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
def sha(s):return hashlib.sha256(s.encode()).hexdigest()
async def run():
 operation=sys.argv[1]
 request=json.loads(sys.stdin.read() or "{}")
 if operation not in ("inspect","send","read","latest","tail"):raise RuntimeError("operation_not_allowed")
 r=p.discover_gateway_endpoint(p.HOME)
 if r.state!="ready" or r.endpoint is None:raise RuntimeError("existing_gateway_not_ready_no_autostart")
 async with p.connect_gateway(endpoint=r.endpoint,max_size=64*1024*1024) as client:
  snap=await client.rpc("session.resume",session_id=p.SESSION)
  o=p.obs(snap);o["sessionId"]=p.SESSION
  if operation=="inspect":return o
  if operation=="tail":
   messages=snap.get("messages",[]);out=[];user=""
   for index,m in list(enumerate(messages))[-50:]:
    role=m.get("role");text=p.content(m)
    if role=="user":user=text
    if role not in ("user","assistant") or not text.strip():continue
    out.append({"id":str(m.get("id") or m.get("message_id") or "hermes-index:"+str(index)),"speaker":role,"text":text,"userText":user,"streaming":bool(o["busy"] and index==len(messages)-1 and role=="assistant")})
   return {"messages":out,"coverage":"gateway_transcript"}
  if operation=="latest":
   messages=snap.get("messages",[])
   last=next((m for m in reversed(messages) if m.get("role")=="assistant" and p.content(m).strip()),None)
   if not last or o["busy"]:return None
   last_user=max([i for i,m in enumerate(messages) if m.get("role")=="user"] or [-1])
   text=p.content(last)
   return {"raw":text,"sessionId":p.SESSION,"replyId":str(last.get("id") or last.get("message_id") or "hermes:"+sha(text)),
    "completed":True,"noToolCalls":not any(m.get("role")=="tool" or m.get("tool_calls") for m in messages[last_user+1:])}

  prompt=request.get("prompt","")
  if not prompt.startswith(("TRB_REQUEST ","TRB_CHAT ")) or len(prompt)>20000:raise RuntimeError("platform_envelope_required")
  if operation=="send":
   if o["busy"]:return {"error":"session_busy","mutationStarted":False}
   baseline=request.get("baseline",{})
   if baseline.get("tailHash")!=o["tailHash"]:return {"error":"history_changed_before_send","mutationStarted":False}
   try:
    receipt=await client.rpc("prompt.submit",session_id=p.SESSION,input_id=request["deliveryId"],text=prompt)
    return {"submitted":True,"mutationStarted":True,"admissionId":receipt.get("admission_id"),"sessionId":p.SESSION}
   except Exception as e:return {"error":str(e),"mutationStarted":True}
  messages=snap.get("messages",[])
  candidates=[i for i,m in enumerate(messages) if m.get("role")=="user" and p.content(m)==prompt]
  if not candidates:return {"requestSeen":False,"sessionId":p.SESSION,"busy":o["busy"]}
  i=candidates[-1];following=messages[i+1:]
  if any(m.get("role")=="user" for m in following):return {"requestSeen":True,"conflict":True,"sessionId":p.SESSION}
  replies=[m for m in following if m.get("role")=="assistant" and p.content(m).strip() and not m.get("tool_calls")]
  no_tools=not any(m.get("role")=="tool" or m.get("tool_calls") for m in following)
  if not replies:return {"requestSeen":True,"sessionId":p.SESSION,"busy":o["busy"],"completed":False}
  answer=replies[-1];text=p.content(answer)
  return {"requestSeen":True,"sessionId":p.SESSION,"busy":o["busy"],"completed":not o["busy"],"noToolCalls":no_tools,
   "sourceUserId":"request:"+sha(prompt),"replyId":str(answer.get("id") or answer.get("message_id") or "hermes:"+sha(text)),
   "promptText":prompt,"reply":text,"route":o["route"],"coverage":"gateway_transcript"}
try:
 result=asyncio.run(run());print(json.dumps(result,ensure_ascii=False))
except Exception as e:
 print(json.dumps({"error":str(e),"mutationStarted":False,"noNewSession":True},ensure_ascii=False));sys.exit(1)
