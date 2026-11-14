import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { probe, sha } from './probe.mjs';

const root = dirname(fileURLToPath(import.meta.url));
test('local MCP protocol only: isolated fictional canary', { timeout: 30000 }, async t => {
  const runs = join(root, 'test-runs');
  mkdirSync(runs, { recursive: true });
  const instance = mkdtempSync(join(runs, 'fixture-'));
  for (const name of ['server.mjs', 'probe.mjs', 'store.mjs']) copyFileSync(join(root, name), join(instance, name));
  const checks = [];
  const childPids = [];
  let client, transport;
  const connect = async () => {
    client = new Client({ name: 'local-fictional-protocol-test', version: '0.1.0' }, { capabilities: {} });
    transport = new StdioClientTransport({ command: process.execPath, args: [join(instance, 'server.mjs')], cwd: instance, stderr: 'pipe' });
    transport.stderr.on('data', () => {});
    await client.connect(transport);
    childPids.push(transport.pid);
  };
  const check = async (name, fn) => t.test(name, async () => {
    try { await fn(); checks.push({ name, status: 'PASS' }); }
    catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); throw error; }
  });
  const call = (name, args) => client.callTool({ name, arguments: args });
  const rejected = async (name, args) => {
    const out = await call(name, args);
    assert.equal(out.isError, true, JSON.stringify(out));
  };
  const reply = { runId: probe.runId, messageId: probe.messageId, nonce: probe.nonce, messageHash: probe.messageHash, reply: '5' };
  let receipt;
  try {
    await check('initialize official SDK stdio client', async () => {
      await connect();
      assert.deepEqual(client.getServerVersion(), { name: 'native-pull-001-canary', version: '0.1.0' });
      assert.equal(client.getInstructions(), undefined);
    });
    await check('tools/list exactly two bounded strict tools', async () => {
      const { tools } = await client.listTools();
      assert.deepEqual(tools.map(x => x.name).sort(), ['get_fictional_probe', 'submit_fictional_reply']);
      for (const tool of tools) {
        assert.equal(tool.inputSchema.additionalProperties, false);
        assert.equal(tool.outputSchema.additionalProperties, false);
        assert.equal(tool.annotations.openWorldHint, false);
      }
      assert.equal(tools.find(x => x.name === 'get_fictional_probe').annotations.readOnlyHint, true);
      assert.equal(tools.find(x => x.name === 'submit_fictional_reply').annotations.readOnlyHint, false);
    });
    await check('get fixed fictional probe and repeat without storage mutation', async () => {
      const a = await call('get_fictional_probe', {}), b = await call('get_fictional_probe', {});
      assert.ok(!a.isError && !b.isError);
      assert.deepEqual(a.structuredContent, probe);
      assert.deepEqual(a, b);
      assert.equal(probe.messageHash, sha(probe.message));
      assert.equal(existsSync(join(instance, 'fictional-result.sqlite')), false);
    });
    await check('extra path rejected by get schema', async () => {
      await rejected('get_fictional_probe', { path: 'fictional-other-file' });
      assert.equal(existsSync(join(instance, 'fictional-result.sqlite')), false);
    });
    await check('wrong run/message/nonce/hash and unknown reply path rejected', async () => {
      for (const key of ['runId', 'messageId', 'nonce', 'messageHash']) await rejected('submit_fictional_reply', { ...reply, [key]: 'wrong-fictional-value' });
      await rejected('submit_fictional_reply', { ...reply, path: 'fictional-other-file' });
      await rejected('submit_fictional_reply', { ...reply, reply: '' });
      await rejected('submit_fictional_reply', { ...reply, reply: ' ' });
      await rejected('submit_fictional_reply', { ...reply, reply: 'x'.repeat(513) });
      await rejected('submit_fictional_reply', { ...reply, reply: 5 });
      const { nonce, ...missing } = reply;
      await rejected('submit_fictional_reply', missing);
      assert.equal(existsSync(join(instance, 'fictional-result.sqlite')), false);
    });
    await check('correct reply atomically stored with honest provenance', async () => {
      const out = await call('submit_fictional_reply', reply);
      assert.ok(!out.isError);
      assert.equal(out.structuredContent.status, 'stored');
      receipt = out.structuredContent.receipt;
      assert.equal(receipt.reply, '5');
      assert.equal(receipt.replyHash, sha('5'));
      assert.equal(receipt.originalConversationAuthenticated, false);
      assert.equal(receipt.evidenceLevel, 'LOCAL_MCP_UNAUTHENTICATED_CLIENT');
    });
    await check('identical and reordered duplicate reply returns original receipt', async () => {
      for (const args of [reply, Object.fromEntries(Object.entries(reply).reverse())]) {
        const out = await call('submit_fictional_reply', args);
        assert.ok(!out.isError);
        assert.equal(out.structuredContent.status, 'already_stored');
        assert.deepEqual(out.structuredContent.receipt, receipt);
      }
    });
    await check('conflicting reply rejected, original result retained', async () => {
      await rejected('submit_fictional_reply', { ...reply, reply: '6' });
      const out = await call('submit_fictional_reply', reply);
      assert.deepEqual(out.structuredContent.receipt, receipt);
    });
    await check('restart SDK child preserves durable idempotency', async () => {
      await client.close();
      await connect();
      const out = await call('submit_fictional_reply', reply);
      assert.ok(!out.isError);
      assert.equal(out.structuredContent.status, 'already_stored');
      assert.deepEqual(out.structuredContent.receipt, receipt);
    });
    await check('fixed database contains exactly one fictional result', async () => {
      const db = new DatabaseSync(join(instance, 'fictional-result.sqlite'), { readOnly: true });
      try {
        assert.equal(db.prepare('SELECT count(*) AS n FROM fictional_reply').get().n, 1);
        assert.deepEqual(JSON.parse(db.prepare('SELECT receipt FROM fictional_reply').get().receipt), receipt);
        assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      } finally { db.close(); }
    });
  } finally {
    await client?.close();
    await transport?.close();
    writeFileSync(join(root, 'test-report.json'), JSON.stringify({
      scope: 'LOCAL_SDK_STDIO_PROTOCOL_TEST_ONLY', originalChatGPTCallTested: false,
      originalConversationAuthenticated: false, networkListenerStarted: false,
      persistentServiceStarted: false, testedAt: new Date().toISOString(), node: process.version,
      fixtureDirectory: instance, childPids, checks,
    }, null, 2) + '\n');
  }
});
