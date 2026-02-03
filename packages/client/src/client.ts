import { signEventInChain } from '@trust-infra/crypto';
import * as ed25519 from '@noble/ed25519';
import type {
  Agent,
  Event,
  Capability,
  Reputation,
  AppendEventOptions,
  LogResponseOptions,
  QueryEventsOptions,
  EventType,
} from './types.js';

export interface TrustClientOptions {
  baseUrl: string;
  agentId: string;
  privateKey: string; // Hex encoded Ed25519 private key
  publicKey: string; // Hex encoded Ed25519 public key
}

export class TrustClient {
  private baseUrl: string;
  private agentId: string;
  private privateKey: string;
  private publicKey: string;
  private lastEventHash: string | null = null;

  constructor(options: TrustClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.agentId = options.agentId;
    this.privateKey = options.privateKey;
    this.publicKey = options.publicKey;
  }

  /**
   * Initialize client by fetching the last event hash
   */
  async init(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/events/last-hash/${this.agentId}`);
      if (response.ok) {
        const data = await response.json() as any;
        this.lastEventHash = data.lastHash;
      }
    } catch (error) {
      // Agent may not have any events yet, that's okay
      this.lastEventHash = null;
    }
  }

  /**
   * Append a new event to the ledger
   */
  async appendEvent(options: AppendEventOptions): Promise<Event> {
    // Sign the event
    const signedEvent = await signEventInChain(
      {
        agent_id: this.agentId,
        event_type: options.eventType,
        timestamp: (options.timestamp || new Date()).toISOString(),
        payload: options.payload,
        correlation_id: options.correlationId,
      },
      this.lastEventHash,
      this.privateKey
    );

    // Build request body
    const body = {
      agentId: this.agentId,
      eventType: options.eventType,
      timestamp: signedEvent.timestamp,
      payload: options.payload,
      correlationId: options.correlationId,
      hash: signedEvent.hash,
      signature: signedEvent.signature,
    };

    // Sign the request
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const requestPayload = `POST:/api/events:${JSON.stringify(body)}:${timestamp}`;
    const messageBytes = new TextEncoder().encode(requestPayload);
    const privateKeyBytes = Buffer.from(this.privateKey, 'hex');
    const signatureBytes = await ed25519.signAsync(messageBytes, privateKeyBytes);
    const signature = Buffer.from(signatureBytes).toString('hex');

    // Make request
    const response = await fetch(`${this.baseUrl}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': this.agentId,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(`Failed to append event: ${error.message || response.statusText}`);
    }

    const event = await response.json() as Event;

    // Update last hash for next event
    this.lastEventHash = event.hash;

    return event;
  }

  /**
   * Log an input received event
   */
  async logInput(content: string, correlationId?: string): Promise<Event> {
    const crypto = await import('@trust-infra/crypto');
    return this.appendEvent({
      eventType: 'input_received',
      payload: {
        content_hash: crypto.sha256(content),
        length: content.length,
      },
      correlationId,
    });
  }

  /**
   * Log a decision made event
   */
  async logDecision(decision: string, reasoning: string, correlationId?: string): Promise<Event> {
    return this.appendEvent({
      eventType: 'decision_made',
      payload: {
        decision,
        reasoning,
      },
      correlationId,
    });
  }

  /**
   * Log a tool call requested event
   */
  async logToolCall(tool: string, args: any, correlationId?: string): Promise<Event> {
    const crypto = await import('@trust-infra/crypto');
    return this.appendEvent({
      eventType: 'tool_call_requested',
      payload: {
        tool,
        args_hash: crypto.sha256(JSON.stringify(args)),
      },
      correlationId,
    });
  }

  /**
   * Log a tool call result event
   */
  async logToolResult(
    tool: string,
    status: 'success' | 'failure',
    result?: any,
    correlationId?: string
  ): Promise<Event> {
    return this.appendEvent({
      eventType: 'tool_call_result',
      payload: {
        tool,
        status,
        result,
      },
      correlationId,
    });
  }

  /**
   * Log a response emitted event
   */
  async logResponse(options: LogResponseOptions): Promise<Event> {
    return this.appendEvent({
      eventType: 'response_emitted',
      payload: {
        summary: options.summary,
        content_ref: options.contentRef,
        inputs_used: options.inputsUsed || [],
        risk_level: options.riskLevel || 'low',
        expected_outcome: options.expectedOutcome,
      },
      correlationId: options.correlationId,
    });
  }

  /**
   * Query events
   */
  async queryEvents(options: QueryEventsOptions = {}): Promise<Event[]> {
    const params = new URLSearchParams();

    if (options.agentId) params.append('agentId', options.agentId);
    if (options.eventType) params.append('eventType', options.eventType);
    if (options.correlationId) params.append('correlationId', options.correlationId);
    if (options.since) params.append('since', options.since.toISOString());
    if (options.until) params.append('until', options.until.toISOString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());

    const response = await fetch(`${this.baseUrl}/api/events?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to query events: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.events;
  }

  /**
   * Verify the event chain for this agent
   */
  async verifyChain(): Promise<{
    valid: boolean;
    errors: string[];
    totalEvents: number;
    firstInvalidEvent?: number;
  }> {
    const response = await fetch(`${this.baseUrl}/api/events/verify-chain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agentId: this.agentId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to verify chain: ${response.statusText}`);
    }

    return response.json() as Promise<{
      valid: boolean;
      errors: string[];
      totalEvents: number;
      firstInvalidEvent?: number;
    }>;
  }

  /**
   * Get agent details
   */
  async getAgent(): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/api/agents/${this.agentId}`);

    if (!response.ok) {
      throw new Error(`Failed to get agent: ${response.statusText}`);
    }

    return response.json() as Promise<Agent>;
  }

  /**
   * Get reputation
   */
  async getReputation(): Promise<Reputation> {
    const response = await fetch(`${this.baseUrl}/api/reputation/${this.agentId}`);

    if (!response.ok) {
      throw new Error(`Failed to get reputation: ${response.statusText}`);
    }

    return response.json() as Promise<Reputation>;
  }

  /**
   * List capabilities
   */
  async listCapabilities(activeOnly: boolean = true): Promise<Capability[]> {
    const params = new URLSearchParams({
      agentId: this.agentId,
      activeOnly: activeOnly.toString(),
    });

    const response = await fetch(`${this.baseUrl}/api/capabilities?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to list capabilities: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.capabilities;
  }

  /**
   * Get the last event hash (useful for debugging)
   */
  getLastEventHash(): string | null {
    return this.lastEventHash;
  }
}
