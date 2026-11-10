import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    actor: string;
  }
}

const digest = (v: string) => createHash('sha256').update(v).digest();

export function createAuthHook(token: string | undefined) {
  if (!token || token.length < 16) {
    throw new Error('ADMIN_API_TOKEN must be set to at least 16 characters');
  }
  const expected = digest(token);
  return async function authenticate(req: FastifyRequest, reply: FastifyReply) {
    if (!req.url.startsWith('/api/') || req.url === '/api/health') return;
    const header = req.headers.authorization ?? '';
    const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!presented || !timingSafeEqual(digest(presented), expected)) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    // Single shared admin token: the actor header is attribution for the audit log, not identity proof.
    const actor = req.headers['x-openjidoka-actor'];
    req.actor = typeof actor === 'string' && actor.trim() ? actor.trim().slice(0, 200) : 'admin';
  };
}
