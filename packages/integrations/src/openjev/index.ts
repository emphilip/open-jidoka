import { HttpOpenJevClient } from './http-client';
import { MockOpenJevClient } from './mock-client';
import type { OpenJevClient } from './types';

export * from './types';
export { HttpOpenJevClient, MockOpenJevClient };

export function createOpenJevClient(env: NodeJS.ProcessEnv = process.env): OpenJevClient {
  const mode = env.OPENJEV_MODE ?? 'mock';
  if (mode === 'mock') return new MockOpenJevClient();
  if (mode !== 'http') throw new Error(`Unknown OPENJEV_MODE "${mode}", expected "http" or "mock"`);
  if (!env.OPENJEV_BASE_URL || !env.OPENJEV_MODEL) {
    throw new Error('OPENJEV_BASE_URL and OPENJEV_MODEL are required when OPENJEV_MODE=http');
  }
  return new HttpOpenJevClient({
    baseUrl: env.OPENJEV_BASE_URL,
    apiKey: env.OPENJEV_API_KEY,
    model: env.OPENJEV_MODEL,
    timeoutMs: env.OPENJEV_TIMEOUT_MS ? Number(env.OPENJEV_TIMEOUT_MS) : undefined,
  });
}
