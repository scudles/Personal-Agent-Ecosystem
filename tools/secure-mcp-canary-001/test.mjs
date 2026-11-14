import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from '../native-pull-001/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../native-pull-001/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import { TOOL_NAME, fixedMaterial, readFixedTool } from './material.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('exact fictional bytes, UTF-8/CRLF/trailing spaces, manifest hash, and orchard arithmetic', () => {
  const b = fixedMaterial();
  assert.equal(b.manifest.fictional, true);
  assert.equal(b.manifest.fileCount, 3);
  for (const file of b.files) {
    assert.equal(file.sha256, sha(Buffer.from(file.text, 'utf8')));
    assert.equal(file.bytes, Buffer.byteLength(file.text, 'utf8'));
    assert.deepEqual(b.manifest.files.find(x => x.path === file.path), { path:file.path, bytes:file.bytes, sha256:file.sha256 });
  }
  assert.equal(b.manifest.payloadBytes, b.files.reduce((n,f) => n + f.bytes, 0));
  assert.equal(b.manifestSha256, sha(Buffer.from(b.manifestJson)));
  assert.deepEqual(JSON.parse(b.manifestJson), b.manifest);
  const orchard=JSON.parse(b.files.find(x=>x.path==='orchard.json').text);
  assert.equal(orchard.plots.reduce((n,x)=>n+x.count,0),46);
  assert.equal(orchard.total,46);
  const notes=b.files.find(x=>x.path==='notes.txt').text;
  assert.ok(notes.includes('spaces follow:  \r\n'));
  assert.ok(notes.startsWith(orchard.marker+'\r\n'));
  assert.ok(notes.endsWith('END-CANARY\r\n'));
});
test('caller cannot select paths, commands, network destinations, credentials or alternate tools', () => {
  for (const argumentsValue of [{path:'../fictional-private/db.sqlite'}, {command:'echo forbidden'}, {url:'https://example.invalid'}, {token:'fictional-secret'}, [], {__test:1}]) {
    assert.throws(()=>readFixedTool({name:TOOL_NAME,arguments:argumentsValue}),/arguments_not_allowed/);
  }
  for (const name of ['read_file','shell','fetch','submit_fictional_reply']) assert.throws(()=>readFixedTool({name,arguments:{}}),/unknown_tool/);
  assert.deepEqual(readFixedTool({name:TOOL_NAME,arguments:{}}), fixedMaterial());
});
test('actual SDK stdio handshake, only one read-only tool, exact repeated return and no extra capabilities', async () => {
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./server.mjs',import.meta.url))],cwd:fileURLToPath(new URL('.',import.meta.url)),env:{},stderr:'pipe'});
  const client=new Client({name:'trb-fictional-local-test',version:'1.0.0'});
  let stderr=''; transport.stderr?.on('data',x=>stderr+=x);
  try {
    await client.connect(transport);
    assert.deepEqual(Object.keys(client.getServerCapabilities()),['tools']);
    const tools=await client.listTools();
    assert.equal(tools.tools.length,1);
    assert.equal(tools.tools[0].name,TOOL_NAME);
    assert.equal(tools.tools[0].annotations.readOnlyHint,true);
    assert.equal(tools.tools[0].annotations.openWorldHint,false);
    assert.equal(tools.tools[0].inputSchema.additionalProperties,false);
    const first=await client.callTool({name:TOOL_NAME,arguments:{}});
    assert.deepEqual(first.structuredContent,fixedMaterial());
    assert.deepEqual(JSON.parse(first.content[0].text),first.structuredContent);
    const next=await client.callTool({name:TOOL_NAME,arguments:{}});
    assert.deepEqual(next,first);
    for (const args of [{path:'fictional-private.txt'}, {command:'echo forbidden'}, {url:'https://example.invalid'}]) {
      await assert.rejects(()=>client.callTool({name:TOOL_NAME,arguments:args}));
    }
    await assert.rejects(()=>client.callTool({name:'submit_fictional_reply',arguments:{}}));
    await assert.rejects(()=>client.listResources());
    await assert.rejects(()=>client.listPrompts());
    assert.deepEqual((await client.callTool({name:TOOL_NAME,arguments:{}})).structuredContent, first.structuredContent);
    assert.equal(stderr,'');
  } finally { await client.close(); await transport.close(); }
});
