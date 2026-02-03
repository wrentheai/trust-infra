import { FastifyRequest, FastifyReply } from 'fastify';

// Simple in-memory rate limiter (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function createRateLimiter(options: {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (request: FastifyRequest) => string;
}) {
  return async function rateLimiter(request: FastifyRequest, reply: FastifyReply) {
    const key = options.keyGenerator ? options.keyGenerator(request) : request.ip;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    // Reset if window expired
    if (!record || now > record.resetAt) {
      record = {
        count: 0,
        resetAt: now + options.windowMs,
      };
      rateLimitStore.set(key, record);
    }

    record.count++;

    // Check if limit exceeded
    if (record.count > options.maxRequests) {
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil((record.resetAt - now) / 1000)}s`,
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
    }

    // Add rate limit headers
    reply.header('X-RateLimit-Limit', options.maxRequests);
    reply.header('X-RateLimit-Remaining', options.maxRequests - record.count);
    reply.header('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));
  };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt + 60000) {
      // 1 minute grace period
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Run every minute
