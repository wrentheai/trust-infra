import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyEvent } from '@trust-infra/crypto';
import { config } from '../config.js';
import { AgentRepository } from '../repositories/agent.repository.js';

const agentRepo = new AgentRepository();

/**
 * Verify service API key (for admin operations)
 */
export async function verifyServiceKey(request: FastifyRequest, reply: FastifyReply) {
  const serviceKey = request.headers['x-service-key'];

  if (!serviceKey || serviceKey !== config.serviceApiKey) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing service API key',
    });
  }
}

/**
 * Verify agent signature (for agent operations)
 *
 * Expected headers:
 * - X-Agent-Id: Agent UUID
 * - X-Timestamp: Unix timestamp (seconds)
 * - X-Signature: Ed25519 signature of (method + path + body + timestamp)
 */
export async function verifyAgentSignature(request: FastifyRequest, reply: FastifyReply) {
  const agentId = request.headers['x-agent-id'] as string;
  const timestamp = request.headers['x-timestamp'] as string;
  const signature = request.headers['x-signature'] as string;

  if (!agentId || !timestamp || !signature) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing authentication headers (X-Agent-Id, X-Timestamp, X-Signature)',
    });
  }

  try {
    // 1. Check timestamp (prevent replay attacks)
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);

    if (isNaN(requestTime)) {
      return reply.status(401).send({
        error: 'Invalid timestamp',
        message: 'X-Timestamp must be a Unix timestamp',
      });
    }

    const timeDiff = Math.abs(now - requestTime);
    if (timeDiff > config.signatureTimestampWindow) {
      return reply.status(401).send({
        error: 'Timestamp expired',
        message: `Request timestamp is outside the ${config.signatureTimestampWindow}s window`,
      });
    }

    // 2. Get agent and verify active status
    const agent = await agentRepo.findById(agentId);
    if (!agent) {
      return reply.status(401).send({
        error: 'Agent not found',
        message: `Agent ${agentId} does not exist`,
      });
    }

    if (agent.status !== 'active') {
      return reply.status(403).send({
        error: 'Agent not active',
        message: `Agent status is ${agent.status}`,
      });
    }

    // 3. Build signed payload
    const method = request.method;
    const path = request.url;
    const body = request.body ? JSON.stringify(request.body) : '';
    const payload = `${method}:${path}:${body}:${timestamp}`;

    // 4. Verify signature
    const ed25519 = await import('@noble/ed25519');
    const messageBytes = new TextEncoder().encode(payload);
    const signatureBytes = Buffer.from(signature, 'hex');
    const publicKeyBytes = Buffer.from(agent.publicKey, 'hex');

    const valid = await ed25519.verifyAsync(signatureBytes, messageBytes, publicKeyBytes);

    if (!valid) {
      return reply.status(401).send({
        error: 'Invalid signature',
        message: 'Signature verification failed',
      });
    }

    // Attach agent to request for downstream use
    (request as any).agent = agent;
  } catch (error) {
    request.log.error({ error }, 'Signature verification error');
    return reply.status(500).send({
      error: 'Verification error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Verify either service key OR agent signature
 */
export async function verifyAuth(request: FastifyRequest, reply: FastifyReply) {
  const hasServiceKey = !!request.headers['x-service-key'];
  const hasAgentAuth =
    !!request.headers['x-agent-id'] &&
    !!request.headers['x-timestamp'] &&
    !!request.headers['x-signature'];

  if (hasServiceKey) {
    return verifyServiceKey(request, reply);
  } else if (hasAgentAuth) {
    return verifyAgentSignature(request, reply);
  } else {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'No valid authentication method provided',
    });
  }
}
