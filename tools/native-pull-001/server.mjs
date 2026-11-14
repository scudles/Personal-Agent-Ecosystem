import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { probe, getInput, replyInput, probeOutput, replyOutput } from './probe.mjs';
import { submitReply } from './store.mjs';

const server = new McpServer({ name: 'native-pull-001-canary', version: '0.1.0' });
const result = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });
server.registerTool('get_fictional_probe', {
  title: 'Get the fixed fictional probe',
  description: 'Read the one fixed fictional canary message and its correlation fields. Reads no files or conversations.',
  inputSchema: getInput, outputSchema: probeOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async input => { getInput.parse(input); return result(probe); });
server.registerTool('submit_fictional_reply', {
  title: 'Submit the fictional probe reply',
  description: 'Store one reply to this fixed fictional probe. Identical submissions are idempotent; conflicting replies are rejected. Does not authenticate a ChatGPT conversation.',
  inputSchema: replyInput, outputSchema: replyOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async input => result(submitReply(input)));
await server.connect(new StdioServerTransport());
