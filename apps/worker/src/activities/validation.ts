import { evaluate } from '@openjidoka/core/expressions';
import type { AiTaskResult, DocumentRef, TaskType, ValidationConfig, ValidationResult } from '@openjidoka/core/types';
import type { Attachment, OpenJevClient } from '@openjidoka/integrations/openjev';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { ConnectionLoader } from './connector';
import { loadDocument } from './documents';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export interface ValidateInput {
  taskType: TaskType;
  config: Record<string, unknown>;
  result: AiTaskResult;
  validation: ValidationConfig;
  context: unknown;
}

/**
 * Layered checks, cheapest first: built-in invariants, JSON schema, JSONata business rules,
 * then an independent OpenJEV judge that reviews the output and the reasoning behind it.
 * The judge only runs when the deterministic checks pass.
 */
export async function validateAiResult(
  client: OpenJevClient,
  loadConnection: ConnectionLoader,
  input: ValidateInput,
): Promise<ValidationResult> {
  const { result, validation } = input;
  const issues: string[] = [];
  const output = result.output as any;

  if (output === undefined || output === null) issues.push('OpenJEV returned no output');

  if (input.taskType === 'openjev.decide' && output) {
    const options = (input.config.options as unknown[]).map(String);
    if (!options.includes(output.choice)) issues.push(`Choice "${output.choice}" is not one of ${options.join(', ')}`);
  }

  if (validation.schema && output != null) {
    const check = ajv.compile(validation.schema);
    if (!check(output)) {
      for (const e of check.errors ?? []) issues.push(`Schema: ${e.instancePath || '(root)'} ${e.message}`);
    }
  }

  for (const rule of validation.rules ?? []) {
    try {
      const ok = await evaluate(rule.expr, { output, reasoning: result.reasoning, context: input.context });
      if (!ok) issues.push(rule.message);
    } catch (err) {
      issues.push(`Rule "${rule.message}" could not be evaluated: ${(err as Error).message}`);
    }
  }

  if (issues.length || !validation.judge) return { passed: issues.length === 0, issues };

  const minConfidence = validation.judge.minConfidence ?? 0.7;
  let taskInput: unknown = input.config;
  let attachments: Attachment[] | undefined;
  let documentText = '';
  if (input.taskType === 'openjev.extract') {
    const doc = await loadDocument(input.config.document as DocumentRef, loadConnection);
    taskInput = { ...input.config, document: '(see source document)' };
    if (doc.kind === 'file') attachments = [doc.attachment];
    else documentText = `\n\nSource document:\n<document>\n${doc.text}\n</document>`;
  }
  const verdict = await client.generate({
    system:
      'You are an independent reviewer of another model\'s work. Be strict: fail anything unsupported by the inputs, ' +
      'internally inconsistent, or where the reasoning does not justify the output.',
    attachments,
    prompt: [
      `Task type: ${input.taskType}`,
      `Task input:\n${JSON.stringify(taskInput, null, 2)}${documentText}`,
      `Output under review:\n${JSON.stringify(output, null, 2)}`,
      `Stated reasoning:\n${result.reasoning ?? '(none given)'}`,
      `Acceptance criteria:\n${validation.judge.criteria ?? 'The output is correct, complete and justified by the input.'}`,
    ].join('\n\n'),
    schema: {
      type: 'object',
      properties: {
        passed: { type: 'boolean' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        issues: { type: 'array', items: { type: 'string' } },
        reasoning: { type: 'string' },
      },
      required: ['passed', 'confidence', 'issues', 'reasoning'],
    },
    schemaName: 'review',
    temperature: 0,
  });
  const v = verdict.json as { passed: boolean; confidence: number; issues: string[]; reasoning: string };

  if (!v.passed) issues.push(...(v.issues?.length ? v.issues : ['Reviewer rejected the output']));
  else if (v.confidence < minConfidence) {
    issues.push(`Reviewer confidence ${v.confidence.toFixed(2)} is below the ${minConfidence} threshold`);
  }
  return { passed: issues.length === 0, issues, confidence: v.confidence, judgeReasoning: v.reasoning };
}
