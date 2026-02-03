import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { agentRoutes } from './api/agents.js';
import { eventRoutes } from './api/events.js';
import { capabilityRoutes } from './api/capabilities.js';
import { reputationRoutes } from './api/reputation.js';
import { createRateLimiter } from './middleware/ratelimit.js';
import { closeDatabase } from './db/connection.js';

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: config.logLevel,
    transport: config.prettyLogs
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  },
});

// Register CORS
await fastify.register(cors, {
  origin: true, // Allow all origins in development
  credentials: true,
});

// Global rate limiter
fastify.addHook(
  'preHandler',
  createRateLimiter({
    maxRequests: config.rateLimit.max,
    windowMs: 60000, // 1 minute
    keyGenerator: (request) => {
      // Rate limit per IP or per agent
      const agentId = request.headers['x-agent-id'] as string;
      return agentId || request.ip;
    },
  })
);

// Health check
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// API info
fastify.get('/', async (request, reply) => {
  return {
    name: 'Trust Infrastructure API',
    version: '1.0.0',
    description: 'Cryptographic trust infrastructure for AI agents',
    endpoints: {
      health: 'GET /health',
      agents: 'GET,POST /agents',
      events: 'GET,POST /events',
      capabilities: 'GET,POST /capabilities',
      reputation: 'GET /reputation',
    },
  };
});

// Register routes
await fastify.register(agentRoutes, { prefix: '/api' });
await fastify.register(eventRoutes, { prefix: '/api' });
await fastify.register(capabilityRoutes, { prefix: '/api' });
await fastify.register(reputationRoutes, { prefix: '/api' });

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await fastify.close();
      await closeDatabase();
      fastify.log.info('Server closed successfully');
      process.exit(0);
    } catch (error) {
      fastify.log.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  });
}

// Start server
try {
  await fastify.listen({
    port: config.port,
    host: config.host,
  });

  fastify.log.info(
    `🚀 Trust Infrastructure Server running at http://${config.host}:${config.port}`
  );
  fastify.log.info(`Environment: ${config.nodeEnv}`);
  fastify.log.info(`Database: ${config.databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
} catch (error) {
  fastify.log.error({ error }, 'Failed to start server');
  process.exit(1);
}
