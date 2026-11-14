import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,symlinkSync,linkSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fixedRoot,checkedPath,boundedRead,exclusiveWrite,pngHeader,crc32} from './safe-local-files.mjs';
import {main as uxMain} from './ux-acceptance/check-proof.mjs';
import {main as collectorMain} from './real-link-evidence/collector.mjs';

function fixture(){mkdirSync(join(fixedRoot,'test-output'),{recursive:true});const dir=mkdtempSync(join(fixedRoot,'test-output','fake-uxtools-path-')),input=join(dir,'proof.json');writeFileSync(input,'{}');return {dir,input,options:{allowedBases:[join(fixedRoot,'test-output')],inputs:[input]}};}
function makeJunction(path,target){symlinkSync(target,path,process.platform==='win32'?'junction':'dir');}
function chunk(kind,data){const name=Buffer.from(kind),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,crc]);}
function smallPng(){const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',Buffer.from([1])),chunk('IEND',Buffer.alloc(0))]);}

test('both CLIs reject same input/output, existing reports, and outside Root without changing original bytes',()=>{
  const f=fixture(),target=join(f.dir,'existing-soak-report.json'),sentinel='original-soak-sentinel';writeFileSync(target,sentinel);
  for(const [main,flag] of [[uxMain,'--proof'],[collectorMain,'--input']]){
    assert.throws(()=>main([flag,f.input,'--out',f.input]),/input_output_conflict/);assert.equal(readFileSync(f.input,'utf8'),'{}');
    assert.throws(()=>main([flag,f.input,'--out',target]),/output_already_exists/);assert.equal(readFileSync(target,'utf8'),sentinel);
    const outside=join(dirname(fixedRoot),'never-created-uxtools-'+f.dir.split(/[\\/]/).at(-1)+'.json');
    assert.throws(()=>main([flag,f.input,'--out',outside]),/outside_fixed_root/);assert.equal(existsSync(outside),false);
    assert.throws(()=>main([flag,outside,'--out',join(f.dir,'unused.json')]),/outside_fixed_root/);
  }
});

test('real ancestor junctions are rejected for input, output and reads, including ancestors above import base',()=>{
  const f=fixture(),target=join(f.dir,'target');mkdirSync(join(target,'nested'),{recursive:true});writeFileSync(join(target,'nested','input.json'),'{}');
  const junction=join(f.dir,'junction');makeJunction(junction,target);
  for(const [main,flag] of [[uxMain,'--proof'],[collectorMain,'--input']]){
    assert.throws(()=>main([flag,join(junction,'nested','input.json'),'--out',join(f.dir,'unused.json')]),/ancestor_link_not_allowed/);
    assert.throws(()=>main([flag,f.input,'--out',join(junction,'nested','new-report.json')]),/ancestor_link_not_allowed/);
  }
  assert.throws(()=>boundedRead(join(junction,'nested','input.json'),100),/ancestor_link_not_allowed/);assert.equal(existsSync(join(target,'nested','new-report.json')),false);
  const outsideJunction=join(f.dir,'outside-junction');makeJunction(outsideJunction,dirname(fixedRoot));
  assert.throws(()=>checkedPath(join(outsideJunction,'any-file.json')),/ancestor_link_not_allowed/);
});

test('collector artifact ancestors cannot use a real junction to escape their import base',()=>{
  const f=fixture(),target=join(f.dir,'target');mkdirSync(join(target,'nested'),{recursive:true});const receipt=join(target,'nested','receipt.json');writeFileSync(receipt,'{"format":"TRB_REAL_LINK_RECEIPT_V1"}');
  makeJunction(join(f.dir,'artifact-junction'),target);
  writeFileSync(f.input,JSON.stringify({format:'TRB_REAL_LINK_BATCH_V1',runId:'fiction-path-case',environment:'FAKE_TEST',participants:{hermes:'a'.repeat(64),deepseek:'b'.repeat(64),chatgpt:'c'.repeat(64)},roundTrips:[],artifacts:[{id:'fiction-receipt',path:'artifact-junction/nested/receipt.json',sha256:'a'.repeat(64),provenance:'HUMAN_REPORTED'}]}));
  const out=join(f.dir,'no-artifact-report.json');assert.throws(()=>collectorMain(['--input',f.input,'--out',out]),/ancestor_link_not_allowed/);
  assert.equal(existsSync(out),false);assert.equal(readFileSync(receipt,'utf8'),'{"format":"TRB_REAL_LINK_RECEIPT_V1"}');
});

test('stable bounded reads reject oversize and shared hardlinks; exclusive output cannot overwrite',()=>{
  const f=fixture();assert.equal(boundedRead(f.input,2).toString(),'{}');assert.throws(()=>boundedRead(f.input,1),/bounded_regular_file/);
  const alias=join(f.dir,'hardlink.json');linkSync(f.input,alias);assert.throws(()=>boundedRead(f.input,100),/unshared_bounded_regular_file/);
  const out=join(f.dir,'new-dir','fresh.json');exclusiveWrite(out,'saved',f.options);assert.equal(readFileSync(out,'utf8'),'saved');
  assert.throws(()=>exclusiveWrite(out,'replaced',f.options),/output_already_exists/);assert.equal(readFileSync(out,'utf8'),'saved');
});

test('PNG checks require reasonable IHDR, valid chunk bounds/CRCs and terminal IEND',()=>{
  const good=smallPng();assert.deepEqual(pngHeader(good),{width:1,height:1});
  for(const mutate of [b=>b.subarray(0,24),b=>{b.writeUInt32BE(0,16);return b;},b=>{b.writeUInt32BE(999999,16);return b;},b=>{b[29]^=1;return b;},b=>Buffer.concat([b,Buffer.from('tail')])])assert.throws(()=>pngHeader(mutate(Buffer.from(good))),/png/);
});

test('UX source and preview ancestor junctions produce failed checks without reading through the link',()=>{
  const f=fixture(),target=join(f.dir,'target');mkdirSync(target);writeFileSync(join(target,'source.mjs'),'fiction');writeFileSync(join(target,'preview.png'),smallPng());
  const junction=join(f.dir,'junction');makeJunction(junction,target);
  const b={sourceHashes:{[join(junction,'source.mjs').slice(fixedRoot.length+1).replaceAll('\\','/')]: 'a'.repeat(64)},proof:{ux:{viewportPreviews:[{width:1,height:1,deviceScaleX:1,deviceScaleY:1,image:join(junction,'preview.png')}]}}};writeFileSync(f.input,JSON.stringify(b));
  const output=join(f.dir,'failed-report.json');assert.equal(uxMain(['--proof',f.input,'--out',output]),1);
  const report=JSON.parse(readFileSync(output));assert.ok(report.failures.some(x=>x.startsWith('source:')));assert.ok(report.failures.includes('preview-file:1x1'));assert.match(report.viewports[0].image.error,/ancestor_link_not_allowed/);
});
