import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { agents } from './agents.js';

export const queryTypeEnum = pgEnum('query_type', ['specific', 'category', 'about']);
export const responseStatusEnum = pgEnum('response_status', ['answered', 'declined', 'partial', 'unknown', 'pending']);

export const queryLog = pgTable('query_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  targetAgentId: uuid('target_agent_id').notNull().references(() => agents.agentId),
  requesterAgentId: uuid('requester_agent_id').notNull(),
  requesterSignature: text('requester_signature').notNull(),
  
  // Query details
  queryType: queryTypeEnum('query_type').notNull(),
  querySubject: text('query_subject'),
  queryCategory: text('query_category'),
  queryQuestion: text('query_question'),
  queryContext: text('query_context'),
  
  // Response
  responseStatus: responseStatusEnum('response_status').notNull().default('pending'),
  responseReason: text('response_reason'),
  factsShared: uuid('facts_shared').array(),
  
  queriedAt: timestamp('queried_at', { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
});

export type QueryLog = typeof queryLog.$inferSelect;
export type NewQueryLog = typeof queryLog.$inferInsert;
