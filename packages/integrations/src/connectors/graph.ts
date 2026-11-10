import { errorForStatus, NonRetryableError, RetryableError } from '../errors';
import type { ConnectorContext } from './types';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export const GRAPH_CONFIG_FIELDS = [
  { name: 'tenantId', label: 'Entra tenant ID', required: true },
  { name: 'clientId', label: 'App registration client ID', required: true },
];

/** App-only token via the OAuth client credentials grant. */
export async function graphToken(ctx: ConnectorContext): Promise<string> {
  const tenantId = ctx.config.tenantId as string | undefined;
  const clientId = ctx.config.clientId as string | undefined;
  if (!tenantId || !clientId) throw new NonRetryableError('Connection is missing tenantId or clientId');
  if (!ctx.secret) throw new NonRetryableError('Connection secret (client secret) is not available to the worker');

  const cacheKey = `${tenantId}:${clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const res = await ctx.fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: ctx.secret,
      scope: 'https://graph.microsoft.com/.default',
    }),
  });
  if (!res.ok) throw errorForStatus(res.status, `Entra token request failed (${res.status})`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(cacheKey, { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 });
  return body.access_token;
}

export async function graphRequest(
  ctx: ConnectorContext,
  method: string,
  path: string,
  options: { json?: unknown; body?: BodyInit; contentType?: string; raw?: boolean } = {},
): Promise<any> {
  const token = await graphToken(ctx);
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  let body = options.body;
  if (options.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.json);
  } else if (options.contentType) {
    headers['content-type'] = options.contentType;
  }

  let res: Response;
  try {
    res = await ctx.fetch(path.startsWith('https://') ? path : `${GRAPH}${path}`, { method, headers, body });
  } catch (err) {
    throw new RetryableError(`Graph request failed: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    throw errorForStatus(res.status, `Graph ${method} ${path} returned ${res.status}: ${detail}`);
  }
  if (options.raw) return res;
  if (res.status === 202 || res.status === 204) return { ok: true };
  return res.json();
}

export function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}
