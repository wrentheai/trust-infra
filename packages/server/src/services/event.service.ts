import { EventRepository } from '../repositories/event.repository.js';
import { AgentRepository } from '../repositories/agent.repository.js';
import { verifyEvent, verifyEventChain } from '@trust-infra/crypto';
import type { Event, NewEvent } from '../db/schema/events.js';
import type { SignedEvent } from '@trust-infra/crypto';

export interface AppendEventRequest {
  agentId: string;
  eventType: string;
  timestamp?: Date;
  payload: any;
  correlationId?: string;
  hash: string;
  signature: string;
}

export class EventService {
  constructor(
    private eventRepo: EventRepository,
    private agentRepo: AgentRepository
  ) {}

  /**
   * Append a new event to the ledger with full verification
   */
  async appendEvent(request: AppendEventRequest): Promise<Event> {
    // 1. Verify agent exists and is active
    const agent = await this.agentRepo.findById(request.agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${request.agentId}`);
    }
    if (agent.status !== 'active') {
      throw new Error(`Agent is ${agent.status}`);
    }

    // 2. Get last event for hash chain linkage
    const lastEvent = await this.eventRepo.getLastEventForAgent(request.agentId);
    const prevHash = lastEvent ? lastEvent.hash : null;

    // 3. Build signed event for verification
    const signedEvent: SignedEvent = {
      agent_id: request.agentId,
      event_type: request.eventType,
      timestamp: (request.timestamp || new Date()).toISOString(),
      prev_hash: prevHash,
      payload: request.payload,
      correlation_id: request.correlationId,
      hash: request.hash,
      signature: request.signature,
    };

    // 4. Verify signature and hash
    const verification = await verifyEvent(signedEvent, agent.publicKey);
    if (!verification.valid) {
      throw new Error(`Event verification failed: ${verification.errors.join(', ')}`);
    }

    // 5. Verify prev_hash matches last event
    if (signedEvent.prev_hash !== prevHash) {
      throw new Error(
        `Hash chain broken: expected prev_hash ${prevHash}, got ${signedEvent.prev_hash}`
      );
    }

    // 6. Insert event into database
    const newEvent: NewEvent = {
      agentId: request.agentId,
      eventType: request.eventType as any,
      timestamp: request.timestamp || new Date(),
      prevHash,
      hash: request.hash,
      payload: request.payload,
      signature: request.signature,
      correlationId: request.correlationId,
    };

    return this.eventRepo.append(newEvent);
  }

  /**
   * Query events with filters
   */
  async queryEvents(filters: {
    agentId?: string;
    eventType?: string;
    correlationId?: string;
    since?: Date;
    until?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Event[]> {
    return this.eventRepo.query(filters);
  }

  /**
   * Get event by ID
   */
  async getEvent(id: number): Promise<Event> {
    const event = await this.eventRepo.findById(id);
    if (!event) {
      throw new Error(`Event not found: ${id}`);
    }
    return event;
  }

  /**
   * Verify the entire event chain for an agent
   */
  async verifyAgentChain(agentId: string): Promise<{
    valid: boolean;
    errors: string[];
    totalEvents: number;
    firstInvalidEvent?: number;
  }> {
    // Get agent
    const agent = await this.agentRepo.findById(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Get all events for agent
    const events = await this.eventRepo.getAgentChain(agentId);

    if (events.length === 0) {
      return {
        valid: true,
        errors: [],
        totalEvents: 0,
      };
    }

    // Convert to SignedEvent format
    const signedEvents: SignedEvent[] = events.map((e) => ({
      agent_id: e.agentId,
      event_type: e.eventType,
      timestamp: e.timestamp.toISOString(),
      prev_hash: e.prevHash,
      hash: e.hash,
      payload: e.payload,
      correlation_id: e.correlationId || undefined,
      signature: e.signature,
    }));

    // Verify chain
    return verifyEventChain(signedEvents, agent.publicKey);
  }

  /**
   * Get the last event hash for an agent (used by clients for chain building)
   */
  async getLastEventHash(agentId: string): Promise<string | null> {
    const lastEvent = await this.eventRepo.getLastEventForAgent(agentId);
    return lastEvent ? lastEvent.hash : null;
  }

  /**
   * Count events matching filters
   */
  async countEvents(filters: {
    agentId?: string;
    eventType?: string;
    correlationId?: string;
    since?: Date;
    until?: Date;
  }): Promise<number> {
    return this.eventRepo.count(filters);
  }
}
