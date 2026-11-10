import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import { migrate } from '@openjidoka/db';
import { createOpenJevClient } from '@openjidoka/integrations/openjev';
import { createActivities } from './activities';

const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const namespace = process.env.TEMPORAL_NAMESPACE ?? 'default';
const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? 'openjidoka';

async function connect(): Promise<NativeConnection> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await NativeConnection.connect({ address });
    } catch (err) {
      if (attempt >= 60) throw err;
      console.log(`waiting for Temporal at ${address} (${(err as Error).message})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

await migrate();
const openjev = createOpenJevClient();
const connection = await connect();
const worker = await Worker.create({
  connection,
  namespace,
  taskQueue,
  workflowsPath: fileURLToPath(new URL('./workflows/index.ts', import.meta.url)),
  activities: createActivities({ openjev }),
});
console.log(`worker listening on task queue "${taskQueue}" (OpenJEV mode: ${openjev.mode})`);
await worker.run();
await connection.close();
