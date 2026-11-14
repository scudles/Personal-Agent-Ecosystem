import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {verifyCanary,verifyFixtureForTests,pinnedContract,parseArguments} from './verify.mjs';

const base=path.dirname(fileURLToPath(import.meta.url)),contract=pinnedContract();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){const id=randomUUID(),parent=path.join(base,'fixtures','real-material-canary-001-'+id),directory=path.join(parent,'package');fs.mkdirSync(directory,{recursive:true});for(const file of contract.files)fs.copyFileSync(path.join(contract.directory,file.path),path.join(directory,file.path));return{id,parent,directory,verify:options=>verifyFixtureForTests(id,options)};}
function expectRefusal(action,codes){assert.throws(action,error=>codes.includes(error.code));}

test('fixed original canary yields actual raw hashes, distinct declarations and nonce; source bytes stay unchanged',()=>{
  const before=contract.files.map(f=>sha(fs.readFileSync(path.join(contract.directory,f.path))));
  const result=verifyCanary({nonce:'material-verifier-selftest-001'});
  assert.equal(result.ok,true);assert.equal(result.verified,true);assert.equal(result.nonce,'material-verifier-selftest-001');
  assert.deepEqual(result.measured.files,contract.files);assert.equal(result.measured.manifestHash,contract.manifestHash);assert.equal(result.measured.packageHash,contract.packageHash);assert.equal(result.measured.payloadBytes,615);
  assert.equal(result.declared.files.length,3);assert.equal(result.measured.files.length,5);assert.equal(result.originalSessionProven,false);assert.equal(result.realAgentReceipt,false);
  assert.deepEqual(contract.files.map(f=>sha(fs.readFileSync(path.join(contract.directory,f.path)))),before);
});

test('only nonce is accepted: arbitrary path, commands, expected hashes and malformed CLI forms fail',()=>{
  for(const options of [{path:'C:/Windows'},{command:'anything'},{manifestHash:'override'},{nonce:'bad\nvalue'},{nonce:'x'.repeat(129)}])expectRefusal(()=>verifyCanary(options),['UNSUPPORTED_OPTION','INVALID_NONCE']);
  for(const args of [['--path','C:/Windows'],['--nonce'],['--nonce','ok','--nonce','again'],['--command','anything']])expectRefusal(()=>parseArguments(args),['INVALID_ARGUMENT']);
  assert.deepEqual(parseArguments(['--nonce','one:bounded-token']),{nonce:'one:bounded-token'});
  for(const id of ['../escape','C:/Windows',randomUUID()+'/..'])expectRefusal(()=>verifyFixtureForTests(id),['INVALID_FIXTURE_ID']);
});

test('missing, extra and mis-cased file sets fail rather than hashing a subset',()=>{
  const missing=fixture();fs.unlinkSync(path.join(missing.directory,'notes.txt'));expectRefusal(()=>missing.verify(),['FILE_SET_MISMATCH']);
  const extra=fixture();fs.writeFileSync(path.join(extra.directory,'extra.txt'),'not allowed');expectRefusal(()=>extra.verify(),['FILE_SET_MISMATCH']);
  const casing=fixture();fs.renameSync(path.join(casing.directory,'README.txt'),path.join(casing.directory,'case-hop'));fs.renameSync(path.join(casing.directory,'case-hop'),path.join(casing.directory,'readme.txt'));expectRefusal(()=>casing.verify(),['FILE_SET_MISMATCH']);
});

test('same-size corruption, appended bytes and normalized trailing spaces all fail against pinned byte hashes',()=>{
  const corrupt=fixture(),file=path.join(corrupt.directory,'orchard.json'),bytes=fs.readFileSync(file);bytes[20]^=1;fs.writeFileSync(file,bytes);expectRefusal(()=>corrupt.verify(),['SHA256_MISMATCH']);
  const appended=fixture();fs.appendFileSync(path.join(appended.directory,'notes.txt'),'\n');expectRefusal(()=>appended.verify(),['SIZE_MISMATCH']);
  const normalized=fixture(),notes=path.join(normalized.directory,'notes.txt');fs.writeFileSync(notes,fs.readFileSync(notes,'utf8').replace('intentional:  \n','intentional:\n'));expectRefusal(()=>normalized.verify(),['SIZE_MISMATCH','SHA256_MISMATCH']);
});

