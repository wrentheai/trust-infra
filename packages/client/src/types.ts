export type EventType =
  | 'input_received'
  | 'decision_made'
  | 'tool_call_requested'
  | 'tool_call_result'
  | 'response_emitted'
  | 'memory_created'
  | 'memory_updated'
  | 'capability_granted'
  | 'capability_revoked'
  | 'policy_violation'
  | 'error_occurred'
  | 'system_event';

export interface Agent {
  agentId: string;
  publicKey: string;
  name?: string;
  owner?: string;
  status: 'active' | 'revoked';
  metadata: Record<string, any>;
  createdAt: string;
  revokedAt?: string;
}

export interface Event {
  id: number;
  agentId: string;
  eventType: EventType;
  timestamp: string;
  prevHash: string | null;
  hash: string;
  payload: any;
  signature: string;
  correlationId?: string;
}

export interface Capability {
  id: string;
  agentId: string;
  scope: Record<string, any>;
  issuedBy: string;
  issuedAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'revoked';
  tokenHash: string;
  revokedAt?: string;
}

export interface Reputation {
  agentId: string;
  overallScore: number;
  totalActions: number;
  successRate: number;
  failureRate: number;
  harmfulActions: number;
  userCorrections: number;
  breakdown: Record<string, number>;
  lastUpdated: string;
}

export interface AppendEventOptions {
  eventType: EventType;
  payload: any;
  correlationId?: string;
  timestamp?: Date;
}

export interface LogResponseOptions {
  summary: string;
  contentRef?: string;
  inputsUsed?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  expectedOutcome?: string;
  correlationId?: string;
}

export interface QueryEventsOptions {
  agentId?: string;
  eventType?: EventType;
  correlationId?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}
