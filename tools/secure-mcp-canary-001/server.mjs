import { Server } from '../native-pull-001/node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js';
import { StdioServerTransport } from '../native-pull-001/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, McpError, ErrorCode } from '../native-pull-001/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js';
import { TOOL_NAME, readFixedTool } from './material.mjs';

const server = new Server({ name: 'trb-fixed-fictional-material-001', version: '1.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [{
  name: TOOL_NAME, title: 'Read fixed fictional orchard material',
  description: 'Read the fixed fictional TRB tunnel verification package with exact UTF-8 text and SHA-256. Takes no arguments. No repository, path, URL, shell, session, memory, or private-data access.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}] }));
server.setRequestHandler(CallToolRequestSchema, async request => {
  try {
    const value = readFixedTool(request.params);
    return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
  } catch {
    throw new McpError(ErrorCode.InvalidParams, 'Only the fixed fictional tool with empty arguments is supported.');
  }
});
// Never log request bodies, credentials, environment, paths, or protocol error details.
server.onerror = () => process.stderr.write('TRB_CANARY_PROTOCOL_ERROR\n');
await server.connect(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 32768 }));
process.stdin.on('end', () => { void server.close(); });
