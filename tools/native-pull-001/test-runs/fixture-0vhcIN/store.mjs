import { DatabaseSync } from 'node:sqlite';
import { lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { replyInput, sha } from './probe.mjs';

// Fixed relative to this module. No input, argument, environment variable or client identity selects a path.
const resultFile = fileURLToPath(new URL('./fictional-result.sqlite', import.meta.url));
export function submitReply(input) {
  const value = replyInput.parse(input);
  try {
    const stat = lstatSync(resultFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw Error('unsafe_fixed_result_file');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const db = new DatabaseSync(resultFile);
  try {
    db.exec('PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS fictional_reply (run_id TEXT PRIMARY KEY, submission TEXT NOT NULL, receipt TEXT NOT NULL) STRICT; BEGIN IMMEDIATE;');
    try {
      const serialized = JSON.stringify(value);
      const old = db.prepare('SELECT submission,receipt FROM fictional_reply WHERE run_id=?').get(value.runId);
      if (old) {
        if (old.submission !== serialized) throw Error('reply_conflict_existing_result_retained');
        db.exec('COMMIT');
        return { status: 'already_stored', receipt: JSON.parse(old.receipt) };
      }
      const receipt = {
        runId: value.runId, messageId: value.messageId, messageHash: value.messageHash,
        reply: value.reply, replyHash: sha(value.reply), receivedAt: new Date().toISOString(),
        fictional: true, evidenceLevel: 'LOCAL_MCP_UNAUTHENTICATED_CLIENT',
        originalConversationAuthenticated: false,
      };
      db.prepare('INSERT INTO fictional_reply VALUES(?,?,?)').run(value.runId, serialized, JSON.stringify(receipt));
      db.exec('COMMIT');
      return { status: 'stored', receipt };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } finally { db.close(); }
}
