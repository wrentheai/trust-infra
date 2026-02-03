import { FastifyInstance } from 'fastify';
import { EventService } from '../services/event.service.js';
import { EventRepository } from '../repositories/event.repository.js';
import { AgentRepository } from '../repositories/agent.repository.js';
import { verifyAgentSignature } from '../middleware/auth.js';

const eventRepo = new EventRepository();
const agentRepo = new AgentRepository();
const eventService = new EventService(eventRepo, agentRepo);

export async function eventRoutes(fastify: FastifyInstance) {
  // Append a new event (requires agent signature)
  fastify.post(
    '/events',
    {
      preHandler: verifyAgentSignature,
      schema: {
        body: {
          type: 'object',
          required: ['agentId', 'eventType', 'payload', 'hash', 'signature'],
          properties: {
            agentId: { type: 'string', pattern: '^[0-9a-f]{64}$' },
            eventType: {
              type: 'string',
              enum: [
                'input_received',
                'decision_made',
                'tool_call_requested',
                'tool_call_result',
                'response_emitted',
                'memory_created',
                'memory_updated',
                'capability_granted',
                'capability_revoked',
                'policy_violation',
                'error_occurred',
                'system_event',
              ],
            },
            timestamp: { type: 'string', format: 'date-time' },
            payload: { type: 'object' },
            correlationId: { type: 'string', format: 'uuid' },
            hash: { type: 'string', pattern: '^[0-9a-f]{64}$' },
            signature: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = request.body as any;
        const event = await eventService.appendEvent({
          agentId: body.agentId,
          eventType: body.eventType,
          timestamp: body.timestamp ? new Date(body.timestamp) : undefined,
          payload: body.payload,
          correlationId: body.correlationId,
          hash: body.hash,
          signature: body.signature,
        });

        return reply.status(201).send(event);
      } catch (error) {
        fastify.log.error({ error }, 'Failed to append event');
        return reply.status(400).send({
          error: 'Event append failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Query events
  fastify.get('/events', async (request, reply) => {
    try {
      const query = request.query as any;

      const events = await eventService.queryEvents({
        agentId: query.agentId,
        eventType: query.eventType,
        correlationId: query.correlationId,
        since: query.since ? new Date(query.since) : undefined,
        until: query.until ? new Date(query.until) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : 100,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
      });

      const total = await eventService.countEvents({
        agentId: query.agentId,
        eventType: query.eventType,
        correlationId: query.correlationId,
        since: query.since ? new Date(query.since) : undefined,
        until: query.until ? new Date(query.until) : undefined,
      });

      return reply.send({
        events,
        count: events.length,
        total,
      });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to query events');
      return reply.status(500).send({
        error: 'Query failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get last event hash for an agent
  fastify.get('/events/last-hash/:agentId', async (request, reply) => {
    try {
      const { agentId } = request.params as any;
      const hash = await eventService.getLastEventHash(agentId);
      return reply.send({ agentId, lastHash: hash });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get last hash');
      return reply.status(500).send({
        error: 'Query failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Verify agent event chain
  fastify.post('/events/verify-chain', async (request, reply) => {
    try {
      const { agentId } = request.body as any;

      if (!agentId) {
        return reply.status(400).send({
          error: 'Validation error',
          message: 'agentId is required',
        });
      }

      const result = await eventService.verifyAgentChain(agentId);
      return reply.send(result);
    } catch (error) {
      fastify.log.error({ error }, 'Failed to verify chain');
      return reply.status(500).send({
        error: 'Verification failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get specific event by ID
  fastify.get('/events/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const event = await eventService.getEvent(parseInt(id, 10));
      return reply.send(event);
    } catch (error) {
      return reply.status(404).send({
        error: 'Event not found',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
