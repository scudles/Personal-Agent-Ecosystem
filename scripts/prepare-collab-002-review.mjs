import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,readdirSync,lstatSync,existsSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {EngineeringContext} from '../engineering/context.mjs';
import {noLinks,sha,rejectSensitive} from '../engineering/safety.mjs';

// Preparation only, following prepare-ux-review.mjs. No adapter, scheduler,
// exchange queue, real binding, attachment upload or distribution is invoked.
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--candidate-revision'&&/^[123]$/.test(args[1])))throw Error('usage: prepare-collab-002-review.mjs [--candidate-revision 1|2|3]');
const candidateRevision=args.length?Number(args[1]):1;
const reviewRound=candidateRevision===1?1:2;
const output=join(root,'evidence/offline-collab-002'),reportPath=join(output,candidateRevision===3?'review-package-candidate3.json':candidateRevision===2?'review-package-round2.json':'review-package.json');
if(existsSync(reportPath))throw Error('review_package_report_already_exists_no_overwrite');
const owner={id:'local-owner',kind:'user'},active=JSON.parse(readFileSync(join(root,'governance/active.json'),'utf8'));
if(active.status!=='ACTIVE'||!/^MAG-\d{3}$/.test(active.version))throw Error('active_governance_version_required');
const skip=new Set(['.git','node_modules','bin','obj','__pycache__','audit','evidence','logs','data','backups','artifacts','exports','test-output']);
const privateName=/^(?:\.env(?:\.|$)|credentials?(?:\.|$)|secrets?(?:\.|$)|passwords?(?:\.|$)|tokens?(?:\.|$)|(?:local|workbench)-config\.json$)/i;
const textSource=/\.(?:mjs|cjs|js|cs|xaml|json|py|md|ps1|cmd|txt)$/i;
function walk(folder){
  if(!existsSync(join(root,folder)))return [];
  const files=[];
  for(const entry of readdirSync(noLinks(join(root,folder),root),{withFileTypes:true})){
    if(skip.has(entry.name.toLowerCase())||privateName.test(entry.name))continue;
    const path=join(folder,entry.name).replaceAll('\\','/'),stat=lstatSync(noLinks(join(root,path),root));
    if(stat.isSymbolicLink())throw Error('review_source_link_forbidden:'+path);
    if(stat.isDirectory())files.push(...walk(path));else if(stat.isFile()&&textSource.test(path))files.push(path);
  }
  return files;
}
const explicit=[
  'AGENTS.md','package.json','desktop/TriReviewBridge.csproj',
  'scripts/build-desktop.ps1','scripts/open-ux-workbench.mjs','scripts/open-ux-workbench.ps1',
  'scripts/verify-collab-002.mjs','scripts/open-collab-workbench.mjs','scripts/open-collab-workbench.ps1','打开新版协作工作台.cmd',
  'scripts/migrate-workbench.mjs','scripts/migrate-engineering-context.mjs',
  'scripts/soak-collab-002.mjs','scripts/verify-collab-002-soak.mjs',
  'scripts/prepare-ux-review.mjs','scripts/prepare-collab-002-review.mjs',
  'test/offline-collab-002-api.test.mjs','test/offline-collab-002-native.test.mjs',
  'test/collaboration-plan.test.mjs','test/collaboration-governance.test.mjs','test/collab-plan-boundaries.test.mjs',
  'test/collab-002-soak-smoke.test.mjs','test/ux-intent.test.mjs','test/ux-native.test.mjs','test/ux-theme.test.mjs',
  'test/offline-service-helper.mjs','test/collaboration-api-001.test.mjs','test/workbench.test.mjs','test/governance-host.test.mjs',
  'docs/ux-001/UI_IMPLEMENTATION_PLAN.md','docs/ux-001/UX_ACCEPTANCE_CHECKLIST.md','docs/ux-theme/DELIVERY_REPORT.md'
];
function collect(){
  const governance=readdirSync(join(root,'governance'),{withFileTypes:true}).filter(e=>e.isFile()&&/\.(?:mjs|md|json)$/i.test(e.name)).map(e=>'governance/'+e.name);
  return [...new Set([...explicit,...['src','engineering','desktop','native'].flatMap(walk),...governance,...walk('governance/versions/'+active.version),...walk('docs/offline-collab-002')])].sort();
}
const files=collect(),originHashes={},captured=new Map();
if(files.some(path=>/^scripts\/.*canary/i.test(path)))throw Error('real_canary_script_outside_review_scope');
for(const path of files){const bytes=readFileSync(noLinks(join(root,path),root));rejectSensitive(bytes);originHashes[path]=sha(bytes);captured.set(path,bytes);}
for(const path of ['src/collaboration-plan.mjs','src/collaboration-intent.mjs','src/collaboration-plans-host.mjs','src/collaboration-governance.mjs','desktop/StabilityProbe.cs','desktop/CollaborationPanel.cs'])if(!captured.has(path))throw Error('required_candidate_file_missing:'+path);
const executable='runtime/native/TriReviewBridge.UX.Collab.exe',exeBytes=readFileSync(noLinks(join(root,executable),root));
const candidateIdentity={path:executable,sha256:sha(exeBytes),size:exeBytes.length,distributed:false,binaryIncluded:false};
const unchanged=()=>{
  if(JSON.stringify(collect())!==JSON.stringify(files))throw Error('candidate_file_list_changed_while_preparing_review');
  for(const path of files)if(sha(readFileSync(noLinks(join(root,path),root)))!==originHashes[path])throw Error('candidate_changed_while_preparing_review:'+path);
  if(sha(readFileSync(join(root,executable)))!==candidateIdentity.sha256)throw Error('candidate_executable_changed_while_preparing_review');
};
unchanged();mkdirSync(output,{recursive:true});
const folder=mkdtempSync(join(output,'review-preparation-')),sourceRoot=join(folder,'captured-candidate'),store=join(folder,'sealed-store'),database=join(folder,'review.sqlite');
const projectFile='desktop/TriReviewBridge.csproj',snapshotFiles=files.filter(path=>path!==projectFile);
for(const path of snapshotFiles){const target=join(sourceRoot,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,captured.get(path),{flag:'wx'});}
const e=new EngineeringContext(database,{storePath:store,allowedSourceRoots:[sourceRoot]});
try{
  const project=e.core.project('TriReviewBridge 离线协作候选复核材料（未分发）'),ws=e.core.workspace(project.id,'TRB-OFFLINE-COLLAB-002 只读复核准备'),ctx={projectId:project.id,workspaceId:ws.id};
  e.core.bindSimulation(ctx,'hermes','仅材料归档占位；不连接真实Hermes会话');
  const task=e.core.textTask(ctx,{title:'TRB-OFFLINE-COLLAB-002 独立只读复核材料',body:'实施唯一负责人Codex /root；风险L2；必要复核为独立只读Codex实例。归档占位事项不派发Hermes，不调用任何Adapter。检查离线自然协作持久依赖、工程治理边界及新版稳定性驱动；不操作真实会话、不上传附件、不启动或修改受保护外部项目。',executor:'hermes'});
  const source=e.registerSource(owner,ctx,{path:sourceRoot,repositoryType:'directory'}),snapshot=e.snapshot(owner,ctx,source.id,{includeFiles:snapshotFiles});
  const mapping={candidateRevision,reviewRound,reviewScope:candidateRevision===3?'ROUND_2_SAME_P1_CONTINUATION':'FROZEN_CANDIDATE',originalRoot:root,derivedFrom:'scripts/prepare-ux-review.mjs',captureMethod:'explicit public text-source allowlist; copied exact bytes; complete file list and each SHA256 rechecked before and after sealing',files:originHashes,fileRepresentations:{[projectFile]:'documentation/BUILD_PROJECT.csproj.txt'},excluded:['private/local configuration','credentials','runtime databases','evidence and audit logs','binary payloads','real-material canary scripts from another task'],candidateIdentity};
  const pkg=e.createPackage(owner,ctx,{taskId:task.id,snapshotId:snapshot.id,
    objective:'TRB-OFFLINE-COLLAB-002 L2冻结候选的独立只读复核：唯一实施负责人Codex /root；独立只读Codex必要复核，0真实分发。',
    acceptanceCriteria:[
      '有界自然组合指令建立真实离线持久任务和依赖，owner有效回执后才创建独立复核，重启/重复请求无重复后续事项',
      'UNKNOWN、暂停、取消、预算、scope、版本和初始独立意见保护有效；引用及代码不扩大路由',
      '自包含新文字任务不误继承工程root；明确工程后续不能绕过既有Governance Host',
      '正式审议通过与用户决定、实施权限分开；材料修订不得保留过期批准结论',
      '旧入口及自动推进使用同一治理边界，P2/P3不误阻断；受保护治理完整性异常停止新动作',
      '新版WPF协作面板、StabilityProbe、隔离soak驱动与verifier可核对真实墙钟/Dispatcher心跳/冻结源码；短smoke不冒称一小时通过',
      '所有测试和模拟证据明确标为虚构模拟，真实Session/草稿/附件与外部工程保持零操作'
    ],documentation:[
      {name:'ORIGINAL_SOURCE_MAPPING.json',body:JSON.stringify(mapping,null,2)},
      {name:'BUILD_PROJECT.csproj.txt',body:captured.get(projectFile).toString('utf8')},
      {name:'REVIEW_BOUNDARY.md',body:'# 复核边界\n\nTask TRB-OFFLINE-COLLAB-002；L2；实施唯一负责人Codex /root；必要复核为独立只读Codex实例。仅检查本包冻结变更、必要依赖与约定验收。P0/P1阻断；P2/P3保留建议，不扩大冻结范围。原则两轮；本材料准备不代表已复核。\n\n没有调用真实Runtime、模型、会话、附件或投递；包收件者为空。包内Hermes为独立归档库的模拟占位，不是实际实现负责人或外部审查者。复核不得修改源码/治理/运行数据、启动候选或代录Agent票。\n\n本包只含源码与声明；不附带私密配置、执行日志或运行数据库。不把代码和旧版耐久冒称当前新版墙钟耐久已通过；正式新soak须另以冻结版本和runId证据核对。\n\n材料以Manifest和原始文件哈希检测变动；没有声称操作系统ACL不可篡改。\n'}
    ],taskContext:'本包来源为已授权冻结后的TriReviewBridge真实候选源码，只读复核用途；不是运行真实项目的授权。MAG-001不变，归档副本之外的原项目绑定、暂停和草稿不变。实施自测与独立复核、30秒smoke与一小时真实墙钟、模拟Adapter与真实Agent收件必须分别报告。所有路径和原始哈希见ORIGINAL_SOURCE_MAPPING.json；csproj按原字节文本映射至.txt，仅因材料类型白名单，不修改实际工程文件。',recipients:[]});
  const verification=e.verifyPackage(owner,ctx,pkg.id,pkg.version),exported=e.exportPackage(owner,ctx,pkg.id,pkg.version);
  unchanged();
  const report={candidateRevision,reviewRound,reviewScope:candidateRevision===3?'ROUND_2_SAME_P1_CONTINUATION':'FROZEN_CANDIDATE',prepared:true,distributed:false,implementationTaskId:'TRB-OFFLINE-COLLAB-002',riskLevel:'L2',implementationOwner:'Codex /root',necessaryReviewer:'Independent read-only Codex',artifactTaskId:task.id,projectId:project.id,workspaceId:ws.id,packageId:pkg.id,version:pkg.version,snapshotId:snapshot.id,manifestHash:pkg.manifestHash,packageHash:pkg.packageHash,fileCount:pkg.fileCount,sourceFileCount:files.length,sourceHashes:originHashes,candidateIdentity,exportPath:exported.path,database,capturedSourceRoot:sourceRoot,sealedStore:store,verification,recipients:[],realAgentOperations:0,realDistribution:0,reviewExecuted:false,preparedAt:new Date().toISOString()};
  writeFileSync(reportPath,JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({candidateRevision,reviewRound,reportPath,packageId:pkg.id,version:pkg.version,snapshotId:snapshot.id,manifestHash:pkg.manifestHash,packageHash:pkg.packageHash,fileCount:pkg.fileCount,sourceFileCount:files.length,exportPath:exported.path,distributed:false,realAgentOperations:0},null,2));
}finally{e.close();}
