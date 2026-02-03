import { pgTable, bigserial, uuid, timestamp, char, text, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { agents } from './agents.js';

export const eventTypeEnum = pgEnum('event_type', [
  'input_received',
  'decision_made',
  'tool_call_requested',
  'tool_call_result',
  'response_emitted',
  'memory_created',
  'memory_updated',
  'capability_granted',
  'capability_revoked',
  'policy_violation',
  'error_occurred',
  'system_event',
]);

export const events = pgTable('events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  agentId: uuid('agent_id').notNull().references(() => agents.agentId, { onDelete: 'cascade' }),
  eventType: eventTypeEnum('event_type').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  prevHash: char('prev_hash', { length: 64 }),
  hash: char('hash', { length: 64 }).notNull().unique(),
  payload: jsonb('payload').notNull().default({}),
  signature: text('signature').notNull(),
  correlationId: uuid('correlation_id'),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
