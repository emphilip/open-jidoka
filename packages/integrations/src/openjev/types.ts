import type { JsonSchema } from '@openjidoka/core/types';

export interface Attachment {
  filename: string;
  mimeType: string;
  /** base64 encoded bytes */
  data: string;
}

export interface GenerateRequest {
  system?: string;
  prompt: string;
  /** When set, the model must answer with JSON matching this schema. */
  schema?: JsonSchema;
  schemaName?: string;
  attachments?: Attachment[];
  model?: string;
  temperature?: number;
}

export interface GenerateResponse {
  text: string;
  json?: unknown;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

/** The only surface the rest of the system depends on; swap adapters without touching workflows. */
export interface OpenJevClient {
  readonly mode: string;
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}
