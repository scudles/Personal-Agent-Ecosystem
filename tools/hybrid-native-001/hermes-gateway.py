"""Fixed Hermes Gateway candidate. Never executed by fake tests. No model overrides."""
import sys,json,asyncio,hashlib,importlib.util
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('contract',HERE/'hermes_contract.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
ROOT=HERE.parent.parent
SUBMIT_STARTED=False
async def run(req,*,allow_policy_refresh=False):
    global SUBMIT_STARTED
    c.require(allow_policy_refresh is True,'native_policy_refresh_not_authorized')
    c.require(isinstance(req,dict) and req.get('operation') in ('inspect','submit','receipt'),'operation_not_allowed')
    op=req['operation']
    allowed={'inspect':{'operation'},'submit':{'operation','jobId','requestText','requestSha256','baseline'},'receipt':{'operation','admissionId'}}[op]
    c.require(set(req)==allowed,'request_fields_invalid')
    if op=='submit':
        import re
        text=req['requestText'];c.require(isinstance(req['jobId'],str) and re.fullmatch('[a-f0-9]{64}',req['jobId']) is not None,'job_id_invalid')
        c.require(isinstance(text,str) and 0<len(text)<=20000 and text.startswith(('TRB_CHAT ','TRB_REQUEST ','TRB_TEXT_TASK ')) and hashlib.sha256(text.encode()).hexdigest()==req['requestSha256'],'request_hash_invalid')
        c.require(isinstance(req['baseline'],dict) and set(req['baseline'])=={'tailHash','profileId'},'baseline_invalid')
    if op=='receipt':c.require(c.opaque(req['admissionId']),'admission_invalid')
    # This known adapter imports the existing SDK; no new Runtime/Session is made.
    spec=importlib.util.spec_from_file_location('existing',ROOT/'native/hermes-session.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
    endpoint=p.discover_gateway_endpoint(p.HOME)
    c.require(endpoint.state=='ready' and endpoint.endpoint is not None,'existing_gateway_not_ready_no_autostart')
    async with p.connect_gateway(endpoint=endpoint.endpoint,max_size=64*1024*1024) as client:
        if op=='receipt':
            # No transcript/resubmit lookup: exactly the acknowledged admission.
            small=await client.rpc('prompt.receipt',session_id=c.SESSION,admission_id=req['admissionId'],include_result=False)
            state=c.receipt_projection(small,req['admissionId'])
            if state['status']!='terminal':return state
            full=await client.rpc('prompt.receipt',session_id=c.SESSION,admission_id=req['admissionId'],include_result=True)
            # The SDK has received the whole own stored result in memory. Only this
            # projection is exported; this is NOT proof no private data was read.
            return c.receipt_projection(full,req['admissionId'],True)
        snapshot=await client.rpc('session.resume',session_id=c.SESSION)
        observation=c.inspect_snapshot(snapshot)
        if op=='inspect':return observation
        if observation['busy']:return {'ok':False,'error':'session_busy','mutationStarted':False}
        if req['baseline']['tailHash']!=observation['tailHash'] or req['baseline']['profileId']!=observation['profileId']:return {'ok':False,'error':'session_changed_before_submit','mutationStarted':False}
        SUBMIT_STARTED=True
        try:return c.submission(await client.rpc('prompt.submit',session_id=c.SESSION,input_id=req['jobId'],text=req['requestText']))
        except Exception:return {'ok':False,'error':'submit_outcome_unknown','mutationStarted':True}
if __name__=='__main__':
    try:
        c.require(sys.argv[1:]==['--ack-native-session-access','--ack-native-policy-refresh'],'explicit_native_access_and_policy_refresh_ack_required')
        raw=sys.stdin.buffer.read(140001);c.require(len(raw)<=140000,'input_too_large')
        value=asyncio.run(run(json.loads(raw.decode('utf8')),allow_policy_refresh=True))
        print(json.dumps(value,ensure_ascii=False))
    except Exception:
        print(json.dumps({'ok':False,'error':'native_gateway_unavailable_or_invalid','mutationStarted':SUBMIT_STARTED}))
        sys.exit(2)