import fs from 'node:fs';import z from 'node:zlib';import {hash}from './core.mjs';
export const sessionId='session-ebd654d5-1bf8-419c-bc2a-d9be1ed023fc';
export const file='C:/Users/Administrator/.dsh/sessions/--E-~51EA--/'+sessionId+'/session.v4.jsonl.zstd';
export function observe(){
 const text=z.zstdDecompressSync(fs.readFileSync(file)).toString();const rows=text.split('\n').filter(Boolean).map(x=>JSON.parse(x));
 const header=rows[0];if(header.id!==sessionId||header.cwd!=='E:\\凪'||header.origin==='subagent')throw Error('wrong_session');
 const title=rows.filter(x=>x.type==='session/title').at(-1)?.data?.title;if(title!=='主进度')throw Error('title_mismatch');
 const start=rows.findLastIndex(x=>x.type==='turn/start'),end=rows.findLastIndex(x=>x.type==='turn/end');
 return {identity:'dsh:'+sessionId,messageCount:rows.length,tailHash:hash(text),busy:start>end,draft:false,adapter:'dsh-desktop-existing-session',title,sourceFile:file,rows};
}
if(import.meta.url===new URL('file:///'+process.argv[1]?.replaceAll('\\','/')).href){const{rows,...o}=observe();console.log(JSON.stringify({...o,lastMessageShapes:rows.filter(x=>['user/message','assistant/message'].includes(x.type)).slice(-2).map(x=>({type:x.type,keys:Object.keys(x),messageKeys:Object.keys(x.message||{}),contentTypes:x.message?.content?.map(p=>p.type)}))}));}
