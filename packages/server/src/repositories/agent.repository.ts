import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { agents, type NewAgent, type Agent } from '../db/schema/agents.js';

export class AgentRepository {
  async create(data: NewAgent): Promise<Agent> {
    const [agent] = await db.insert(agents).values(data).returning();
    return agent;
  }

  async findById(agentId: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.agentId, agentId)).limit(1);
    return agent;
  }

  async findByPublicKey(publicKey: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.publicKey, publicKey)).limit(1);
    return agent;
  }

  async findAll(filters?: { status?: 'active' | 'revoked'; owner?: string }): Promise<Agent[]> {
    let query = db.select().from(agents);

    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(agents.status, filters.status));
    }
    if (filters?.owner) {
      conditions.push(eq(agents.owner, filters.owner));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query.orderBy(desc(agents.createdAt));
  }

  async revoke(agentId: string): Promise<Agent> {
    const [agent] = await db
      .update(agents)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
      })
      .where(eq(agents.agentId, agentId))
      .returning();

    return agent;
  }

  async updateMetadata(agentId: string, metadata: any): Promise<Agent> {
    const [agent] = await db
      .update(agents)
      .set({ metadata })
      .where(eq(agents.agentId, agentId))
      .returning();

    return agent;
  }
}
