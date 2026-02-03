import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { capabilities, type NewCapability, type Capability } from '../db/schema/capabilities.js';

export class CapabilityRepository {
  async create(data: NewCapability): Promise<Capability> {
    const [capability] = await db.insert(capabilities).values(data).returning();
    return capability;
  }

  async findById(id: string): Promise<Capability | undefined> {
    const [capability] = await db
      .select()
      .from(capabilities)
      .where(eq(capabilities.id, id))
      .limit(1);
    return capability;
  }

  async findByTokenHash(tokenHash: string): Promise<Capability | undefined> {
    const [capability] = await db
      .select()
      .from(capabilities)
      .where(eq(capabilities.tokenHash, tokenHash))
      .limit(1);
    return capability;
  }

  async findActiveForAgent(agentId: string): Promise<Capability[]> {
    const now = new Date();
    return db
      .select()
      .from(capabilities)
      .where(
        and(
          eq(capabilities.agentId, agentId),
          eq(capabilities.status, 'active'),
          gte(capabilities.expiresAt, now)
        )
      );
  }

  async findAllForAgent(agentId: string): Promise<Capability[]> {
    return db.select().from(capabilities).where(eq(capabilities.agentId, agentId));
  }

  async revoke(id: string): Promise<Capability> {
    const [capability] = await db
      .update(capabilities)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
      })
      .where(eq(capabilities.id, id))
      .returning();

    return capability;
  }

  async revokeAllForAgent(agentId: string): Promise<number> {
    const result = await db
      .update(capabilities)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
      })
      .where(
        and(eq(capabilities.agentId, agentId), eq(capabilities.status, 'active'))
      );

    return result.length || 0;
  }

  async expireOldCapabilities(): Promise<number> {
    const now = new Date();
    const result = await db
      .update(capabilities)
      .set({ status: 'expired' })
      .where(
        and(
          eq(capabilities.status, 'active'),
          lte(capabilities.expiresAt, now)
        )
      );

    return result.length || 0;
  }
}
