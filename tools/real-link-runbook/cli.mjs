import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RunbookLedger} from './ledger.mjs';
import {fixedRoot,within,boundedRead} from '../safe-local-files.mjs';
export function main(args=process.argv.slice(2)){
 const operation=args.shift(),options={};for(let i=0;i<args.length;i+=2){if(!['--environment','--directory','--input'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('invalid_cli_options');options[args[i]]=args[i+1];}
 const environment=options['--environment'];if(!['REAL','FAKE_TEST'].includes(environment))throw Error('explicit_environment_required');
 const ledger=new RunbookLedger({environment,directory:options['--directory']});let input;
 if(operation!=='status'){
  if(!options['--input'])throw Error('explicit_metadata_input_required');const path=resolve(options['--input']),base=environment==='REAL'?join(fixedRoot,'evidence/real-link-runbook-001/imports'):ledger.directory;
  if(!within(base,path)||!path.endsWith('.json'))throw Error('metadata_input_outside_task_import_directory');input=JSON.parse(boundedRead(path,4*1024*1024).toString('utf8').replace(/^\uFEFF/,''));
 }else if(options['--input'])throw Error('status_takes_no_input');
 const result=operation==='status'?ledger.status():operation==='initialize'?ledger.initialize(input):ledger.apply(operation,input);
 console.log(JSON.stringify(result,null,2));return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(error){console.error(JSON.stringify({error:error.message,realSending:false,automaticRetry:false}));process.exitCode=1;}}
