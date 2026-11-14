"""Phase-1 adapter; only attaches a pinned, existing gateway session. No runtime creation."""
import asyncio, hashlib, json, os, sys, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path("D:/HermesAgent/Source")
HOME = Path("D:/HermesAgent/Data")
SESSION = "local-6f275933587b3c068cdbe3bea5633785fb8cacfb3a4c298855c66d931b6946d7"
os.environ["HERMES_HOME"] = str(HOME)
sys.dont_write_bytecode = True
sys.path.insert(0, str(SOURCE))
from hermes_cli.gateway_runtime import discover_gateway_endpoint
from hermes_cli.gateway_client import connect_gateway

def api(path, body=None):
    cfg = json.loads((ROOT/"data/local-config.json").read_text(encoding="utf-8"))
    req = urllib.request.Request("http://127.0.0.1:"+str(cfg["port"])+path,
        data=None if body is None else json.dumps(body).encode(),
        headers={"Authorization":"Bearer "+cfg["token"],"Content-Type":"application/json"})
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=10) as r:
        return json.load(r)

def obs(s):
    if s.get("session_id") != SESSION or s.get("stored_session_id") != SESSION:
        raise RuntimeError("session_identity_mismatch")
    info = s.get("info") or {}
    if info.get("title") != "Nagi": raise RuntimeError("session_title_mismatch")
    messages=s.get("messages", [])
    return {"identity":SESSION,"messageCount":len(messages),
        "tailHash":hashlib.sha256(json.dumps(messages,ensure_ascii=False,sort_keys=True).encode()).hexdigest(),
        "busy":bool(s.get("running") or s.get("pending") or s.get("prompts") or s.get("open_requests")),
        "draft":False,"adapter":"hermes-gateway-shared-session","title":"Nagi",
        "route":{"model":info.get("model"),"provider":info.get("provider"),"reasoning":info.get("reasoning_effort"),"profile":info.get("profile_id")}}

def content(m):
    c=m.get("content","")
    if isinstance(c,str): return c
    return "".join(x.get("text","") for x in c if isinstance(x,dict) and x.get("type")=="text")

async def main():
    mode=sys.argv[1] if len(sys.argv)>1 else "inspect"
    if mode not in ("inspect","bind","probe"): raise RuntimeError("unsupported_operation")
    r=discover_gateway_endpoint(HOME)
    if r.state!="ready" or r.endpoint is None: raise RuntimeError("existing_gateway_not_ready_no_autostart")
    async with connect_gateway(endpoint=r.endpoint,max_size=64*1024*1024) as client:
        snap=await client.rpc("session.resume",session_id=SESSION)
        observation=obs(snap)
        if mode=="inspect": print(json.dumps(observation,ensure_ascii=False)); return
        if observation["busy"]: raise RuntimeError("session_busy")
        if mode=="bind":
            print(json.dumps(api("/bridge/bind",{"role":"hermes","observation":observation}),ensure_ascii=False));return
        claimed=api("/bridge/claim",{"role":"hermes","observation":observation})
        if not claimed: raise RuntimeError("no_queued_probe")
        def event(state,**extra):
            return api("/bridge/event",{"id":claimed["id"],"claim":claimed["claim"],"event":{"state":state,"identity":SESSION,**extra}})
        event("prepared");event("sending")
        try:
            receipt=await client.rpc("prompt.submit",session_id=SESSION,input_id=claimed["id"],text=claimed["prompt"])
        except Exception:
            event("unknown",reason="gateway_submit_outcome_unknown_no_resend");raise
        event("sent");event("waiting")
        admission=receipt.get("admission_id")
        deadline=asyncio.get_running_loop().time()+180
        while asyncio.get_running_loop().time()<deadline:
            await asyncio.sleep(2)
            # Read through the same authority; no caller-supplied reconstruction of conversation history.
            after=await client.rpc("session.resume",session_id=SESSION)
            now=obs(after);messages=after.get("messages",[])
            indexes=[i for i,m in enumerate(messages) if m.get("role")=="user" and content(m)==claimed["prompt"]]
            if not indexes: continue
            i=indexes[-1]
            candidates=[(j,m) for j,m in enumerate(messages) if j>i and m.get("role")=="assistant" and content(m).strip()==claimed["ack"]]
            if candidates and not now["busy"]:
                j,m=candidates[-1]
                if now["route"]!=observation["route"]:
                    event("unknown",reason="session_route_changed");raise RuntimeError("session_route_changed")
                out=event("received",promptText=content(messages[i]),reply=content(m),busy=False,
                    sourceTurn=str(m.get("id") or m.get("message_id") or admission or j),
                    messageCount=len(messages))
                print(json.dumps({"id":out["id"],"state":out["state"],"reply":out.get("reply"),"route":now["route"]},ensure_ascii=False));return
        event("unknown",reason="reply_not_verified_before_timeout");raise RuntimeError("reply_timeout_no_resend")

if __name__=="__main__":
    try: asyncio.run(main())
    except Exception as exc:
        print(json.dumps({"error":str(exc),"no_new_session":True}),file=sys.stderr);sys.exit(1)
