import type {
  AiTaskResult,
  DecideTaskConfig,
  ExtractTaskConfig,
  JsonSchema,
  PromptTaskConfig,
  TaskType,
} from '@openjidoka/core/types';
import type { OpenJevClient } from '@openjidoka/integrations/openjev';
import type { ConnectionLoader } from './connector';
import { loadDocument } from './documents';
import { fail } from './failures';

export interface AiTaskInput {
  taskType: TaskType;
  /** Task config with expressions already resolved by the workflow. */
  config: Record<string, unknown>;
  /** Validation issues from the previous attempt, fed back so the model can correct itself. */
  feedback: string[];
}

const REASONING = {
  type: 'string',
  description: 'Concise justification that cites the specific inputs relied on.',
};

function withReasoning(result: JsonSchema): JsonSchema {
  return { type: 'object', properties: { result, reasoning: REASONING }, required: ['result', 'reasoning'] };
}

function feedbackBlock(feedback: string[]) {
  if (!feedback.length) return '';
  return `\n\nYour previous answer failed validation:\n${feedback.map((f) => `- ${f}`).join('\n')}\nReturn a corrected answer.`;
}

const stringify = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2));

export async function runAiTask(
  client: OpenJevClient,
  loadConnection: ConnectionLoader,
  { taskType, config, feedback }: AiTaskInput,
): Promise<AiTaskResult> {
  switch (taskType) {
    case 'openjev.prompt': {
      const c = config as unknown as PromptTaskConfig;
      const res = await client.generate({
        system: c.system,
        prompt: `${stringify(c.prompt)}${feedbackBlock(feedback)}`,
        schema: withReasoning(c.outputSchema ?? { type: 'string' }),
        model: c.model,
        temperature: c.temperature,
      });
      const json = res.json as { result: unknown; reasoning?: string };
      return { output: json?.result, reasoning: json?.reasoning, model: res.model, usage: res.usage };
    }

    case 'openjev.extract': {
      const c = config as unknown as ExtractTaskConfig;
      const doc = await loadDocument(c.document, loadConnection);
      const instructions = c.instructions ?? 'Extract the requested fields from the document.';
      const prompt =
        doc.kind === 'text'
          ? `${instructions}\nOnly use information present in the document. Use null for fields that are absent.\n\n<document name="${doc.filename ?? 'document'}">\n${doc.text}\n</document>`
          : `${instructions}\nOnly use information present in the attached document. Use null for fields that are absent.`;
      const res = await client.generate({
        system: 'You extract structured data from business documents with high precision.',
        prompt: prompt + feedbackBlock(feedback),
        schema: withReasoning(c.schema),
        schemaName: 'extraction',
        attachments: doc.kind === 'file' ? [doc.attachment] : undefined,
        model: c.model,
        temperature: 0,
      });
      const json = res.json as { result: unknown; reasoning?: string };
      return { output: json?.result, reasoning: json?.reasoning, model: res.model, usage: res.usage };
    }

    case 'openjev.decide': {
      const c = config as unknown as DecideTaskConfig;
      if (!Array.isArray(c.options) || c.options.length < 2) fail('decide task needs at least two options');
      const options = c.options.map(String);
      const res = await client.generate({
        system: 'You make policy decisions. Choose exactly one option and justify it from the context.',
        prompt: `Question: ${c.question}\nOptions: ${options.join(', ')}\n\nContext:\n${stringify(c.context ?? {})}${feedbackBlock(feedback)}`,
        schema: {
          type: 'object',
          properties: {
            choice: { type: 'string', enum: options },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            reasoning: REASONING,
          },
          required: ['choice', 'confidence', 'reasoning'],
        },
        schemaName: 'decision',
        model: c.model,
        temperature: 0,
      });
      const json = res.json as { choice: string; confidence: number; reasoning: string };
      return { output: json, reasoning: json?.reasoning, model: res.model, usage: res.usage };
    }

    default:
      return fail(`${taskType} is not an OpenJEV task`);
  }
}
