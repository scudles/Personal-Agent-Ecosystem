import {mkdirSync,existsSync,writeFileSync,readFileSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {EngineeringContext} from '../engineering/context.mjs';

// Independent successor to open-ux-workbench.mjs. Existing candidate data and
// launchers are deliberately never opened, reset, stopped or reconfigured here.
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),folder=join(root,'data','collab-002-preview');
const databaseFile='collab-002-preview.sqlite',databasePath=join(folder,databaseFile),cfgPath=join(folder,'workbench-config.json'),statePath=join(folder,'preview-demo.json'),lockPath=join(folder,'preview-setup.lock');
const exe=join(root,'runtime','native','TriReviewBridge.UX.Collab.exe'),owner={id:'local-owner',kind:'user'},port=48736;
const readJson=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const options=new Set(process.argv.slice(2));for(const option of options)requireThat(['--prepare-only','--backend-only'].includes(option),'Unknown launcher option: '+option);
mkdirSync(folder,{recursive:true});

if(!existsSync(statePath)){
  const lock=openSync(lockPath,'wx');
  try{
    requireThat(!existsSync(databasePath),'Candidate database exists without completed setup; retain this isolated folder for inspection. No database was reset.');
    if(!existsSync(cfgPath))writeFileSync(cfgPath,JSON.stringify({port,token:randomBytes(32).toString('hex'),mode:'SIMULATION_ONLY',databaseFile,engineeringEnabled:true},null,2),{flag:'wx'});
    const cfg=readJson(cfgPath);requireThat(cfg.port===port&&cfg.databaseFile===databaseFile&&cfg.mode==='SIMULATION_ONLY'&&cfg.engineeringEnabled===true,'Candidate config differs from its isolated launcher contract; no activation performed.');
    const source=join(folder,'sources','fictional-colors');mkdirSync(source,{recursive:true});
    for(const [file,body] of [['colors.js','export const colors = ["blue", "green", "red"];\n'],['README.md','# 虚构颜色工程\n\n仅供新版离线文字协作与材料交换验证，不含任何真实项目数据。\n']])writeFileSync(join(source,file),body,{flag:'wx'});
    const e=new EngineeringContext(databasePath,{storePath:join(folder,'engineering-store'),allowedSourceRoots:[join(folder,'sources')]});
    try{
      requireThat(e.db.prepare("SELECT count(*) n FROM native_sessions WHERE kind<>'simulated'").get().n===0,'Original binding found; candidate activation forbidden.');
      // Initial activation is confined to the brand-new fictional database.
      // In particular, reopening a completed preview never reaches this branch.
      e.core.control({paused:false,reason:'first activation of new fictitious COLLAB-002 preview only'});
      const project=e.core.project('虚构新版演示｜离线协作'),workspace=e.core.workspace(project.id,'材料讨论'),textWorkspace=e.core.workspace(project.id,'文字协作');
      const ctx={projectId:project.id,workspaceId:workspace.id};
      for(const ws of [workspace,textWorkspace]){
        const scope={projectId:project.id,workspaceId:ws.id};for(const role of ['hermes','deepseek','chatgpt'])e.core.bindSimulation(scope,role,'虚构 '+role+'（不连接真实会话）');e.core.configure(scope,{recipients:['hermes'],paused:false});
      }
      const task=e.core.textTask(ctx,{title:'虚构颜色模块材料',body:'阅读版本化虚构颜色材料；只进行离线文字协作，不执行源代码、不操作真实项目。',executor:'hermes'});
      const sourceRecord=e.registerSource(owner,ctx,{path:source,repositoryType:'directory'}),snapshot=e.snapshot(owner,ctx,sourceRecord.id),pkg=e.createPackage(owner,ctx,{taskId:task.id,snapshotId:snapshot.id,objective:'核对虚构颜色数组和文档是否一致。',acceptanceCriteria:['文件完整性校验通过','保留独立意见，不执行源代码']});
      writeFileSync(statePath,JSON.stringify({...ctx,textWorkspaceId:textWorkspace.id,taskId:task.id,sourceId:sourceRecord.id,snapshotId:snapshot.id,package:pkg,simulationOnly:true,realNativeOperations:0,createdAt:new Date().toISOString()},null,2),{flag:'wx'});
    }finally{e.close();}
  }finally{closeSync(lock);unlinkSync(lockPath);}
}

