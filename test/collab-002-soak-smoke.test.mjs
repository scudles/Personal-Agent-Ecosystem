import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {runSoak} from '../scripts/soak-collab-002.mjs';
import {sha,inside,verifyPackageBytes,checkDatabase} from '../scripts/verify-collab-002-soak.mjs';
import {EngineeringContext} from '../engineering/context.mjs';
import {EngineeringDesktopApi} from '../engineering/desktop-api.mjs';

test('formal soak cannot start from a smoke-sized duration or an implicit long-run request',async()=>{
  await assert.rejects(runSoak({seconds:30,acceptance:true}),/at least 3600/);
  await assert.rejects(runSoak({seconds:3600,acceptance:false}),/explicit --acceptance/);
  await assert.rejects(runSoak({seconds:0}),/30..7200/);
});

test('soak path boundary rejects workspace peers, parent traversal and different drive roots',()=>{
  const parent=resolve('test-output');assert.equal(inside(parent,join(parent,'collab-002-fiction')),true);assert.equal(inside(parent,parent),false);assert.equal(inside(parent,resolve('data')),false);assert.equal(inside(parent,join(parent,'..','data')),false);
  if(process.platform==='win32')assert.equal(inside('D:\\TriReviewBridge\\test-output','E:\\fiction'),false);
});

test('sealed original bytes and all three mock inboxes are independently checked; a matching corrupted pair fails',()=>{
  mkdirSync('test-output',{recursive:true});const folder=mkdtempSync(resolve('test-output','collab-002-verifier-')),store=join(folder,'engineering-store'),packageId='fiction-package',file='source/changed_files/fiction.js',bytes=Buffer.from('export const fictional = 42;\n');
  const manifest={core:{included_files:[{path:file,sha256:sha(bytes),source_type:'REPOSITORY'}]}},document=Buffer.from(JSON.stringify(manifest));
  const attempts=['hermes','deepseek','chatgpt'].map((role,n)=>({role,id:'fiction-attempt-'+n,bindingId:'fiction-binding-'+n}));
  const cycle={packageId,version:1,manifestHash:sha(document),originalSourceHash:sha(bytes),attempts};
  const sealed=join(store,'packages',packageId,'v1'),locations=[sealed,...attempts.map(a=>join(store,'mock-inboxes',a.bindingId,a.id))];
  for(const location of locations){mkdirSync(join(location,'source','changed_files'),{recursive:true});writeFileSync(join(location,'manifest.json'),document);writeFileSync(join(location,'manifest.sha256'),cycle.manifestHash+'\n');writeFileSync(join(location,file),bytes);}
  cycle.sealedHashes=verifyPackageBytes(folder,cycle);assert.equal(cycle.sealedHashes[file],sha(bytes));
  writeFileSync(join(locations[2],file),'CORRUPT');assert.throws(()=>verifyPackageBytes(folder,cycle),/mock inbox bytes differ/);writeFileSync(join(locations[2],file),bytes);
  writeFileSync(join(sealed,file),'CORRUPT');writeFileSync(join(locations[1],file),'CORRUPT');assert.throws(()=>verifyPackageBytes(folder,cycle),/sealed original bytes changed/);
});

test('new isolated soak database verifier rejects original bindings and an elevated shared cap',()=>{
  mkdirSync('test-output',{recursive:true});const folder=mkdtempSync(resolve('test-output','collab-002-db-verifier-')),source=join(folder,'sources');mkdirSync(source);writeFileSync(join(source,'fiction.js'),'export const fiction = 42;\n');
  writeFileSync(join(folder,'workbench-config.json'),JSON.stringify({databaseFile:'collab-002.sqlite',mode:'SIMULATION_ONLY',port:48799}));
  const e=new EngineeringContext(join(folder,'collab-002.sqlite'),{storePath:join(folder,'engineering-store'),allowedSourceRoots:[source]});new EngineeringDesktopApi(e);
  try{
    e.core.control({paused:false,maxPerHour:30});assert.equal(checkDatabase(folder).totalSubmitted,0);
    e.core.db.prepare("INSERT INTO native_sessions VALUES('fiction-original','hermes','legacy_real','forbidden-fiction-original','fiction')").run();
    assert.throws(()=>checkDatabase(folder));
    e.core.db.prepare("DELETE FROM native_sessions WHERE id='fiction-original'").run();
    const control=e.core.control();e.core.put('control','global',{...control,maxPerHour:31});assert.throws(()=>checkDatabase(folder),/shared hourly cap/);
    assert.equal(readFileSync(join(source,'fiction.js'),'utf8'),'export const fiction = 42;\n');
  }finally{e.close();}
});
