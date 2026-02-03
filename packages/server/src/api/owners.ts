import { FastifyInstance } from 'fastify';
import { db } from '../db/connection.js';
import { owners, sharingPolicies } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { generateKeyPair, hashPublicKey } from '../crypto/encryption.js';

export async function ownerRoutes(fastify: FastifyInstance) {

  /**
   * Register an owner for an agent (generates keypair)
   * The secret key is returned ONCE - owner must save it
   */
  fastify.post('/owners', {
    schema: {
      body: {
        type: 'object',
        required: ['agentId'],
        properties: {
          agentId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { agentId } = request.body as { agentId: string };
      
      // Check if owner already exists
      const existing = await db.query.owners.findFirst({
        where: eq(owners.agentId, agentId),
      });
      
      if (existing) {
        return reply.status(409).send({
          error: 'Owner already registered',
          message: 'This agent already has an owner. Use key recovery if you lost your key.',
        });
      }
      
      // Generate new keypair
      const keyPair = generateKeyPair();
      const keyHash = hashPublicKey(keyPair.publicKey);
      
      // Store owner with public key
      const [owner] = await db.insert(owners).values({
        agentId,
        publicKey: keyPair.publicKey,
        keyHash,
      }).returning();
      
      // Create default sharing policy
      await db.insert(sharingPolicies).values({
        ownerId: owner.id,
        defaultSharing: 'deny_all',
      });
      
      // Return keypair - SECRET KEY ONLY SHOWN ONCE
      return reply.status(201).send({
        owner: {
          id: owner.id,
          agentId: owner.agentId,
          publicKey: owner.publicKey,
          createdAt: owner.createdAt,
        },
        secretKey: keyPair.secretKey,
        warning: 'SAVE YOUR SECRET KEY! It will not be shown again. You need it to decrypt your data.',
      });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to register owner');
      return reply.status(500).send({
        error: 'Registration failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get owner info (public key only)
   */
  fastify.get('/owners/:agentId', async (request, reply) => {
    try {
      const { agentId } = request.params as { agentId: string };
      
      const owner = await db.query.owners.findFirst({
        where: eq(owners.agentId, agentId),
      });
      
      if (!owner) {
        return reply.status(404).send({
          error: 'Owner not found',
          message: 'No owner registered for this agent',
        });
      }
      
      return reply.send({
        id: owner.id,
        agentId: owner.agentId,
        publicKey: owner.publicKey,
        createdAt: owner.createdAt,
      });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get owner');
      return reply.status(500).send({
        error: 'Query failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get owner's sharing policy
   */
  fastify.get('/owners/:agentId/policy', async (request, reply) => {
    try {
      const { agentId } = request.params as { agentId: string };
      
      const owner = await db.query.owners.findFirst({
        where: eq(owners.agentId, agentId),
      });
      
      if (!owner) {
        return reply.status(404).send({
          error: 'Owner not found',
        });
      }
      
      const policy = await db.query.sharingPolicies.findFirst({
        where: eq(sharingPolicies.ownerId, owner.id),
      });
      
      return reply.send(policy || { defaultSharing: 'deny_all' });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get policy');
      return reply.status(500).send({
        error: 'Query failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Update owner's sharing policy
   * TODO: Require owner authentication (signature with secret key)
   */
  fastify.put('/owners/:agentId/policy', {
    schema: {
      body: {
        type: 'object',
        properties: {
          defaultSharing: { type: 'string', enum: ['allow_low', 'ask', 'deny_all'] },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { agentId } = request.params as { agentId: string };
      const body = request.body as { defaultSharing?: 'allow_low' | 'ask' | 'deny_all' };
      
      const owner = await db.query.owners.findFirst({
        where: eq(owners.agentId, agentId),
      });
      
      if (!owner) {
        return reply.status(404).send({
          error: 'Owner not found',
        });
      }
      
      const updateData: { updatedAt: Date; defaultSharing?: 'allow_low' | 'ask' | 'deny_all' } = {
        updatedAt: new Date(),
      };
      if (body.defaultSharing) {
        updateData.defaultSharing = body.defaultSharing;
      }
      
      const [policy] = await db.update(sharingPolicies)
        .set(updateData)
        .where(eq(sharingPolicies.ownerId, owner.id))
        .returning();
      
      return reply.send(policy);
    } catch (error) {
      fastify.log.error({ error }, 'Failed to update policy');
      return reply.status(500).send({
        error: 'Update failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
