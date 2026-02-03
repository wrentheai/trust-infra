import { pgTable, char, text, varchar, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const agentStatusEnum = pgEnum('agent_status', ['active', 'revoked']);

export const agents = pgTable('agents', {
  agentId: char('agent_id', { length: 64 }).primaryKey(),  // SHA256 hash of public key
  publicKey: text('public_key').notNull().unique(),
  name: varchar('name', { length: 255 }),
  owner: varchar('owner', { length: 255 }),
  status: agentStatusEnum('status').notNull().default('active'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
