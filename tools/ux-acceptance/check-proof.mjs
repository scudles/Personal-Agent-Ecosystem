import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {fixedRoot,checkedPath,boundedRead,checkOutput,exclusiveWrite,pngHeader} from '../safe-local-files.mjs';

const root=fixedRoot;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const safeRelative=path=>typeof path==='string'&&!isAbsolute(path)&&!path.split(/[\\/]/).some(x=>x==='..'||x==='');
export const requiredViewports=[[1440,900],[1366,768],[980,660],[1920,1080]];

export function inspectNativeProof(bundle,{artifactInfo,sourceHash,binaryHash}={}){
  const proof=bundle?.proof,ux=proof?.ux,checks=[];
  const check=(id,passed,detail)=>checks.push({id,passed:passed===true,detail,evidenceKind:'IMPORTED_NATIVE_PROOF_ASSERTION'});
  check('native-window',proof?.windowType==='System.Windows.Window'&&proof.webViewLoaded===false,'原生Window，未加载WebView。');
  check('simulation-boundary',bundle?.realAdaptersUsed===0&&proof?.realAdaptersAccessed===false&&ux?.realAgentOperations===0,'只核对模拟原生证据，不证明真实Agent在线。');
  check('three-columns',ux?.threeColumns===true&&ux.collapsibleContext===true,'三栏与上下文折叠的已记录断言。');
  for(const [field,detail] of [
    ['ordinaryChatOriginalText','普通聊天正文保留原文。'],['praiseNotApproval','普通赞同未成为审批。'],
    ['unsupportedDraftPreserved','不支持动作后草稿保留。'],['unknownVisibleWhenContextCollapsed','上下文折叠时UNKNOWN仍可发现。'],
    ['bindingPauseVisibleWhenCollapsed','上下文折叠时绑定暂停仍可发现。'],['unselectedMaterialUnknownVisible','未选中材料的未知状态不被隐藏。'],
    ['pendingRefreshUserContextPreserved','等待刷新时用户选择得到保留。'],['hiddenContextDoesNotPolluteIntent','隐藏上下文不污染意图。']
  ])check(field,ux?.[field]===true,detail);
  check('no-execution-authorization',proof?.collaboration?.executionAuthorized===false&&proof?.governance?.executionAuthorized===false,'任务/审查通过没有生成实施授权。');
  check('draft-and-receivers',proof?.workspaceReceiverRestore===true&&proof.workspaceDraftIsolation===true&&proof.draftRestoredAfterRestart===true,'原生证据记录接收者与草稿隔离、重启恢复。');
  const records=Array.isArray(ux?.viewportPreviews)?ux.viewportPreviews:[],seen=new Set();
  const viewports=records.map(v=>{
    const key=v.width+'x'+v.height,duplicate=seen.has(key);seen.add(key);
    const bounds=Number.isFinite(v.width)&&Number.isFinite(v.height)&&v.sendVisible===true&&Number.isFinite(v.composerHeight)&&v.composerHeight>=40&&Number.isFinite(v.messageHeight)&&v.messageHeight>0;
    check('viewport:'+key,!duplicate&&bounds,'已有视口记录的Send可见、输入区至少40逻辑单位、正文区为正；不等于实际点击或文本可读性观察。');
    let image={checked:false};
    if(artifactInfo){try{image={checked:true,...artifactInfo(v.image)};}catch(error){image={checked:true,valid:false,error:error.message};}
      check('preview-file:'+key,image.valid===true,'仅核对本机已有PNG文件及尺寸，未控制窗口。');
      if(image.valid&&Number.isFinite(v.deviceScaleX)&&Number.isFinite(v.deviceScaleY))check('preview-size:'+key,image.width===Math.round(v.width*v.deviceScaleX)&&image.height===Math.round(v.height*v.deviceScaleY),'像素尺寸与记录比例对应；仍非物理DPI验收。');
    }
    return {width:v.width,height:v.height,sendVisible:v.sendVisible,composerHeight:v.composerHeight,messageHeight:v.messageHeight,recordedDeviceScaleX:v.deviceScaleX,recordedDeviceScaleY:v.deviceScaleY,method:v.method,image};
  });
  check('four-required-viewports',records.length===requiredViewports.length&&requiredViewports.every(([w,h])=>seen.has(w+'x'+h)),'恰好覆盖四个约定逻辑视口，重复记录不能补覆盖。');
  const sources=bundle?.sourceHashes;
  check('source-manifest-present',!!sources&&typeof sources==='object'&&!Array.isArray(sources)&&Object.keys(sources).length>0,'原生proof须附来源哈希。');
  if(sourceHash&&sources&&typeof sources==='object')for(const [path,expected] of Object.entries(sources)){
    let valid=false;try{valid=safeRelative(path)&&/^[a-f0-9]{64}$/.test(expected)&&sourceHash(path)===expected;}catch{}
    check('source:'+path,valid,'当前文件与该原生proof的记录哈希一致。');
  }
  if(binaryHash)check('candidate-binary',/^[a-f0-9]{64}$/.test(bundle?.binaryHash||'')&&binaryHash===bundle.binaryHash,'当前候选二进制与记录哈希一致。');
  const failures=checks.filter(c=>!c.passed);
  return {format:'TRB_UX_PROOF_CHECK_V1',checkedAt:new Date().toISOString(),verdict:failures.length?'PROOF_CHECK_FAILED':'RECORDED_NATIVE_ASSERTIONS_CHECKED',checks,failures:failures.map(c=>c.id),viewports,
    actuallyPerformed:{importedProofChecks:true,currentSourceHashCheck:Boolean(sourceHash),currentBinaryHashCheck:Boolean(binaryHash),newWindowRun:false,newScreenshot:false,systemDisplayChange:false},
    needsHuman:[{id:'first-use',status:'NOT_TESTED',reason:'须由真正首次使用者实际操作，开发者proof不能替代。'},{id:'physical-dpi-125',status:'NOT_TESTED',reason:'逻辑视口、PNG尺寸或deviceScale字段不证明实际Windows125%DPI检查。'},{id:'physical-dpi-150',status:'NOT_TESTED',reason:'没有实际设备、显示设置与观察证据。'},{id:'readability-and-keyboard',status:'NEEDS_HUMAN',reason:'现有布尔/区域记录不能证明长文本可读、键盘体验或控件真实点击命中。'}],
    acceptancePassed:false,realAgentOperations:0,limitations:['来源是既有原生自检记录；本工具未重新执行UI或独立重放动作。','本工具不是一小时耐久或真实Adapter验收。']};
}

