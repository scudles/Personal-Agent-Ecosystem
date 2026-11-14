import{ManualHandover}from'./manual-handover.mjs';
import{ArtifactExchange}from'./exchange.mjs';import{EvidenceLedger}from'./ledger.mjs';import{EngineeringGovernance}from'./governance-host.mjs';
import{assert}from'./safety.mjs';
// Local owner UI only. No adapter is called and no delivery receipt is minted.
export class EngineeringDesktopApi{
 constructor(engineering){this.e=engineering;this.exchange=new ArtifactExchange(engineering);this.ledger=new EvidenceLedger(this.exchange);this.governance=new EngineeringGovernance(this.ledger);this.handovers=new ManualHandover(engineering);}
 view(principal,ctx){const e=this.e;e.access(principal,ctx,false);assert(principal.id==='local-owner','engineering_owner_required');const source=e.db.prepare("SELECT * FROM uec_sources WHERE project_id=? AND status='ACTIVE'").get(ctx.projectId);return{enabled:true,mode:'OFFLINE_MATERIALS_ONLY',exchangeAttempts:this.exchange.list(principal,ctx),reviewEvidence:this.ledger.list(principal,ctx),governance:this.governance.view(principal,ctx),source:source?{id:source.id,root:source.root,type:source.repository_type,identity:source.identity,lastSnapshotId:source.last_snapshot_id}:null,allowedSourceRoots:e.allowedRoots,snapshots:e.db.prepare('SELECT id,source_id,manifest_hash,created_at FROM uec_snapshots WHERE project_id=? ORDER BY created_at DESC').all(ctx.projectId),packages:e.listPackages(principal,ctx).map(p=>{const row=e.getPackage(principal,ctx,p.id,p.version);return{...p,fileCount:row.parsedManifest.core.file_count,createdAt:row.created_at};}),tasks:e.core.list('case').filter(t=>!t.legacy&&t.scope==='text_only_task'&&e.db.prepare("SELECT 1 FROM entity_scope WHERE kind='case' AND id=? AND project_id=? AND workspace_id=?").get(t.id,ctx.projectId,ctx.workspaceId)).map(t=>({id:t.id,title:t.title,ownerId:t.assignee})),manualHandovers:this.handovers.list(principal,ctx),agentReceived:false};}
 perform(principal,ctx,action,b,key){const e=this.e;e.access(principal,ctx);// Deliberately map every property: requests cannot change trusted path policy or hooks.
 switch(action){
 case'materials-queue':return this.exchange.queue(principal,ctx,{packageId:b.packageId,version:Number(b.version),recipients:b.recipients,requestKey:key});
 case'materials-receive':return this.exchange.receive(principal,ctx,b.attemptId,{mode:b.mode||'normal'});
 case'materials-reconcile':return this.exchange.reconcile(principal,ctx,b.attemptId);
 case'materials-cancel':return this.exchange.cancel(principal,ctx,b.attemptId);
 case'materials-review-evidence':return this.ledger.record(principal,ctx,{packageId:b.packageId,version:Number(b.version),authorId:b.authorId,attemptId:b.attemptId,body:b.body,verdict:b.verdict,references:b.references,relatedIssueIds:b.relatedIssueIds,verificationOutcome:b.verificationOutcome,requestKey:key});
 case'materials-governance-register':return this.governance.register(principal,ctx,{taskId:b.taskId,definition:b.definition});
 case'materials-governance-review':return this.governance.startReview(principal,ctx,b);
 case'materials-governance-issue':return this.governance.issue(principal,ctx,b);
 case'materials-governance-assess':return this.governance.assess(principal,ctx,b);
 case'materials-mock-self-test':return this.governance.mockSelfTest(principal,ctx,b);
 case'materials-handover-prepare':return this.handovers.prepare(principal,ctx,{packageId:b.packageId,version:Number(b.version),role:b.role});
 case'materials-handover-report':return this.handovers.report(principal,ctx,{id:b.handoverId,state:b.state,note:b.note});
 case'materials-source-retire':return this.e.retireSource(principal,ctx,b.sourceId,b.reason);
 case'materials-snapshot-details':return this.e.getSnapshot(principal,ctx,b.snapshotId);
 case'materials-file-list':{const p=this.e.getPackage(principal,ctx,b.packageId,Number(b.version));return{files:p.parsedManifest.core.included_files};}
 case'materials-source':return e.registerSource(principal,ctx,{path:b.path,repositoryType:b.repositoryType,privatePaths:b.privatePaths||[],requestKey:key});
 case'materials-snapshot':return e.snapshot(principal,ctx,b.sourceId,{includeFiles:b.includeFiles,requestKey:key});
 case'materials-package':{const task=e.core.owned(ctx,'case',b.taskId);assert(task.scope==='text_only_task','engineering_text_task_required');return e.createPackage(principal,ctx,{taskId:b.taskId,snapshotId:b.snapshotId,packageId:b.packageId,objective:b.objective,acceptanceCriteria:b.acceptanceCriteria,taskContext:b.taskContext,recipients:[],requestKey:key});}
 case'materials-verify':return e.verifyPackage(principal,ctx,b.packageId,Number(b.version));
 case'materials-view':return{packageId:b.packageId,version:Number(b.version),body:e.readPackageFile(principal,ctx,b.packageId,Number(b.version),'REVIEW_BUNDLE.txt').toString('utf8'),agentReceived:false};
 case'materials-export':{const result=e.exportPackage(principal,ctx,b.packageId,Number(b.version));e.core.log('uec.export_prepared_not_delivered',{...ctx,packageId:b.packageId,version:Number(b.version),exportId:result.exportId,manifestHash:result.manifestHash,agentReceived:false});return result;}
 default:throw Error('unknown_materials_action');
 }
 }
}