test('invalid JSON, extra manifest fields, unsafe payload path and altered control hashes are rejected',()=>{
  const broken=fixture();fs.writeFileSync(path.join(broken.directory,'manifest.json'),'{bad');expectRefusal(()=>broken.verify(),['INVALID_MANIFEST_JSON']);
  const extra=fixture(),extraFile=path.join(extra.directory,'manifest.json'),m=JSON.parse(fs.readFileSync(extraFile));m.command='forbidden';fs.writeFileSync(extraFile,JSON.stringify(m));expectRefusal(()=>extra.verify(),['INVALID_MANIFEST_FIELDS']);
  const unsafe=fixture(),unsafeFile=path.join(unsafe.directory,'manifest.json'),u=JSON.parse(fs.readFileSync(unsafeFile));u.files[0].path='../outside';fs.writeFileSync(unsafeFile,JSON.stringify(u));expectRefusal(()=>unsafe.verify(),['INVALID_MANIFEST_FILE']);
  const hash=fixture();fs.writeFileSync(path.join(hash.directory,'manifest.sha256'),'0'.repeat(64)+'  manifest.json\n');expectRefusal(()=>hash.verify(),['INVALID_MANIFEST_CONTROL']);
});

test('hard links are rejected even when the linked bytes match the allowed original',()=>{
  const f=fixture(),notes=path.join(f.directory,'notes.txt');fs.renameSync(notes,path.join(f.parent,'linked-original.txt'));fs.linkSync(path.join(f.parent,'linked-original.txt'),notes);expectRefusal(()=>f.verify(),['HARD_LINK_REFUSED']);
});

test('file symlinks are refused; creation privilege absence is explicitly uncovered',t=>{
  const file=fixture(),notes=path.join(file.directory,'notes.txt');fs.unlinkSync(notes);
  try{fs.symlinkSync(path.join(contract.directory,'notes.txt'),notes,'file');}catch(error){if(process.platform==='win32'&&['EPERM','EACCES'].includes(error.code)){t.skip('Windows refused file-symlink fixture creation; no privilege escalation; file-symlink live coverage unavailable');return;}throw error;}
  expectRefusal(()=>file.verify(),['LINK_OR_JUNCTION_REFUSED']);
});

test('a real Windows junction at package or ancestor is refused before content reads',()=>{
  const junction=fixture();fs.renameSync(junction.directory,path.join(junction.parent,'actual-package'));fs.symlinkSync(path.join(junction.parent,'actual-package'),junction.directory,process.platform==='win32'?'junction':'dir');expectRefusal(()=>junction.verify(),['LINK_OR_JUNCTION_REFUSED']);
  const ancestor=fixture(),actual=path.join(base,'fixtures','real-material-canary-001-'+randomUUID());fs.renameSync(ancestor.parent,actual);fs.symlinkSync(actual,ancestor.parent,process.platform==='win32'?'junction':'dir');expectRefusal(()=>ancestor.verify(),['LINK_OR_JUNCTION_REFUSED']);
});

test('oversized files and unexpected directories named as payloads are rejected',()=>{
  const large=fixture();fs.writeFileSync(path.join(large.directory,'README.txt'),Buffer.alloc(20000,65));expectRefusal(()=>large.verify(),['FILE_TOO_LARGE']);
  const directory=fixture(),notes=path.join(directory.directory,'notes.txt');fs.unlinkSync(notes);fs.mkdirSync(notes);expectRefusal(()=>directory.verify(),['UNEXPECTED_FILE_TYPE']);
});

test('a fixed-scope test fixture can verify only identical original bytes and has explicit self-test scope',()=>{
  const f=fixture(),result=f.verify({nonce:'fixed-fixture'});assert.equal(result.scope,'SELF_TEST_FIXED_CANARY_BYTES_ONLY');assert.equal(result.measured.packageHash,contract.packageHash);assert.equal(result.protections.childProcesses,false);assert.equal(result.protections.networkAccess,false);
});

