import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const MODULE_DIR=path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR=path.resolve('D:/TriReviewBridge/test-output/real-material-canary-001-2026-11-12T11-57-07-046Z-d63d404e/package');
const FIXTURE_DIR=path.join(MODULE_DIR,'fixtures');
const ID='d63d404e-1861-4aec-ab1f-277c63b3ecff',VERSION=1,SNAPSHOT='1f7a3f49-8190-4650-a586-ff4706e17b8d';
const MANIFEST_HASH='509a8e93d122b5ea596ee547dc8a7dccb8445f02e330aa9aa65e2318f29cbf7c';
const PACKAGE_HASH='2fb8f259ac0c986b77b90c8fe7f9aa3c647e716c18168bd1b643ac7ea28206d8';
const FILES=Object.freeze([
  Object.freeze({path:'README.txt',sizeBytes:174,sha256:'87a757e5019fd9e6b7b0f9f2fe1fa0b0f0544e8086deab7b7c49bbe1e907d889'}),
  Object.freeze({path:'manifest.json',sizeBytes:755,sha256:MANIFEST_HASH}),
  Object.freeze({path:'manifest.sha256',sizeBytes:80,sha256:'1025b22e098049e2b86adec6049f9c1a9fb76c8b056b6ff61b00cb19ba8169de'}),
  Object.freeze({path:'notes.txt',sizeBytes:160,sha256:'93ba3bee995344faef94906ce9a8dab8b312d020605d8cbe66c6c3e1897f9bc8'}),
  Object.freeze({path:'orchard.json',sizeBytes:281,sha256:'b9d3a2d7f5779246dc286d13e380e953c6649bdae85f7a6ad118de7d9e877528'})
]);
const PAYLOADS=FILES.filter(f=>!f.path.startsWith('manifest.'));
const MAX_FILE_BYTES=16384;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const comparable=p=>process.platform==='win32'?path.resolve(p).toLowerCase():path.resolve(p);
class Refusal extends Error {constructor(code,file=null){super(code);this.code=code;this.file=file;}}
function requireThat(ok,code,file){if(!ok)throw new Refusal(code,file);}
function optionsNonce(options){
  requireThat(options&&typeof options==='object'&&!Array.isArray(options),'INVALID_OPTIONS');
  requireThat(Object.keys(options).every(k=>k==='nonce'),'UNSUPPORTED_OPTION');
  const nonce=options.nonce??null;
  requireThat(nonce===null||typeof nonce==='string'&&/^[A-Za-z0-9._:-]{1,128}$/.test(nonce),'INVALID_NONCE');
  return nonce;
}
function statIdentity(s){return[s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');}
function sameObject(a,b){return a.dev===b.dev&&a.ino===b.ino&&a.mode===b.mode;}
function checkedStat(file,kind){
  let stat;try{stat=fs.lstatSync(file,{bigint:true});}catch(error){throw new Refusal(error.code==='ENOENT'?'MISSING_PATH':'PATH_INSPECTION_FAILED',path.basename(file));}
  requireThat(!stat.isSymbolicLink(),'LINK_OR_JUNCTION_REFUSED',path.basename(file));
  requireThat(kind==='directory'?stat.isDirectory():stat.isFile(),'UNEXPECTED_FILE_TYPE',path.basename(file));
  if(kind==='file')requireThat(stat.nlink===1n,'HARD_LINK_REFUSED',path.basename(file));
  let actual;try{actual=fs.realpathSync.native(file);}catch{throw new Refusal('REALPATH_FAILED',path.basename(file));}
  requireThat(comparable(actual)===comparable(file),'RESOLVED_PATH_MISMATCH',path.basename(file));
  return stat;
}
function checkedAncestors(directory){
  const absolute=path.resolve(directory),volume=path.parse(absolute).root;
  let current=volume;checkedStat(current,'directory');
  for(const part of path.relative(volume,absolute).split(path.sep).filter(Boolean)){current=path.join(current,part);checkedStat(current,'directory');}
}
function checkedInventory(directory){
  checkedAncestors(directory);
  let names;try{names=fs.readdirSync(directory);}catch{throw new Refusal('DIRECTORY_READ_FAILED');}
  requireThat(canonical(names.sort())===canonical(FILES.map(f=>f.path).sort()),'FILE_SET_MISMATCH');
  for(const file of FILES)checkedStat(path.join(directory,file.path),'file');
}
function readStable(directory,name){
  const file=path.join(directory,name),before=checkedStat(file,'file');
  requireThat(before.size<=BigInt(MAX_FILE_BYTES),'FILE_TOO_LARGE',name);
  let fd;
  try{
    fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0)|(fs.constants.O_NONBLOCK||0));
    const opened=fs.fstatSync(fd,{bigint:true});
    requireThat(opened.isFile()&&opened.nlink===1n&&statIdentity(opened)===statIdentity(before),'FILE_CHANGED_BEFORE_READ',name);
    // A writer can grow a previously small file after fstat. Never hand an
    // unbounded descriptor read to readFileSync: read at most the cap plus one.
    const buffer=Buffer.alloc(MAX_FILE_BYTES+1);let length=0;
    while(length<buffer.length){const read=fs.readSync(fd,buffer,length,buffer.length-length,length);if(read===0)break;length+=read;}
    requireThat(length<=MAX_FILE_BYTES,'FILE_TOO_LARGE',name);const bytes=buffer.subarray(0,length);
    const after=fs.fstatSync(fd,{bigint:true}),named=checkedStat(file,'file');
    requireThat(statIdentity(opened)===statIdentity(after)&&statIdentity(after)===statIdentity(named)&&sameObject(opened,named),'FILE_CHANGED_DURING_READ',name);
    requireThat(BigInt(bytes.length)===opened.size,'FILE_SIZE_CHANGED',name);
    return{bytes,identity:statIdentity(named),measured:{path:name,sizeBytes:bytes.length,sha256:sha(bytes)}};
  }catch(error){if(error instanceof Refusal)throw error;throw new Refusal('FILE_READ_FAILED',name);}
  finally{if(fd!==undefined)fs.closeSync(fd);}
}
function keysEqual(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&canonical(Object.keys(value).sort())===canonical([...keys].sort());}
function parseManifest(bytes){
  let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Refusal('INVALID_MANIFEST_JSON','manifest.json');}
  requireThat(keysEqual(value,['format','packageId','version','snapshotId','createdAt','fictional','payloadFileCount','payloadBytes','files']),'INVALID_MANIFEST_FIELDS','manifest.json');
  requireThat(value.format==='TRB_REAL_MATERIAL_CANARY_V1'&&value.packageId===ID&&value.version===VERSION&&value.snapshotId===SNAPSHOT&&value.fictional===true,'MANIFEST_IDENTITY_MISMATCH','manifest.json');
  requireThat(typeof value.createdAt==='string'&&!Number.isNaN(Date.parse(value.createdAt))&&value.payloadFileCount===3&&value.payloadBytes===615&&Array.isArray(value.files)&&value.files.length===3,'INVALID_MANIFEST_DECLARATIONS','manifest.json');
  const names=new Set();
  for(const file of value.files){
    requireThat(keysEqual(file,['path','sizeBytes','sha256','encoding','bom','lineEndings']),'INVALID_MANIFEST_FILE','manifest.json');
    const expected=PAYLOADS.find(f=>f.path===file.path);
    requireThat(expected&&!names.has(file.path)&&file.sizeBytes===expected.sizeBytes&&file.sha256===expected.sha256&&file.encoding==='UTF-8'&&file.bom===false&&file.lineEndings==='LF','INVALID_MANIFEST_FILE','manifest.json');names.add(file.path);
  }
  requireThat(Buffer.from(canonical(value)+'\n','utf8').equals(bytes),'NONCANONICAL_MANIFEST','manifest.json');
  return value;
}
function verifyAtFixedDirectory(directory,nonce,scope){
  checkedInventory(directory);const initialDirectory=checkedStat(directory,'directory');
  const reads=Object.fromEntries(FILES.map(file=>[file.path,readStable(directory,file.path)]));
  const manifest=parseManifest(reads['manifest.json'].bytes);
  requireThat(reads['manifest.sha256'].bytes.equals(Buffer.from(MANIFEST_HASH+'  manifest.json\n','utf8')),'INVALID_MANIFEST_CONTROL','manifest.sha256');
  const declaredManifestHash=reads['manifest.sha256'].bytes.toString('ascii').slice(0,64);
  for(const expected of FILES){const measured=reads[expected.path].measured;requireThat(measured.sizeBytes===expected.sizeBytes,'SIZE_MISMATCH',expected.path);requireThat(measured.sha256===expected.sha256,'SHA256_MISMATCH',expected.path);}
  const measuredFiles=FILES.map(file=>reads[file.path].measured),packageHash=sha(Buffer.from(canonical(measuredFiles),'utf8'));
  requireThat(reads['manifest.json'].measured.sha256===MANIFEST_HASH&&packageHash===PACKAGE_HASH,'PACKAGE_HASH_MISMATCH');
  checkedInventory(directory);const finalDirectory=checkedStat(directory,'directory');
  requireThat(sameObject(initialDirectory,finalDirectory)&&initialDirectory.mtimeNs===finalDirectory.mtimeNs&&initialDirectory.ctimeNs===finalDirectory.ctimeNs,'DIRECTORY_CHANGED_DURING_VERIFY');
  for(const file of FILES)requireThat(statIdentity(checkedStat(path.join(directory,file.path),'file'))===reads[file.path].identity,'FILE_CHANGED_AFTER_READ',file.path);
  return{format:'TRB_FIXED_READONLY_MATERIAL_VERIFIER_V1',ok:true,verified:true,nonce,scope,directory,
    expected:{packageId:ID,version:VERSION,snapshotId:SNAPSHOT,manifestHash:MANIFEST_HASH,packageHash:PACKAGE_HASH,payloadFileCount:3,totalFileCount:5,files:FILES.map(f=>({...f}))},
    declared:{packageId:manifest.packageId,version:manifest.version,snapshotId:manifest.snapshotId,payloadFileCount:manifest.payloadFileCount,payloadBytes:manifest.payloadBytes,files:manifest.files,manifestHashFromControl:declaredManifestHash},
    measured:{manifestHash:reads['manifest.json'].measured.sha256,packageHash,payloadFileCount:PAYLOADS.length,totalFileCount:measuredFiles.length,payloadBytes:PAYLOADS.reduce((n,f)=>n+reads[f.path].measured.sizeBytes,0),files:measuredFiles},
    method:'NODE_BUILTIN_SHA256_RAW_FILE_BYTES',packageHashMethod:'SHA256 canonical JSON five-entry path/sizeBytes/sha256 list',
    protections:{readOnly:true,networkAccess:false,childProcesses:false,packageCodeExecuted:false,agentToolsCalled:false},
    originalSessionProven:false,realAgentReceipt:false};
}

