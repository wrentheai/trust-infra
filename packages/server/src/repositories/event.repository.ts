import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { events, type NewEvent, type Event } from '../db/schema/events.js';

export interface EventFilters {
  agentId?: string;
  eventType?: string;
  correlationId?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export class EventRepository {
  /**
   * Append a new event to the ledger
   * NOTE: This does NOT validate signatures or hash chains - that's done in the service layer
   */
  async append(data: NewEvent): Promise<Event> {
    const [event] = await db.insert(events).values(data).returning();
    return event;
  }

  /**
   * Get the last event for an agent (for hash chain linkage)
   */
  async getLastEventForAgent(agentId: string): Promise<Event | undefined> {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.agentId, agentId))
      .orderBy(desc(events.timestamp), desc(events.id))
      .limit(1);

    return event;
  }

  /**
   * Get event by hash
   */
  async findByHash(hash: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.hash, hash)).limit(1);
    return event;
  }

  /**
   * Get event by ID
   */
  async findById(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    return event;
  }

  /**
   * Query events with filters
   */
  async query(filters: EventFilters): Promise<Event[]> {
    let query = db.select().from(events);

    const conditions = [];

    if (filters.agentId) {
      conditions.push(eq(events.agentId, filters.agentId));
    }

    if (filters.eventType) {
      conditions.push(eq(events.eventType, filters.eventType as any));
    }

    if (filters.correlationId) {
      conditions.push(eq(events.correlationId, filters.correlationId));
    }

    if (filters.since) {
      conditions.push(gte(events.timestamp, filters.since));
    }

    if (filters.until) {
      conditions.push(lte(events.timestamp, filters.until));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(desc(events.timestamp)) as any;

    if (filters.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters.offset) {
      query = query.offset(filters.offset) as any;
    }

    return query;
  }

  /**
   * Get all events for an agent in chronological order (for chain verification)
   */
  async getAgentChain(agentId: string): Promise<Event[]> {
    return db
      .select()
      .from(events)
      .where(eq(events.agentId, agentId))
      .orderBy(events.timestamp, events.id);
  }

  /**
   * Count events matching filters
   */
  async count(filters: Omit<EventFilters, 'limit' | 'offset'>): Promise<number> {
    const conditions = [];

    if (filters.agentId) {
      conditions.push(eq(events.agentId, filters.agentId));
    }

    if (filters.eventType) {
      conditions.push(eq(events.eventType, filters.eventType as any));
    }

    if (filters.correlationId) {
      conditions.push(eq(events.correlationId, filters.correlationId));
    }

    if (filters.since) {
      conditions.push(gte(events.timestamp, filters.since));
    }

    if (filters.until) {
      conditions.push(lte(events.timestamp, filters.until));
    }

    let query = db.select({ count: sql<number>`count(*)` }).from(events);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const [result] = await query;
    return Number(result.count);
  }
}
