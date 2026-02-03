import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { memories, type NewMemory, type Memory } from '../db/schema/memories.js';

export interface MemoryFilters {
  agentId?: string;
  kind?: string;
  active?: boolean;
  minConfidence?: number;
}

export class MemoryRepository {
  async create(data: NewMemory): Promise<Memory> {
    const [memory] = await db.insert(memories).values(data).returning();
    return memory;
  }

  async findById(id: string): Promise<Memory | undefined> {
    const [memory] = await db.select().from(memories).where(eq(memories.id, id)).limit(1);
    return memory;
  }

  async findByContentHash(contentHash: string): Promise<Memory | undefined> {
    const [memory] = await db
      .select()
      .from(memories)
      .where(eq(memories.contentHash, contentHash))
      .limit(1);
    return memory;
  }

  async query(filters: MemoryFilters): Promise<Memory[]> {
    let query = db.select().from(memories);

    const conditions = [];

    if (filters.agentId) {
      conditions.push(eq(memories.agentId, filters.agentId));
    }

    if (filters.kind) {
      conditions.push(eq(memories.kind, filters.kind as any));
    }

    if (filters.active !== undefined) {
      conditions.push(eq(memories.active, filters.active));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query.orderBy(desc(memories.confidence), desc(memories.createdAt));
  }

  async supersede(memoryId: string, supersededById: string): Promise<Memory> {
    const [memory] = await db
      .update(memories)
      .set({
        active: false,
        supersededBy: supersededById,
      })
      .where(eq(memories.id, memoryId))
      .returning();

    return memory;
  }

  async updateConfidence(memoryId: string, confidence: number): Promise<Memory> {
    const [memory] = await db
      .update(memories)
      .set({ confidence: confidence.toString() })
      .where(eq(memories.id, memoryId))
      .returning();

    return memory;
  }
}
