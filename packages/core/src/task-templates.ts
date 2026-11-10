import type { TaskType } from './types';

/** Starter config inserted by the modeler when a task type is chosen. */
export const TASK_TEMPLATES: Record<TaskType | 'user', Record<string, unknown>> = {
  'openjev.prompt': {
    system: 'You are a careful analyst.',
    prompt: 'Summarise the following request: {{ input.request }}',
    outputSchema: {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
    },
    validation: {
      maxAttempts: 2,
      judge: { criteria: 'The summary is faithful to the request and invents nothing.', minConfidence: 0.7 },
      onFailure: 'humanReview',
    },
  },
  'openjev.extract': {
    document: { url: '=input.documentUrl' },
    instructions: 'Extract the invoice header fields.',
    schema: {
      type: 'object',
      properties: {
        invoiceNumber: { type: 'string' },
        vendor: { type: 'string' },
        total: { type: 'number' },
        currency: { type: 'string' },
      },
      required: ['invoiceNumber', 'vendor', 'total'],
    },
    validation: {
      maxAttempts: 3,
      rules: [{ expr: 'output.total > 0', message: 'Total must be positive' }],
      judge: { criteria: 'Every field is present in the document verbatim.', minConfidence: 0.8 },
      onFailure: 'humanReview',
    },
  },
  'openjev.decide': {
    question: 'Should this request be auto-approved?',
    options: ['approve', 'review', 'reject'],
    context: '=vars',
    validation: {
      maxAttempts: 2,
      rules: [{ expr: 'output.confidence >= 0.6', message: 'Decision confidence too low' }],
      onFailure: 'humanReview',
    },
  },
  connector: {
    connection: 'my-connection',
    action: 'request',
    params: {},
    retry: { maximumAttempts: 5, initialInterval: '2s' },
  },
  transform: {
    expression: '{ "total": vars.invoice.total * 1.13 }',
  },
  user: {
    assignee: 'finance-approver@example.com',
    instructions: 'Review and approve the invoice.',
    form: [
      { name: 'comment', label: 'Comment', type: 'text' },
    ],
    context: '=vars',
  },
};
