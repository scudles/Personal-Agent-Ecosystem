import unittest,importlib.util,pathlib,copy,asyncio,subprocess,sys
p=pathlib.Path(__file__).with_name('hermes_contract.py');spec=importlib.util.spec_from_file_location('contract',p);c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
def snap():return {'session_id':c.SESSION,'stored_session_id':c.SESSION,'info':{'title':'Nagi','profile_id':None},'running':False,'pending':[],'prompts':[],'open_requests':[],'messages':[{'role':'user','content':'虚构历史'}]}
def receipt():return {'admission_id':'fictional-admission','ref':{'profile_id':None,'session_id':c.SESSION},'status':'terminal','outcome':'completed','sequence':3,'result':{'final_response':'虚构果园15颗。🟢','messages':[{'role':'tool','content':'never export'}]}}
class ContractTests(unittest.TestCase):
    def test_inspect_projection_no_transcript(self):
        o=c.inspect_snapshot(snap());self.assertEqual(o['sessionId'],c.SESSION);self.assertNotIn('messages',o);self.assertFalse(o['busy']);self.assertEqual(len(o['tailHash']),64)
    def test_identity_and_incomplete_busy_rejected(self):
        for field in ('session_id','stored_session_id','running','pending','open_requests'):
            v=snap();v.pop(field)
            with self.assertRaises(ValueError):c.inspect_snapshot(v)
        v=snap();v['info']['title']='Wrong'
        with self.assertRaises(ValueError):c.inspect_snapshot(v)
    def test_busy_is_not_assumed_false(self):
        for field in ('running','pending','prompts','open_requests'):
            v=snap();v[field]=[{'fictional':'busy'}];self.assertTrue(c.inspect_snapshot(v)['busy'])
    def test_submission_needs_real_admission(self):
        self.assertEqual(c.submission({'admission_id':'own'})['admissionId'],'own')
        for v in ({},{'admission_id':''},{'admission_id':'own','ref':{'session_id':'wrong'}}):
            with self.assertRaises(ValueError):c.submission(v)
    def test_metadata_only_never_exports_result(self):
        o=c.receipt_projection(receipt(),'fictional-admission');self.assertFalse(o['completed']);self.assertNotIn('finalResponse',o);self.assertNotIn('receiptProjection',o)
    def test_completed_projection_only_own_final(self):
        o=c.receipt_projection(receipt(),'fictional-admission',True);self.assertTrue(o['completed']);self.assertEqual(o['finalResponse'],'虚构果园15颗。🟢');self.assertEqual(set(o['receiptProjection']['result']),{'final_response'});self.assertNotIn('messages',str(o));self.assertNotIn('never export',str(o))
    def test_nonterminal_never_exports_final(self):
        for status in ('queued','started','unknown'):
            v=receipt();v['status']=status;o=c.receipt_projection(v,'fictional-admission',True);self.assertFalse(o['completed']);self.assertNotIn('receiptProjection',o)
    def test_wrong_admission_ref_and_unfinished_rejected(self):
        for patch in ({'admission_id':'other'},{'ref':{'profile_id':None,'session_id':'other'}},{'status':'terminal','outcome':'failed'},{'outcome':'interrupted'},{'ref':{'session_id':c.SESSION}}):
            v=receipt();v.update(patch)
            with self.assertRaises(ValueError):c.receipt_projection(v,'fictional-admission',True)
    def test_unknown_compressed_truncated_empty_and_oversize_rejected(self):
        for patch in ({'_compressed':True},{'truncated':True},{'isTruncated':True},{'final_response':''},{'final_response':'x'*30001}):
            v=receipt();v['result'].update(patch)
            with self.assertRaises(ValueError):c.receipt_projection(v,'fictional-admission',True)
    def test_no_heuristic_text_or_messages_fallback(self):
        v=receipt();v['result']={'messages':[{'role':'assistant','content':'do not guess'}]}
        with self.assertRaises(ValueError):c.receipt_projection(v,'fictional-admission',True)
    def test_metadata_types_preserved_not_fabricated(self):
        v=receipt();v['sequence']=True
        with self.assertRaises(ValueError):c.receipt_projection(v,'fictional-admission',True)
class PolicyGateTests(unittest.TestCase):
    def test_helper_imported_run_defaults_locked_before_sdk_import(self):
        helper=pathlib.Path(__file__).with_name('hermes-gateway.py');spec=importlib.util.spec_from_file_location('candidate_helper',helper);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        with self.assertRaisesRegex(ValueError,'native_policy_refresh_not_authorized'):asyncio.run(m.run({'operation':'inspect'}))
    def test_helper_cli_generic_ack_alone_refused_before_sdk_import(self):
        helper=pathlib.Path(__file__).with_name('hermes-gateway.py');r=subprocess.run([sys.executable,'-B',str(helper),'--ack-native-session-access'],input='{"operation":"inspect"}',encoding='utf8',capture_output=True)
        self.assertEqual(r.returncode,2);self.assertIn('native_gateway_unavailable_or_invalid',r.stdout);self.assertNotIn('sessionId',r.stdout)
if __name__=='__main__':unittest.main(verbosity=2)