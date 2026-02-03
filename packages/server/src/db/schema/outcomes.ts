import { pgTable, uuid, bigint, varchar, numeric, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { agents } from './agents.js';
import { events } from './events.js';

export const outcomeTypeEnum = pgEnum('outcome_type', [
  'success',
  'partial_success',
  'failure',
  'user_corrected',
  'harmful',
]);

export const outcomes = pgTable('outcomes', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.agentId, { onDelete: 'cascade' }),
  eventId: bigint('event_id', { mode: 'number' }).notNull().references(() => events.id, { onDelete: 'cascade' }),
  outcomeType: outcomeTypeEnum('outcome_type').notNull(),
  reporter: varchar('reporter', { length: 255 }).notNull(),
  impactScore: numeric('impact_score', { precision: 3, scale: 2 }).notNull(),
  details: text('details'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
});

export type Outcome = typeof outcomes.$inferSelect;
export type NewOutcome = typeof outcomes.$inferInsert;
