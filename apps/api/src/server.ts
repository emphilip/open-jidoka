import Fastify from 'fastify';
import { ZodError } from 'zod';
import { createAuthHook } from './auth';
import { registerRoutes } from './routes';
import { HttpError } from './runs-service';

export async function buildServer(opts: { token: string | undefined; logger?: boolean }) {
  const app = Fastify({ logger: opts.logger ?? true, bodyLimit: 10 * 1024 * 1024 });
  app.decorateRequest('actor', '');
  app.addHook('onRequest', createAuthHook(opts.token));

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'Invalid request', issues: err.issues });
    }
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({ error: err.message, details: err.details });
    }
    const pgCode = (err as { code?: string }).code;
    if (pgCode === '23505') return reply.code(409).send({ error: 'Already exists' });
    if (pgCode === '23514') return reply.code(400).send({ error: 'Value violates a constraint' });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: (err as Error).message });
    req.log.error(err);
    return reply.code(500).send({ error: 'Internal error' });
  });

  await registerRoutes(app);
  return app;
}
