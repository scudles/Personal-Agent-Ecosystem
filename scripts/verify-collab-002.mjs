import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {canonical,noLinks} from '../engineering/safety.mjs';
import {createHash} from 'node:crypto';
import {GovernanceGuard} from '../governance/guard.mjs';
import {PINNED} from '../src/workflow.mjs';
import {verifyLegacy} from './migrate-workbench.mjs';
import {verifyReport} from './verify-collab-002-soak.mjs';
const json=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,'')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const dir='evidence/offline-collab-002',baseline=json('data/offline-completion-baseline.json');
for(const file of ['data/workbench-config.json','runtime/native/TriReviewBridge.exe','desktop/MainWindow.xaml'])assert.equal(sha(file),sha(join(baseline.backup,file)),'protected main asset changed: '+file);
const protectedFiles=json('evidence/workbench-release-migration.json').protectedFiles;
for(const f of protectedFiles){assert(resolve(f.path).startsWith(resolve('.')+'\\'));assert.equal(sha(f.path),f.sha256,'protected file changed: '+f.path);}
const cfg=json('data/workbench-config.json'),db=new DatabaseSync(join('data',cfg.databaseFile),{readOnly:true});let bindings,archive;
try{
 assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE type='table' AND name LIKE 'uec_%'").get().n,0);
 assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 bindings=db.prepare("SELECT b.paused,n.agent_id,n.external_id FROM bindings b JOIN native_sessions n ON n.id=b.native_session_id WHERE n.kind='legacy_real'").all();assert.equal(bindings.length,3);
 for(const b of bindings){assert.equal(b.paused,1);assert.equal(b.external_id,PINNED[b.agent_id].id);}
 const source=new DatabaseSync('data/workflow.sqlite',{readOnly:true}),phase1=new DatabaseSync('data/bridge.sqlite',{readOnly:true});try{archive=verifyLegacy({db},source,phase1);}finally{source.close();phase1.close();}
}finally{db.close();}
assert.equal(new GovernanceGuard(resolve('governance')).load().policy.version,'MAG-001');
const native=json(dir+'/native-integration.json');assert(native.proof.passed&&native.proof.ux.passed&&native.proof.collaboration.passed&&native.proof.draftRestoredAfterRestart&&native.backendSurvivedWindowClose);assert.equal(native.proof.webViewLoaded,false);
for(const[f,h]of Object.entries(native.sourceHashes))assert.equal(sha(f),h,'native proof stale: '+f);assert.equal(sha('runtime/native/TriReviewBridge.UX.Collab.exe'),native.binaryHash);
const log=readFileSync(dir+'/all-tests.txt','utf8'),tests=Number(log.match(/tests ([0-9]+)\r?$/m)?.[1]),passed=Number(log.match(/pass ([0-9]+)\r?$/m)?.[1]);assert(tests>=183&&passed===tests&&/fail 0/.test(log),'regression incomplete');
const pkg=json(dir+'/review-package.json'),manifest=json(join(pkg.exportPath,'manifest.json'));assert.equal(sha(join(pkg.exportPath,'manifest.json')),pkg.manifestHash);assert.equal(manifest.package_hash,pkg.packageHash);assert.equal(createHash('sha256').update(canonical(manifest.core)).digest('hex'),pkg.packageHash);
for(const f of manifest.core.included_files)assert.equal(sha(noLinks(join(pkg.exportPath,f.path),pkg.exportPath)),f.sha256,'sealed review bytes changed');
const mapping=json(join(pkg.exportPath,'documentation/ORIGINAL_SOURCE_MAPPING.json'));for(const[f,h]of Object.entries(mapping.files)){assert.equal(sha(f),h,'review source stale: '+f);const repr=mapping.fileRepresentations?.[f];if(repr)assert.equal(sha(join(pkg.exportPath,repr)),h);}
const review=existsSync(dir+'/independent-review.json')?json(dir+'/independent-review.json'):null;const reviewed=review?.independentInstance===true&&review.reviewedPackageManifestHash===pkg.manifestHash&&review.unresolvedBlockingFindings===0;
if(process.argv.includes('--require-review'))assert(reviewed,'independent review not completed');
const pointer=existsSync(dir+'/soak-current.json')?json(dir+'/soak-current.json'):null;const soak=pointer?verifyReport(pointer.report,{requireAcceptance:true}):null;
if(process.argv.includes('--require-soak'))assert(soak?.acceptance,'current candidate one-hour test not accepted');
const report={at:new Date().toISOString(),taskId:'TRB-OFFLINE-COLLAB-002',owner:'Codex /root',status:reviewed&&soak?.acceptance?'OFFLINE_CANDIDATE_VERIFIED':'IN_PROGRESS',tests:{total:tests,passed,failed:0,adapterKind:'SIMULATED_ONLY'},native:{wpf:true,webView:false,actualProcessRun:true,collaboration:native.proof.collaboration,theme:native.proof.theme,viewports:native.proof.ux.viewportPreviews},independentReview:review,reviewArtifact:pkg,oneHour:soak,mainConfigAndOldDesktopUnchanged:true,mainDatabaseNotMigrated:true,originalArchive:archive,originalBindingsUnchangedAndPaused:bindings.length,protectedFilesUnchanged:protectedFiles.length,governanceVersion:'MAG-001',testExecutionScope:'ISOLATED_OFFLINE_CANDIDATE_ONLY',realAgentOperations:0,separateRealMaterialCanary:'evidence/real-material-canary-001 (not part of offline test counts)',humanFirstUseObserved:false,physicalDpi125And150Verified:false,desktopScreenshotCaptured:false,imageKind:'application-owned WPF RenderTargetBitmap preview',sourceHashes:native.sourceHashes,binaryHash:native.binaryHash,rollbackBaseline:json(dir+'/baseline.json').backup};
writeFileSync(dir+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,tests:report.tests,oneHour:soak,originalBindingsPaused:bindings.length,protectedFilesUnchanged:protectedFiles.length,mainUnchanged:true},null,2));
