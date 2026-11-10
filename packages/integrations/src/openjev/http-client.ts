import { errorForStatus, NonRetryableError, RetryableError } from '../errors';
import type { GenerateRequest, GenerateResponse, OpenJevClient } from './types';

export interface HttpClientOptions {
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

/**
 * Adapter for an OpenAI-compatible chat completions endpoint (`POST {baseUrl}/chat/completions`)
 * with JSON schema response formats and file / image content parts.
 */
export class HttpOpenJevClient implements OpenJevClient {
  readonly mode = 'http';
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const content: ContentPart[] = [{ type: 'text', text: req.prompt }];
    for (const a of req.attachments ?? []) {
      const dataUrl = `data:${a.mimeType};base64,${a.data}`;
      content.push(
        a.mimeType.startsWith('image/')
          ? { type: 'image_url', image_url: { url: dataUrl } }
          : { type: 'file', file: { filename: a.filename, file_data: dataUrl } },
      );
    }

    const messages = [
      ...(req.system ? [{ role: 'system', content: req.system }] : []),
      { role: 'user', content },
    ];
    const model = req.model ?? this.options.model;
    const body: Record<string, unknown> = { model, messages };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.schema) {
      body.response_format = {
        type: 'json_schema',
        json_schema: { name: req.schemaName ?? 'result', schema: req.schema, strict: false },
      };
    }

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 120_000),
      });
    } catch (err) {
      throw new RetryableError(`OpenJEV request failed: ${(err as Error).message}`);
    }

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500);
      throw errorForStatus(res.status, `OpenJEV returned ${res.status}: ${detail}`);
    }

    const data = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const raw = data.choices?.[0]?.message?.content;
    const text = Array.isArray(raw) ? raw.map((p) => p.text ?? '').join('') : (raw ?? '');

    let json: unknown;
    if (req.schema) {
      try {
        json = JSON.parse(stripFences(text));
      } catch {
        // A malformed JSON answer is worth retrying; models are not deterministic.
        throw new RetryableError('OpenJEV did not return valid JSON');
      }
    }
    if (!text && !req.schema) throw new NonRetryableError('OpenJEV returned an empty response');

    return {
      text,
      json,
      model: data.model ?? model,
      usage: { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens },
    };
  }
}

function stripFences(text: string): string {
  const m = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(text);
  return m ? m[1]! : text;
}