// Production takes no path, manifest override, hash override or executable input.
export function verifyCanary(options={}){return verifyAtFixedDirectory(PACKAGE_DIR,optionsNonce(options),'LOCAL_FIXED_CANARY_BYTES_ONLY');}
export function pinnedContract(){return{directory:PACKAGE_DIR,packageId:ID,version:VERSION,snapshotId:SNAPSHOT,manifestHash:MANIFEST_HASH,packageHash:PACKAGE_HASH,files:FILES.map(f=>({...f}))};}

// Tests can only address their own UUID fixture beneath this tool directory.
// This surface is not exposed by the CLI and cannot select arbitrary paths.
export function verifyFixtureForTests(fixtureId,options={}){
  requireThat(typeof fixtureId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(fixtureId),'INVALID_FIXTURE_ID');
  return verifyAtFixedDirectory(path.join(FIXTURE_DIR,'real-material-canary-001-'+fixtureId,'package'),optionsNonce(options),'SELF_TEST_FIXED_CANARY_BYTES_ONLY');
}
export function parseArguments(args){
  if(args.length===1&&args[0]==='--help')return{help:true};
  requireThat(args.length===0||args.length===2&&args[0]==='--nonce','INVALID_ARGUMENT');
  return{nonce:optionsNonce(args.length?{nonce:args[1]}:{})};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let nonce=null;
  try{const args=parseArguments(process.argv.slice(2));if(args.help)process.stdout.write(JSON.stringify({usage:'node tools/material-verifier/verify.mjs [--nonce <1..128 ASCII token>]',pathInputAccepted:false,scope:'one pinned five-file canary',readOnly:true})+'\n');else{nonce=args.nonce;process.stdout.write(JSON.stringify(verifyCanary({nonce}),null,2)+'\n');}}
  catch(error){process.stdout.write(JSON.stringify({format:'TRB_FIXED_READONLY_MATERIAL_VERIFIER_V1',ok:false,verified:false,nonce,error:{code:error instanceof Refusal?error.code:'VERIFICATION_FAILED',file:error instanceof Refusal?error.file:null},originalSessionProven:false,realAgentReceipt:false})+'\n');process.exitCode=2;}
}
