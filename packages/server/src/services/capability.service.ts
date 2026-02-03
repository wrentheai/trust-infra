import { CapabilityRepository } from '../repositories/capability.repository.js';
import { sha256 } from '@trust-infra/crypto';
import { randomBytes } from 'node:crypto';
import type { Capability, NewCapability } from '../db/schema/capabilities.js';

export interface MintCapabilityRequest {
  agentId: string;
  scope: Record<string, any>;
  issuedBy: string;
  expiresAt: Date;
}

export class CapabilityService {
  constructor(private capabilityRepo: CapabilityRepository) {}

  /**
   * Mint a new capability token
   */
  async mintCapability(request: MintCapabilityRequest): Promise<{
    capability: Capability;
    token: string;
  }> {
    // Generate secure random token
    const token = randomBytes(32).toString('hex'); // 64 hex chars
    const tokenHash = sha256(token);

    // Create capability
    const newCapability: NewCapability = {
      agentId: request.agentId,
      scope: request.scope,
      issuedBy: request.issuedBy,
      issuedAt: new Date(),
      expiresAt: request.expiresAt,
      status: 'active',
      tokenHash,
    };

    const capability = await this.capabilityRepo.create(newCapability);

    return {
      capability,
      token, // Return token ONLY on creation
    };
  }

  /**
   * Validate a capability token
   */
  async validateToken(token: string): Promise<{
    valid: boolean;
    capability?: Capability;
    reason?: string;
  }> {
    const tokenHash = sha256(token);
    const capability = await this.capabilityRepo.findByTokenHash(tokenHash);

    if (!capability) {
      return { valid: false, reason: 'Token not found' };
    }

    if (capability.status === 'revoked') {
      return { valid: false, capability, reason: 'Token revoked' };
    }

    if (capability.status === 'expired' || new Date() > capability.expiresAt) {
      return { valid: false, capability, reason: 'Token expired' };
    }

    return { valid: true, capability };
  }

  /**
   * Check if agent has permission for a specific action
   */
  async checkPermission(
    agentId: string,
    action: string
  ): Promise<{
    allowed: boolean;
    scope?: any;
    reason?: string;
  }> {
    const capabilities = await this.capabilityRepo.findActiveForAgent(agentId);

    for (const cap of capabilities) {
      const scope = cap.scope as Record<string, any>;

      // Check if this capability grants the action
      if (scope[action]) {
        return {
          allowed: true,
          scope: scope[action],
        };
      }

      // Check wildcard permissions (e.g., "tool:*" grants all tools)
      const actionPrefix = action.split(':')[0];
      if (scope[`${actionPrefix}:*`]) {
        return {
          allowed: true,
          scope: scope[`${actionPrefix}:*`],
        };
      }
    }

    return {
      allowed: false,
      reason: `No capability grants permission for: ${action}`,
    };
  }

  /**
   * List capabilities for an agent
   */
  async listCapabilities(agentId: string, activeOnly: boolean = false): Promise<Capability[]> {
    if (activeOnly) {
      return this.capabilityRepo.findActiveForAgent(agentId);
    }
    return this.capabilityRepo.findAllForAgent(agentId);
  }

  /**
   * Revoke a capability
   */
  async revokeCapability(capabilityId: string): Promise<Capability> {
    const capability = await this.capabilityRepo.findById(capabilityId);
    if (!capability) {
      throw new Error(`Capability not found: ${capabilityId}`);
    }

    if (capability.status === 'revoked') {
      throw new Error('Capability already revoked');
    }

    return this.capabilityRepo.revoke(capabilityId);
  }

  /**
   * Revoke all capabilities for an agent
   */
  async revokeAllForAgent(agentId: string): Promise<number> {
    return this.capabilityRepo.revokeAllForAgent(agentId);
  }

  /**
   * Cleanup expired capabilities (run periodically)
   */
  async expireOldCapabilities(): Promise<number> {
    return this.capabilityRepo.expireOldCapabilities();
  }
}
