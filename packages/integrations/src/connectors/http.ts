import { errorForStatus, NonRetryableError, RetryableError } from '../errors';
import type { Connector } from './types';

export const http: Connector = {
  type: 'http',
  displayName: 'HTTP / REST',
  description: 'Call any REST API under a fixed base URL. The secret, if set, is sent as an auth header.',
  configFields: [
    { name: 'baseUrl', label: 'Base URL', required: true },
    { name: 'authHeader', label: 'Auth header name', description: 'Defaults to Authorization' },
    { name: 'authScheme', label: 'Auth scheme', description: 'Prefix such as Bearer; empty for raw value' },
    { name: 'headers', label: 'Static headers (object)' },
  ],
  secretDescription: 'Token or API key for the auth header.',
  actions: {
    request: {
      description: 'Send a request; JSON responses are parsed.',
      params: { method: 'GET, POST, ...', path: 'Path appended to base URL', query: 'Object', body: 'JSON body', headers: 'Object' },
      async run(p, ctx) {
        const baseUrl = ctx.config.baseUrl as string | undefined;
        if (!baseUrl) throw new NonRetryableError('HTTP connection needs baseUrl');
        const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
        const url = new URL(String(p.path ?? '').replace(/^\//, ''), base);
        if (!url.href.startsWith(base.href)) {
          throw new NonRetryableError('Request path escapes the connection base URL');
        }
        for (const [k, v] of Object.entries(p.query ?? {})) url.searchParams.set(k, String(v));

        const headers: Record<string, string> = { ...((ctx.config.headers as Record<string, string>) ?? {}), ...(p.headers ?? {}) };
        if (ctx.secret) {
          const scheme = (ctx.config.authScheme as string | undefined) ?? 'Bearer';
          headers[(ctx.config.authHeader as string | undefined) ?? 'authorization'] = scheme ? `${scheme} ${ctx.secret}` : ctx.secret;
        }
        let body: string | undefined;
        if (p.body !== undefined) {
          headers['content-type'] ??= 'application/json';
          body = typeof p.body === 'string' ? p.body : JSON.stringify(p.body);
        }

        let res: Response;
        try {
          res = await ctx.fetch(url, { method: String(p.method ?? 'GET').toUpperCase(), headers, body });
        } catch (err) {
          throw new RetryableError(`HTTP request failed: ${(err as Error).message}`);
        }
        const text = await res.text();
        if (!res.ok) throw errorForStatus(res.status, `HTTP ${res.status}: ${text.slice(0, 500)}`);
        let data: unknown = text;
        if (res.headers.get('content-type')?.includes('json')) data = text ? JSON.parse(text) : null;
        return { status: res.status, data };
      },
    },
  },
};
