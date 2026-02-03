import { eq, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { reputation, type Reputation } from '../db/schema/reputation.js';

export class ReputationRepository {
  async findByAgentId(agentId: string): Promise<Reputation | undefined> {
    const [rep] = await db
      .select()
      .from(reputation)
      .where(eq(reputation.agentId, agentId))
      .limit(1);
    return rep;
  }

  async findAll(): Promise<Reputation[]> {
    return db.select().from(reputation).orderBy(desc(reputation.overallScore));
  }

  async update(
    agentId: string,
    data: {
      overallScore?: number;
      totalActions?: number;
      successRate?: number;
      failureRate?: number;
      harmfulActions?: number;
      userCorrections?: number;
      breakdown?: any;
    }
  ): Promise<Reputation> {
    const updateData: any = {
      ...data,
      lastUpdated: new Date(),
    };

    // Convert numbers to strings for numeric fields
    if (data.overallScore !== undefined) {
      updateData.overallScore = data.overallScore.toString();
    }
    if (data.successRate !== undefined) {
      updateData.successRate = data.successRate.toString();
    }
    if (data.failureRate !== undefined) {
      updateData.failureRate = data.failureRate.toString();
    }

    const [rep] = await db
      .update(reputation)
      .set(updateData)
      .where(eq(reputation.agentId, agentId))
      .returning();

    return rep;
  }

  async incrementAction(agentId: string): Promise<Reputation> {
    const current = await this.findByAgentId(agentId);
    if (!current) {
      throw new Error(`Reputation not found for agent ${agentId}`);
    }

    return this.update(agentId, {
      totalActions: Number(current.totalActions) + 1,
    });
  }
}
