import { migrate } from '@openjidoka/db';
import { buildServer } from './server';

await migrate();
const app = await buildServer({ token: process.env.ADMIN_API_TOKEN });
await app.listen({ host: '0.0.0.0', port: Number(process.env.API_PORT ?? 3000) });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.close().then(() => process.exit(0));
  });
}
