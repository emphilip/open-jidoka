import { describe, expect, it } from 'vitest';
import { connectors } from '../src/connectors';
import { MockOpenJevClient } from '../src/openjev';

const httpCtx = (seen: string[]) => ({
  config: { baseUrl: 'https://api.example.com/v1' },
  secret: 'token-value',
  fetch: (async (url: URL, init: RequestInit) => {
    seen.push(`${init.method} ${url} ${(init.headers as Record<string, string>).authorization}`);
    return new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch,
});

describe('http connector', () => {
  const request = connectors.http!.actions.request!;

  it('calls paths under the base URL with the secret as bearer auth', async () => {
    const seen: string[] = [];
    const res = await request.run({ path: '/orders', query: { limit: 5 } }, httpCtx(seen));
    expect(res).toEqual({ status: 200, data: { ok: true } });
    expect(seen).toEqual(['GET https://api.example.com/v1/orders?limit=5 Bearer token-value']);
  });

  it.each(['../admin', '../v1evil', 'https://attacker.example/x', '//attacker.example/x'])(
    'refuses %s which escapes the base URL',
    async (path) => {
      await expect(request.run({ path }, httpCtx([]))).rejects.toThrow(/escapes/);
    },
  );
});

describe('mock OpenJEV client', () => {
  it('answers with data shaped like the schema', async () => {
    const res = await new MockOpenJevClient().generate({
      prompt: 'x',
      schema: {
        type: 'object',
        properties: {
          choice: { type: 'string', enum: ['approve', 'review'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          lines: { type: 'array', items: { type: 'object', properties: { qty: { type: 'integer' } } } },
        },
      },
    });
    expect(res.json).toEqual({ choice: 'approve', confidence: 0.9, lines: [{ qty: 1250 }] });
  });
});
