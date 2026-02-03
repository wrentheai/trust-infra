import { pgTable, uuid, text, char, timestamp } from 'drizzle-orm/pg-core';
import { agents } from './agents.js';

export const owners = pgTable('owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.agentId, { onDelete: 'cascade' }).unique(),
  publicKey: text('public_key').notNull(),  // X25519 public key (base64)
  keyHash: char('key_hash', { length: 64 }).notNull(),  // Hash of public key
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Owner = typeof owners.$inferSelect;
export type NewOwner = typeof owners.$inferInsert;
