export interface ConnectorContext {
  /** Non-secret connection settings stored in the connections table. */
  config: Record<string, unknown>;
  /** Value of the env var named by the connection's secretEnv, resolved in the worker only. */
  secret?: string;
  fetch: typeof fetch;
}

export interface ConnectorAction {
  description: string;
  /** Parameter names with a short description, shown in the admin UI. */
  params: Record<string, string>;
  run(params: Record<string, any>, ctx: ConnectorContext): Promise<unknown>;
}

export interface ConfigField {
  name: string;
  label: string;
  required?: boolean;
  description?: string;
}

export interface Connector {
  type: string;
  displayName: string;
  description: string;
  configFields: ConfigField[];
  /** What the secret env var must contain, if one is needed. */
  secretDescription?: string;
  actions: Record<string, ConnectorAction>;
}
