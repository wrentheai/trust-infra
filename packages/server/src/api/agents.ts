import { FastifyInstance } from 'fastify';
import { AgentService } from '../services/agent.service.js';
import { AgentRepository } from '../repositories/agent.repository.js';
import { verifyServiceKey } from '../middleware/auth.js';

const agentRepo = new AgentRepository();
const agentService = new AgentService(agentRepo);

export async function agentRoutes(fastify: FastifyInstance) {
  // Register a new agent (requires service key)
  fastify.post(
    '/agents',
    {
      preHandler: verifyServiceKey,
      schema: {
        body: {
          type: 'object',
          required: ['publicKey'],
          properties: {
            publicKey: { type: 'string', pattern: '^[0-9a-f]{64}$' },
            name: { type: 'string' },
            owner: { type: 'string' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const agent = await agentService.registerAgent(request.body as any);
        return reply.status(201).send(agent);
      } catch (error) {
        fastify.log.error({ error }, 'Failed to register agent');
        return reply.status(400).send({
          error: 'Registration failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // List agents
  fastify.get('/agents', async (request, reply) => {
    try {
      const { status, owner } = request.query as any;
      const agents = await agentService.listAgents({ status, owner });
      return reply.send({ agents, count: agents.length });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to list agents');
      return reply.status(500).send({
        error: 'List failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get agent by ID
  fastify.get('/agents/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const agent = await agentService.getAgent(id);
      return reply.send(agent);
    } catch (error) {
      return reply.status(404).send({
        error: 'Agent not found',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Revoke an agent (requires service key)
  fastify.post(
    '/agents/:id/revoke',
    {
      preHandler: verifyServiceKey,
      schema: {
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as any;
        const { reason } = request.body as any;
        const agent = await agentService.revokeAgent(id, reason);
        return reply.send(agent);
      } catch (error) {
        fastify.log.error({ error }, 'Failed to revoke agent');
        return reply.status(400).send({
          error: 'Revocation failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}
