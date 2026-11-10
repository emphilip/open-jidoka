import { getConnectionByName } from '@openjidoka/db';
import { connectors, type ConnectorContext } from '@openjidoka/integrations/connectors';
import { fail } from './failures';

export type ConnectionLoader = (name: string) => Promise<{ type: string; context: ConnectorContext }>;

const SECRET_ENV = /^OPENJIDOKA_SECRET_[A-Z0-9_]+$/;

export const loadConnectionFromDb: ConnectionLoader = async (name) => {
  const conn = await getConnectionByName(name);
  if (!conn) fail(`Connection "${name}" does not exist`);
  let secret: string | undefined;
  if (conn.secretEnv) {
    if (!SECRET_ENV.test(conn.secretEnv)) fail(`Connection "${name}" secretEnv must start with OPENJIDOKA_SECRET_`);
    secret = process.env[conn.secretEnv];
    if (!secret) fail(`Env var ${conn.secretEnv} for connection "${name}" is not set on the worker`);
  }
  return { type: conn.type, context: { config: conn.config, secret, fetch } };
};

export async function runConnectorAction(
  loadConnection: ConnectionLoader,
  input: { connection: string; action: string; params?: Record<string, unknown> },
): Promise<unknown> {
  const { type, context } = await loadConnection(input.connection);
  const connector = connectors[type];
  if (!connector) fail(`Connection "${input.connection}" has unknown type "${type}"`);
  const action = connector.actions[input.action];
  if (!action) {
    fail(`Connector ${type} has no action "${input.action}". Available: ${Object.keys(connector.actions).join(', ')}`);
  }
  return action.run(input.params ?? {}, context);
}
