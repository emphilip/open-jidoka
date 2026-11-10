import type { JsonSchema } from '@openjidoka/core/types';
import type { GenerateRequest, GenerateResponse, OpenJevClient } from './types';

/** Offline adapter: answers with data shaped like the requested schema. For local dev and tests. */
export class MockOpenJevClient implements OpenJevClient {
  readonly mode = 'mock';

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    if (!req.schema) return { text: `Mock response to: ${req.prompt.slice(0, 80)}`, model: 'mock' };
    const json = sample(req.schema, 'result');
    return { text: JSON.stringify(json), json, model: 'mock', usage: { inputTokens: 0, outputTokens: 0 } };
  }
}

function sample(schema: JsonSchema, name: string): unknown {
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case 'object': {
      const props = (schema.properties ?? {}) as Record<string, JsonSchema>;
      return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, sample(v, k)]));
    }
    case 'array':
      return schema.items ? [sample(schema.items as JsonSchema, name)] : [];
    case 'number':
    case 'integer': {
      if (typeof schema.maximum === 'number' && schema.maximum <= 1) return 0.9;
      if (/confidence|score/i.test(name)) return 0.9;
      return typeof schema.minimum === 'number' ? Math.max(schema.minimum, 1250) : 1250;
    }
    case 'boolean':
      return true;
    case 'string':
      if (schema.format === 'date') return '2026-12-31';
      if (schema.format === 'date-time') return '2026-12-31T00:00:00Z';
      if (/currency/i.test(name)) return 'CAD';
      if (/reason/i.test(name)) return 'Mock reasoning: values were taken from the supplied context.';
      return `sample-${name}`;
    default:
      return null;
  }
}
