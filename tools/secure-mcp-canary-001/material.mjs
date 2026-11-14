import { createHash } from 'node:crypto';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const payloads = [
  ['README.txt', 'Fictional tunnel canary only. No real engineering material or approval.\n'],
  ['orchard.json', '{"name":"Glass Lantern Test Orchard","plots":[{"plot":"A2","fruit":"pear","count":17},{"plot":"C4","fruit":"plum","count":29}],"total":46,"marker":"TRB-TUNNEL-ORCHARD-001"}\n'],
  ['notes.txt', 'TRB-TUNNEL-ORCHARD-001\r\nTwo trailing spaces follow:  \r\nEND-CANARY\r\n'],
];
export const TOOL_NAME = 'trb_read_fictional_material_v1';
export function fixedMaterial() {
  const files = payloads.map(([path, text]) => ({ path, encoding: 'utf-8', text, bytes: Buffer.byteLength(text, 'utf8'), sha256: sha256(Buffer.from(text, 'utf8')) }));
  const manifest = {
    format: 'TRB_TUNNEL_FICTIONAL_MATERIAL_V1', packageId: 'trb-tunnel-orchard-001',
    version: 1, snapshotId: 'fictional-working-tree-none', fictional: true,
    sourceType: 'EMBEDDED_FICTIONAL_BYTES', fileCount: files.length,
    payloadBytes: files.reduce((n, f) => n + f.bytes, 0),
    files: files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
  };
  const manifestJson = JSON.stringify(manifest);
  return { manifest, manifestJson, manifestSha256: sha256(Buffer.from(manifestJson, 'utf8')), files };
}
export function readFixedTool(params) {
  if (params?.name !== TOOL_NAME) throw new Error('unknown_tool');
  const args = params.arguments ?? {};
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length !== 0)
    throw new Error('arguments_not_allowed');
  return fixedMaterial();
}