requireThat(!existsSync(lockPath),'Preview setup is still in progress or requires inspection; no second bootstrap was attempted.');
const cfg=readJson(cfgPath),demo=readJson(statePath);
requireThat(cfg.port===port&&cfg.databaseFile===databaseFile&&cfg.mode==='SIMULATION_ONLY'&&cfg.engineeringEnabled===true&&typeof cfg.token==='string'&&cfg.token.length>=32,'Unexpected candidate config; original launchers and services were not touched.');
requireThat(demo.simulationOnly===true&&demo.realNativeOperations===0&&typeof demo.projectId==='string'&&typeof demo.workspaceId==='string','Candidate setup state is invalid.');
requireThat(existsSync(databasePath),'Completed preview database is missing; it will not be recreated or reset.');
// Read-only reopening: preserve global, role, workspace and binding pauses,
// even if their reason happens to equal an old bootstrap default.
const db=new DatabaseSync(databasePath,{readOnly:true});let paused;
try{
  requireThat(db.prepare("SELECT count(*) n FROM native_sessions WHERE kind<>'simulated'").get().n===0,'Original binding found; this preview cannot start.');
  requireThat(!!db.prepare('SELECT 1 FROM workspaces WHERE id=? AND project_id=?').get(demo.workspaceId,demo.projectId),'Candidate workspace does not match its project.');
  paused=JSON.parse(db.prepare("SELECT json FROM records WHERE kind='control' AND id='global'").get().json).paused===true;
}finally{db.close();}

if(options.has('--prepare-only')){
  console.log(JSON.stringify({folder,config:cfgPath,database:databasePath,port,projectId:demo.projectId,workspaceId:demo.workspaceId,textWorkspaceId:demo.textWorkspaceId,globalPaused:paused,simulationOnly:true,realAgentOperations:0,backendStarted:false,uiStarted:false},null,2));
}else{
  if(!options.has('--backend-only'))requireThat(existsSync(exe),'Build runtime/native/TriReviewBridge.UX.Collab.exe before opening this candidate.');
  async function healthy(){try{const response=await fetch('http://127.0.0.1:'+port+'/health',{headers:{Authorization:'Bearer '+cfg.token},signal:AbortSignal.timeout(1500)}),body=await response.json();return response.ok&&body.ready&&body.mode==='SIMULATION_ONLY'&&body.realAdaptersAuthorized===false;}catch{return false;}}
  if(!await healthy()){
    const out=openSync(join(folder,'backend.stdout.log'),'a'),err=openSync(join(folder,'backend.stderr.log'),'a');let backend;
    try{backend=spawn(join(root,'runtime','node.exe'),[join(root,'src','workbench-server.mjs')],{cwd:root,windowsHide:true,detached:true,env:{...process.env,TRB_WORKBENCH_DATA_DIR:folder},stdio:['ignore',out,err]});}finally{closeSync(out);closeSync(err);}
    let startupError;backend.once('error',error=>{startupError=error;});backend.unref();let ready=false;
    for(let n=0;n<80;n++){await new Promise(r=>setTimeout(r,200));if(startupError)throw startupError;if(backend.exitCode!==null)throw Error('New candidate backend exited; inspect its isolated logs. No existing service was stopped.');if(await healthy()){ready=true;break;}}
    requireThat(ready,'New candidate backend did not become ready on port 48736; no other service was stopped or reconfigured.');
  }
  if(!options.has('--backend-only')){const ui=spawn(exe,['--config',cfgPath,'--project-id',demo.projectId,'--workspace-id',demo.workspaceId],{cwd:root,detached:true,windowsHide:false,stdio:'ignore'});ui.on('error',error=>{console.error(error.message);process.exitCode=1;});ui.unref();}
  console.log('COLLAB-002 isolated candidate ready on 127.0.0.1:48736. Existing pauses remain unchanged; no real Agent session was accessed.');
}
