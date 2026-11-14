import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';import {join,resolve} from 'node:path';import {randomBytes} from 'node:crypto';
export const root=resolve(fileURLToPath(new URL('..',import.meta.url)));export const data=join(root,'data');mkdirSync(data,{recursive:true});
const path=join(data,'local-config.json');
if(!existsSync(path))writeFileSync(path,JSON.stringify({port:48731,token:randomBytes(32).toString('hex'),extensionId:null},null,2));
export const config=JSON.parse(readFileSync(path,'utf8'));export const base='http://127.0.0.1:'+config.port;
