import { AgentRepository } from '../repositories/agent.repository.js';
import { deriveAgentId } from '@trust-infra/crypto';
import type { Agent, NewAgent } from '../db/schema/agents.js';

export class AgentService {
  constructor(private agentRepo: AgentRepository) {}

  async registerAgent(data: {
    publicKey: string;
    name?: string;
    owner?: string;
    metadata?: any;
  }): Promise<Agent> {
    // Validate public key format (64 hex chars)
    if (!/^[0-9a-f]{64}$/i.test(data.publicKey)) {
      throw new Error('Invalid public key format (must be 64 hex characters)');
    }

    // Check if agent already exists
    const existing = await this.agentRepo.findByPublicKey(data.publicKey);
    if (existing) {
      throw new Error('Agent with this public key already registered');
    }

    // Derive agent_id from public key
    const publicKeyBytes = Buffer.from(data.publicKey, 'hex');
    const agentId = deriveAgentId(publicKeyBytes);

    // Create agent
    const newAgent: NewAgent = {
      agentId,
      publicKey: data.publicKey,
      name: data.name,
      owner: data.owner,
      metadata: data.metadata || {},
      status: 'active',
    };

    return this.agentRepo.create(newAgent);
  }

  async getAgent(agentId: string): Promise<Agent> {
    const agent = await this.agentRepo.findById(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    return agent;
  }

  async getAgentByPublicKey(publicKey: string): Promise<Agent> {
    const agent = await this.agentRepo.findByPublicKey(publicKey);
    if (!agent) {
      throw new Error(`Agent not found with public key: ${publicKey}`);
    }
    return agent;
  }

  async listAgents(filters?: { status?: 'active' | 'revoked'; owner?: string }): Promise<Agent[]> {
    return this.agentRepo.findAll(filters);
  }

  async revokeAgent(agentId: string, reason?: string): Promise<Agent> {
    const agent = await this.getAgent(agentId);

    if (agent.status === 'revoked') {
      throw new Error('Agent is already revoked');
    }

    // Update metadata with revocation reason
    if (reason) {
      const metadata = { ...(agent.metadata as any), revocation_reason: reason };
      await this.agentRepo.updateMetadata(agentId, metadata);
    }

    return this.agentRepo.revoke(agentId);
  }

  async verifyAgentActive(agentId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (agent.status !== 'active') {
      throw new Error(`Agent is ${agent.status}`);
    }
  }
}
