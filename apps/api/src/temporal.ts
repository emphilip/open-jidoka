import { Client, Connection } from '@temporalio/client';

export const temporalConfig = {
  address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  namespace: process.env.TEMPORAL_NAMESPACE ?? 'default',
  taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? 'openjidoka',
};

let client: Promise<Client> | undefined;

export function getTemporal(): Promise<Client> {
  client ??= Connection.connect({ address: temporalConfig.address })
    .then((connection) => new Client({ connection, namespace: temporalConfig.namespace }))
    .catch((err) => {
      client = undefined;
      throw err;
    });
  return client;
}
