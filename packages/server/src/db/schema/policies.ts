import { pgTable, uuid, text, char, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { owners } from './owners.js';

export const defaultSharingEnum = pgEnum('default_sharing', ['allow_low', 'ask', 'deny_all']);
export const trustLevelEnum = pgEnum('trust_level', ['full', 'limited', 'none']);

export const sharingPolicies = pgTable('sharing_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => owners.id, { onDelete: 'cascade' }),
  defaultSharing: defaultSharingEnum('default_sharing').notNull().default('deny_all'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const trustedAgents = pgTable('trusted_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  policyId: uuid('policy_id').notNull().references(() => sharingPolicies.id, { onDelete: 'cascade' }),
  trustedAgentId: char('trusted_agent_id', { length: 64 }).notNull(),
  trustLevel: trustLevelEnum('trust_level').notNull().default('limited'),
  allowedCategories: text('allowed_categories').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const categoryRules = pgTable('category_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  policyId: uuid('policy_id').notNull().references(() => sharingPolicies.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  defaultShare: boolean('default_share').notNull().default(false),
  requireContext: boolean('require_context').notNull().default(true),
});

export type SharingPolicy = typeof sharingPolicies.$inferSelect;
export type NewSharingPolicy = typeof sharingPolicies.$inferInsert;
export type TrustedAgent = typeof trustedAgents.$inferSelect;
export type NewTrustedAgent = typeof trustedAgents.$inferInsert;
export type CategoryRule = typeof categoryRules.$inferSelect;
export type NewCategoryRule = typeof categoryRules.$inferInsert;
