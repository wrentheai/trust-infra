import { FastifyInstance } from 'fastify';
import { ReputationService, type OutcomeType } from '../services/reputation.service.js';
import { ReputationRepository } from '../repositories/reputation.repository.js';
import { verifyServiceKey } from '../middleware/auth.js';

const reputationRepo = new ReputationRepository();
const reputationService = new ReputationService(reputationRepo);

export async function reputationRoutes(fastify: FastifyInstance) {
  // Get reputation for an agent
  fastify.get('/reputation/:agentId', async (request, reply) => {
    try {
      const { agentId } = request.params as any;
      const reputation = await reputationService.getReputation(agentId);
      return reply.send(reputation);
    } catch (error) {
      return reply.status(404).send({
        error: 'Reputation not found',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // List all reputations
  fastify.get('/reputation', async (request, reply) => {
    try {
      const reputations = await reputationService.listReputations();
      return reply.send({
        reputations,
        count: reputations.length,
      });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to list reputations');
      return reply.status(500).send({
        error: 'List failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Record an outcome (requires service key or agent signature)
  fastify.post(
    '/outcomes',
    {
      preHandler: verifyServiceKey,
      schema: {
        body: {
          type: 'object',
          required: ['agentId', 'eventId', 'outcomeType', 'reporter'],
          properties: {
            agentId: { type: 'string', format: 'uuid' },
            eventId: { type: 'number' },
            outcomeType: {
              type: 'string',
              enum: ['success', 'partial_success', 'failure', 'user_corrected', 'harmful'],
            },
            reporter: { type: 'string' },
            impactScore: { type: 'number', minimum: -1, maximum: 1 },
            details: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = request.body as any;

        // Update reputation based on outcome
        const reputation = await reputationService.recordOutcome(
          body.agentId,
          body.outcomeType as OutcomeType,
          body.impactScore
        );

        return reply.status(201).send({
          reputation,
          message: 'Outcome recorded and reputation updated',
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to record outcome');
        return reply.status(400).send({
          error: 'Record failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Update domain score (requires service key)
  fastify.post(
    '/reputation/:agentId/domain',
    {
      preHandler: verifyServiceKey,
      schema: {
        body: {
          type: 'object',
          required: ['domain', 'score'],
          properties: {
            domain: { type: 'string' },
            score: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { agentId } = request.params as any;
        const { domain, score } = request.body as any;

        const reputation = await reputationService.updateDomainScore(agentId, domain, score);

        return reply.send(reputation);
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update domain score');
        return reply.status(400).send({
          error: 'Update failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Check if agent should be downgraded
  fastify.get('/reputation/:agentId/should-downgrade', async (request, reply) => {
    try {
      const { agentId } = request.params as any;
      const result = await reputationService.shouldDowngrade(agentId);
      return reply.send(result);
    } catch (error) {
      fastify.log.error({ error }, 'Failed to check downgrade');
      return reply.status(500).send({
        error: 'Check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
