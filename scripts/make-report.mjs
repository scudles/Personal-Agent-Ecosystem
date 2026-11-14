import fs from'node:fs';import{join}from'node:path';import{config,base,root}from'../src/config.mjs';import{hash}from'../src/core.mjs';
const r=await fetch(base+'/api/state',{headers:{Authorization:'Bearer '+config.token}});if(!r.ok)throw Error('state_unavailable');const s=await r.json();
if(s.probes.length!==3||s.probes.some(p=>p.state!=='passed'))throw Error('three_verified_receipts_required');
fs.writeFileSync(join(root,'evidence','phase1-state.json'),JSON.stringify(s,null,2));
const entries=fs.readdirSync(join(root,'evidence')).filter(x=>x!=='MANIFEST.json').map(name=>{const b=fs.readFileSync(join(root,'evidence',name));return{name,bytes:b.length,sha256:hash(b)};});
fs.writeFileSync(join(root,'evidence','MANIFEST.json'),JSON.stringify({generatedAt:new Date().toISOString(),purpose:'phase1 self-check evidence, not a trusted external timestamp or independent acceptance',entries},null,2));
console.log(JSON.stringify({passed:s.probes.map(p=>p.role),evidenceFiles:entries.length}));
