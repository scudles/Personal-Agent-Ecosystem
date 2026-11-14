import {lstatSync,realpathSync,openSync,closeSync,fstatSync,readSync,writeSync,fsyncSync,mkdirSync} from 'node:fs';
import {resolve,relative,isAbsolute,parse,join,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const fixedRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
const equal=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
export function within(base,path,{allowEqual=false}={}){const rel=relative(base,path);return allowEqual&&equal(base,path)||!!rel&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);}
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs&&a.nlink===b.nlink;

// Every existing ancestor is checked from the drive/root, including ancestors
// above fixedRoot. This is a fail-closed local path check, not an OS sandbox.
export function checkedPath(value,{mustExist=false}={}){
  if(typeof value!=='string'||!value||value.includes('\0'))throw Error('invalid_local_path');
  const path=resolve(value);if(!within(fixedRoot,path))throw Error('path_outside_fixed_root');
  if(relative(fixedRoot,path).split(sep).some(part=>/[ .]$|[:\x00-\x1f]/.test(part)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))throw Error('unsafe_local_path_component');
  const anchor=realpathSync(fixedRoot);let current=parse(path).root,missing=false;
  for(const part of [null,...relative(current,path).split(sep).filter(Boolean)]){
    if(part)current=join(current,part);
    if(missing)continue;
    let stat;try{stat=lstatSync(current);}catch(error){if(error.code==='ENOENT'){missing=true;continue;}throw error;}
    if(stat.isSymbolicLink())throw Error('ancestor_link_not_allowed');
    if(!equal(current,path)&&!stat.isDirectory())throw Error('non_directory_ancestor');
    const real=realpathSync(current);
    if(within(fixedRoot,current,{allowEqual:true})&&!within(anchor,real,{allowEqual:true}))throw Error('realpath_outside_fixed_root');
  }
  if(mustExist&&missing)throw Error('local_input_missing');
  return path;
}

export function boundedRead(value,maxBytes){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<0)throw Error('invalid_read_limit');
  const path=checkedPath(value,{mustExist:true}),before=lstatSync(path);
  if(!before.isFile()||before.nlink!==1||before.size>maxBytes)throw Error('input_must_be_unshared_bounded_regular_file');
  const fd=openSync(path,'r');try{
    const opened=fstatSync(fd);if(!opened.isFile()||!same(before,opened)||opened.size>maxBytes)throw Error('input_changed_before_read');
    const bytes=Buffer.alloc(opened.size);let offset=0;
    while(offset<bytes.length){const count=readSync(fd,bytes,offset,bytes.length-offset,offset);if(!count)throw Error('input_truncated_during_read');offset+=count;}
    if(readSync(fd,Buffer.alloc(1),0,1,opened.size)!==0)throw Error('input_grew_during_read');
    const after=fstatSync(fd);checkedPath(path,{mustExist:true});
    if(!same(opened,after)||!same(after,lstatSync(path)))throw Error('input_changed_during_read');
    return bytes;
  }finally{closeSync(fd);}
}

export function checkOutput(value,{allowedBases,inputs=[]}={}){
  const path=checkedPath(value);
  if(!Array.isArray(allowedBases)||!allowedBases.some(base=>within(resolve(base),path)))throw Error('output_outside_new_report_roots');
  for(const input of inputs){const known=checkedPath(input,{mustExist:true});if(equal(path,known))throw Error('input_output_conflict');}
  try{lstatSync(path);throw Error('output_already_exists');}catch(error){if(error.code!=='ENOENT')throw error;}
  return path;
}

export function exclusiveWrite(value,bytes,options){
  const path=checkOutput(value,options),parent=dirname(path);let current=fixedRoot;
  for(const part of relative(fixedRoot,parent).split(sep).filter(Boolean)){
    current=join(current,part);checkedPath(current);try{mkdirSync(current);}catch(error){if(error.code!=='EEXIST')throw error;}checkedPath(current,{mustExist:true});
  }
  const beforeParent=lstatSync(parent);checkOutput(path,options);
  const fd=openSync(path,'wx');try{
    checkedPath(path,{mustExist:true});const afterParent=lstatSync(parent),opened=fstatSync(fd);
    if(!same(beforeParent,afterParent)&&!(beforeParent.dev===afterParent.dev&&beforeParent.ino===afterParent.ino))throw Error('output_parent_changed');
    if(!opened.isFile()||opened.nlink!==1||opened.size!==0)throw Error('invalid_exclusive_output');
    const data=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);let written=0;while(written<data.length)written+=writeSync(fd,data,written,data.length-written);
    fsyncSync(fd);checkedPath(path,{mustExist:true});
  }finally{closeSync(fd);}
  return path;
}

const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function crc32(bytes){let c=0xffffffff;for(const value of bytes)c=crcTable[(c^value)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
export function pngHeader(bytes){
  if(bytes.length<57||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('invalid_png_signature_or_length');
  if(bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR')throw Error('png_ihdr_required');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),depth=bytes[24],color=bytes[25],depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
  if(!width||!height||width>16384||height>16384||width*height>33554432||!depths[color]?.includes(depth)||bytes[26]!==0||bytes[27]!==0||bytes[28]>1)throw Error('unreasonable_png_header');
  let offset=8,hasData=false,ended=false,chunks=0;
  while(offset<bytes.length){
    if(++chunks>10000||offset+12>bytes.length)throw Error('invalid_png_chunk_bounds');
    const length=bytes.readUInt32BE(offset),end=offset+12+length;if(end>bytes.length)throw Error('invalid_png_chunk_bounds');
    const kind=bytes.toString('ascii',offset+4,offset+8);if(!/^[A-Za-z]{4}$/.test(kind)||crc32(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))throw Error('invalid_png_chunk_crc');
    if(kind==='IHDR'&&offset!==8)throw Error('duplicate_png_header');
    if(kind==='IDAT')hasData=true;
    if(kind==='IEND'){if(length!==0||end!==bytes.length||!hasData)throw Error('invalid_png_end');ended=true;}
    offset=end;
  }
  if(!ended)throw Error('png_end_missing');
  return {width,height};
}
