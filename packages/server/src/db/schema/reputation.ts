import { pgTable, uuid, numeric, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { agents } from './agents.js';

export const reputation = pgTable('reputation', {
  agentId: uuid('agent_id').primaryKey().references(() => agents.agentId, { onDelete: 'cascade' }),
  overallScore: numeric('overall_score', { precision: 5, scale: 2 }).notNull().default('50.0'),
  totalActions: integer('total_actions').notNull().default(0),
  successRate: numeric('success_rate', { precision: 5, scale: 4 }).notNull().default('0.0'),
  failureRate: numeric('failure_rate', { precision: 5, scale: 4 }).notNull().default('0.0'),
  harmfulActions: integer('harmful_actions').notNull().default(0),
  userCorrections: integer('user_corrections').notNull().default(0),
  breakdown: jsonb('breakdown').notNull().default({}),
  lastUpdated: timestamp('last_updated', { withTimezone: true }).notNull().defaultNow(),
});

export type Reputation = typeof reputation.$inferSelect;
export type NewReputation = typeof reputation.$inferInsert;
