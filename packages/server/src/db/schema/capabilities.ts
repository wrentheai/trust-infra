import { pgTable, uuid, jsonb, varchar, timestamp, char, pgEnum } from 'drizzle-orm/pg-core';
import { agents } from './agents.js';

export const capabilityStatusEnum = pgEnum('capability_status', ['active', 'expired', 'revoked']);

export const capabilities = pgTable('capabilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.agentId, { onDelete: 'cascade' }),
  scope: jsonb('scope').notNull(),
  issuedBy: varchar('issued_by', { length: 255 }).notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  status: capabilityStatusEnum('status').notNull().default('active'),
  tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export type Capability = typeof capabilities.$inferSelect;
export type NewCapability = typeof capabilities.$inferInsert;