test('a different package identity, duplicate JSON keys or a false file count cannot reuse a valid canary result',()=>{
  const wrong=fixture(),file=path.join(wrong.directory,'manifest.json'),m=JSON.parse(fs.readFileSync(file));m.packageId=randomUUID();fs.writeFileSync(file,JSON.stringify(m));expectRefusal(()=>wrong.verify(),['MANIFEST_IDENTITY_MISMATCH']);
  const duplicate=fixture(),duplicateFile=path.join(duplicate.directory,'manifest.json'),raw=fs.readFileSync(duplicateFile,'utf8');fs.writeFileSync(duplicateFile,raw.replace('"version":1','"version":1,"version":1'));expectRefusal(()=>duplicate.verify(),['NONCANONICAL_MANIFEST']);
  const count=fixture(),countFile=path.join(count.directory,'manifest.json'),bad=JSON.parse(fs.readFileSync(countFile));bad.payloadFileCount=2;fs.writeFileSync(countFile,JSON.stringify(bad));expectRefusal(()=>count.verify(),['INVALID_MANIFEST_DECLARATIONS']);
});

test('physical content mutation during descriptor read is refused even when initially read bytes matched',t=>{
  const f=fixture(),target=path.join(f.directory,'README.txt'),originalOpen=fs.openSync,originalRead=fs.readSync;let targetFd,mutated=false;
  t.mock.method(fs,'openSync',function(file,...args){const fd=originalOpen.call(fs,file,...args);if(file===target)targetFd=fd;return fd;});
  t.mock.method(fs,'readSync',function(fd,...args){const count=originalRead.call(fs,fd,...args);if(fd===targetFd&&!mutated&&count>0){mutated=true;const b=fs.readFileSync(target);b[0]^=1;fs.writeFileSync(target,b);fs.utimesSync(target,new Date(),new Date(Date.now()+2000));}return count;});
  expectRefusal(()=>f.verify(),['FILE_CHANGED_DURING_READ']);assert.equal(mutated,true);
});

test('a file that grows during reading is capped and refused rather than read without a byte bound',t=>{
  const f=fixture(),target=path.join(f.directory,'README.txt'),originalOpen=fs.openSync,originalRead=fs.readSync;let targetFd,grown=false,readBytes=0;
  t.mock.method(fs,'openSync',function(file,...args){const fd=originalOpen.call(fs,file,...args);if(file===target)targetFd=fd;return fd;});
  t.mock.method(fs,'readSync',function(fd,...args){const count=originalRead.call(fs,fd,...args);if(fd===targetFd){readBytes+=count;if(!grown&&count>0){grown=true;fs.appendFileSync(target,Buffer.alloc(50000,65));}}return count;});
  expectRefusal(()=>f.verify(),['FILE_TOO_LARGE']);assert.equal(grown,true);assert.ok(readBytes<=16385,'file read exceeded cap plus one');
});

test('reparsing through a real junction between file reads is refused',t=>{
  const f=fixture(),target=path.join(f.directory,'README.txt'),originalOpen=fs.openSync,originalClose=fs.closeSync;let targetFd,reparsed=false;
  t.mock.method(fs,'openSync',function(file,...args){const fd=originalOpen.call(fs,file,...args);if(file===target)targetFd=fd;return fd;});
  // Windows refuses renaming this directory while its file descriptor is open.
  // Change the real filesystem after that read closes, before the next read.
  t.mock.method(fs,'closeSync',function(fd,...args){const result=originalClose.call(fs,fd,...args);if(fd===targetFd&&!reparsed){fs.renameSync(f.directory,path.join(f.parent,'reparsed-package'));fs.symlinkSync(path.join(f.parent,'reparsed-package'),f.directory,process.platform==='win32'?'junction':'dir');reparsed=true;}return result;});
  expectRefusal(()=>f.verify(),['RESOLVED_PATH_MISMATCH','LINK_OR_JUNCTION_REFUSED']);assert.equal(reparsed,true);
});

test('the production CLI parser never accepts a test fixture selector or help combined with a path',()=>{
  for(const args of [['--fixture',randomUUID()],['--help','--path','D:/outside'],['--nonce','valid','D:/outside']])expectRefusal(()=>parseArguments(args),['INVALID_ARGUMENT']);
});
