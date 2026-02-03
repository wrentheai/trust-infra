import { pgTable, uuid, text, char, numeric, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { agents } from './agents.js';

export const memoryKindEnum = pgEnum('memory_kind', [
  'fact',
  'belief',
  'preference',
  'goal',
  'pattern',
  'relationship',
]);

export const sensitivityLevelEnum = pgEnum('sensitivity_level', [
  'low',
  'medium', 
  'high',
  'secret',
]);

export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.agentId, { onDelete: 'cascade' }),
  kind: memoryKindEnum('kind').notNull(),
  content: text('content').notNull(),  // Plaintext (for backward compat) or empty if encrypted
  contentHash: char('content_hash', { length: 64 }).notNull(),
  sourceEvents: uuid('source_events').array().notNull().default([]),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull().default('1.0'),
  active: boolean('active').notNull().default(true),
  supersededBy: uuid('superseded_by').references((): any => memories.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  
  // V2: Encryption fields
  encrypted: boolean('encrypted').notNull().default(false),
  ciphertext: text('ciphertext'),  // Encrypted content (base64)
  nonce: text('nonce'),  // Encryption nonce (base64)
  sensitivity: sensitivityLevelEnum('sensitivity').default('medium'),
  subject: text('subject'),  // Who/what this fact is about
});

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
