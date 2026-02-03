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

export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.agentId, { onDelete: 'cascade' }),
  kind: memoryKindEnum('kind').notNull(),
  content: text('content').notNull(),
  contentHash: char('content_hash', { length: 64 }).notNull(),
  sourceEvents: uuid('source_events').array().notNull().default([]),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull().default('1.0'),
  active: boolean('active').notNull().default(true),
  supersededBy: uuid('superseded_by').references((): any => memories.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
