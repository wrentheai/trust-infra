import { FastifyInstance } from 'fastify';
import { CapabilityService } from '../services/capability.service.js';
import { CapabilityRepository } from '../repositories/capability.repository.js';
import { verifyServiceKey } from '../middleware/auth.js';

const capabilityRepo = new CapabilityRepository();
const capabilityService = new CapabilityService(capabilityRepo);

export async function capabilityRoutes(fastify: FastifyInstance) {
  // Mint a new capability (requires service key)
  fastify.post(
    '/capabilities',
    {
      preHandler: verifyServiceKey,
      schema: {
        body: {
          type: 'object',
          required: ['agentId', 'scope', 'issuedBy', 'expiresAt'],
          properties: {
            agentId: { type: 'string', format: 'uuid' },
            scope: { type: 'object' },
            issuedBy: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = request.body as any;
        const result = await capabilityService.mintCapability({
          agentId: body.agentId,
          scope: body.scope,
          issuedBy: body.issuedBy,
          expiresAt: new Date(body.expiresAt),
        });

        return reply.status(201).send({
          capability: result.capability,
          token: result.token, // Only returned on creation
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to mint capability');
        return reply.status(400).send({
          error: 'Mint failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Validate a capability token
  fastify.post('/capabilities/validate', async (request, reply) => {
    try {
      const { token } = request.body as any;

      if (!token) {
        return reply.status(400).send({
          error: 'Validation error',
          message: 'Token is required',
        });
      }

      const result = await capabilityService.validateToken(token);
      return reply.send(result);
    } catch (error) {
      fastify.log.error({ error }, 'Failed to validate token');
      return reply.status(500).send({
        error: 'Validation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Check permission for an agent
  fastify.post('/capabilities/check-permission', async (request, reply) => {
    try {
      const { agentId, action } = request.body as any;

      if (!agentId || !action) {
        return reply.status(400).send({
          error: 'Validation error',
          message: 'agentId and action are required',
        });
      }

      const result = await capabilityService.checkPermission(agentId, action);
      return reply.send(result);
    } catch (error) {
      fastify.log.error({ error }, 'Failed to check permission');
      return reply.status(500).send({
        error: 'Permission check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // List capabilities for an agent
  fastify.get('/capabilities', async (request, reply) => {
    try {
      const { agentId, activeOnly } = request.query as any;

      if (!agentId) {
        return reply.status(400).send({
          error: 'Validation error',
          message: 'agentId query parameter is required',
        });
      }

      const capabilities = await capabilityService.listCapabilities(
        agentId,
        activeOnly === 'true'
      );

      return reply.send({
        capabilities,
        count: capabilities.length,
      });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to list capabilities');
      return reply.status(500).send({
        error: 'List failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Revoke a capability (requires service key)
  fastify.post(
    '/capabilities/:id/revoke',
    {
      preHandler: verifyServiceKey,
    },
    async (request, reply) => {
      try {
        const { id } = request.params as any;
        const capability = await capabilityService.revokeCapability(id);
        return reply.send(capability);
      } catch (error) {
        fastify.log.error({ error }, 'Failed to revoke capability');
        return reply.status(400).send({
          error: 'Revocation failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}