function pngInfo(path){
  const bytes=boundedRead(path,16*1024*1024),header=pngHeader(bytes);
  return {valid:true,...header,sha256:hash(bytes)};
}
export function main(args=process.argv.slice(2)){
  const options={};for(let n=0;n<args.length;n+=2){if(!['--proof','--out'].includes(args[n])||!args[n+1]||options[args[n]])throw Error('usage: --proof <native-integration.json> --out <new evidence path>');options[args[n]]=args[n+1];}
  if(!options['--proof'])throw Error('explicit_proof_path_required');
  const input=checkedPath(options['--proof'],{mustExist:true}),output=resolve(options['--out']||join(root,'evidence/ux-acceptance-tools-001/ux-proof-check.json'));
  const outputOptions={allowedBases:[join(root,'evidence/ux-acceptance-tools-001'),join(root,'test-output')],inputs:[input]};checkOutput(output,outputOptions);
  const bytes=boundedRead(input,4*1024*1024),bundle=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')),binary=join(root,'runtime/native/TriReviewBridge.UX.Collab.exe');
  const report=inspectNativeProof(bundle,{artifactInfo:pngInfo,sourceHash:path=>hash(boundedRead(join(root,path),4*1024*1024)),binaryHash:hash(boundedRead(binary,64*1024*1024))});
  report.input={path:input,sha256:hash(bytes)};exclusiveWrite(output,JSON.stringify(report,null,2),outputOptions);
  console.log(JSON.stringify({output,verdict:report.verdict,checks:report.checks.length,failed:report.failures.length,needsHuman:report.needsHuman.map(x=>x.id)},null,2));
  return report.failures.length?1:0;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=main();}catch(error){console.error(error.message);process.exitCode=1;}}
