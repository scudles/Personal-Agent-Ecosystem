import { createHash } from 'node:crypto';
import { z } from 'zod';

const message = 'Fictional canary: what is 2 + 3? Reply with the digit only.';
export const probe = Object.freeze({
  runId: 'native-pull-001-fictional-run',
  messageId: 'fictional-message-001',
  nonce: 'canary-7f472b5e40d1489a8f1bcf19e5fb62e8',
  message,
  messageHash: createHash('sha256').update(message, 'utf8').digest('hex'),
  fictional: true,
  originalConversationAuthenticated: false,
});
export const getInput = z.object({}).strict();
export const replyInput = z.object({
  runId: z.literal(probe.runId),
  messageId: z.literal(probe.messageId),
  nonce: z.literal(probe.nonce),
  messageHash: z.literal(probe.messageHash),
  reply: z.string().min(1).max(512).refine(value => value.trim().length > 0, 'reply_must_not_be_blank'),
}).strict();
export const probeOutput = z.object({
  runId: z.string(), messageId: z.string(), nonce: z.string(), message: z.string(),
  messageHash: z.string(), fictional: z.literal(true), originalConversationAuthenticated: z.literal(false),
}).strict();
export const replyOutput = z.object({
  status: z.enum(['stored', 'already_stored']),
  receipt: z.object({
    runId: z.string(), messageId: z.string(), messageHash: z.string(), reply: z.string(),
    replyHash: z.string(), receivedAt: z.string(), fictional: z.literal(true),
    evidenceLevel: z.literal('LOCAL_MCP_UNAUTHENTICATED_CLIENT'),
    originalConversationAuthenticated: z.literal(false),
  }).strict(),
}).strict();
export const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
