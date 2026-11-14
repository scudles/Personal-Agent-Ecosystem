"""Pure fixed-session projection checks; no Runtime, Gateway, DB, or native IO imports."""
import hashlib,json
SESSION='local-6f275933587b3c068cdbe3bea5633785fb8cacfb3a4c298855c66d931b6946d7'
TITLE='Nagi'
def require(ok,code):
    if not ok: raise ValueError(code)
def opaque(v):return isinstance(v,str) and 0<len(v)<=256 and v.strip()==v
def content_hash(v):return hashlib.sha256(json.dumps(v,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
def inspect_snapshot(s):
    require(isinstance(s,dict) and s.get('session_id')==SESSION and s.get('stored_session_id')==SESSION,'session_identity_mismatch')
    info=s.get('info')
    require(isinstance(info,dict) and info.get('title')==TITLE,'session_title_mismatch')
    require(all(k in s and isinstance(s[k],(dict,list,bool,type(None))) for k in ('running','pending','prompts','open_requests')),'busy_evidence_missing')
    require(isinstance(s.get('messages'),list),'snapshot_shape_unknown')
    return {'ok':True,'sessionId':SESSION,'title':TITLE,'busy':any(bool(s[k]) for k in ('running','pending','prompts','open_requests')),'tailHash':content_hash(s['messages']),'profileId':info.get('profile_id'),'adapter':'hermes-gateway-shared-session'}
def submission(got):
    require(isinstance(got,dict) and opaque(got.get('admission_id')),'submit_admission_missing')
    if 'ref' in got:require(isinstance(got['ref'],dict) and got['ref'].get('session_id')==SESSION,'submit_ref_mismatch')
    return {'ok':True,'submitted':True,'mutationStarted':True,'sessionId':SESSION,'admissionId':got['admission_id']}
def receipt_projection(got,aid,include_result=False):
    require(opaque(aid) and isinstance(got,dict) and got.get('admission_id')==aid,'receipt_admission_mismatch')
    ref=got.get('ref')
    require(isinstance(ref,dict) and ref.get('session_id')==SESSION and 'profile_id' in ref and (ref['profile_id'] is None or opaque(ref['profile_id'])),'receipt_ref_mismatch')
    require(got.get('status') in ('queued','started','unknown','terminal'),'receipt_status_unknown')
    projected={'admission_id':aid,'ref':{'profile_id':ref['profile_id'],'session_id':ref['session_id']},'status':got['status'],'outcome':got.get('outcome')}
    for k in ('sequence','authority_epoch','execution_generation'):
        if k in got:
            require((isinstance(got[k],int) and not isinstance(got[k],bool) and got[k]>=0) or (k=='authority_epoch' and opaque(got[k])),'receipt_metadata_invalid')
            projected[k]=got[k]
    base={'ok':True,'sessionId':SESSION,'admissionId':aid,'status':got['status'],'outcome':got.get('outcome'),'completed':False}
    if got['status']!='terminal':return base
    require(got.get('outcome')=='completed','receipt_terminal_not_completed')
    if not include_result:return base
    result=got.get('result')
    require(isinstance(result,dict),'receipt_result_missing')
    require(not result.get('_compressed') and not result.get('truncated') and not result.get('isTruncated'),'receipt_result_compressed_or_truncated')
    text=result.get('final_response')
    require(isinstance(text,str) and text.strip() and len(text)<=30000,'receipt_final_response_unsupported')
    projected['result']={'final_response':text}
    return {**base,'completed':True,'finalResponse':text,'receiptProjection':projected}