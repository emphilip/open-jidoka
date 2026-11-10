import jsonata from 'jsonata';

/**
 * Expression helpers shared by the parser, workflow sandbox and activities.
 * Must stay free of I/O and Node APIs so it can run inside Temporal workflow code.
 *
 * Value resolution rules for task config:
 *  - a string starting with "=" is a JSONata expression: "=input.invoice.total"
 *  - a string containing "{{ expr }}" is a template, each placeholder is a JSONata expression
 *  - arrays and objects are resolved recursively, everything else passes through
 */

export async function evaluate(expression: string, data: unknown): Promise<unknown> {
  return jsonata(expression).evaluate(data);
}

export async function evaluateCondition(expression: string, data: unknown): Promise<boolean> {
  const result = await evaluate(expression, data);
  return Boolean(result);
}

export function checkSyntax(expression: string): string | undefined {
  try {
    jsonata(expression);
    return undefined;
  } catch (err) {
    return (err as { message?: string }).message ?? String(err);
  }
}

const TEMPLATE = /\{\{([\s\S]+?)\}\}/g;

function stringify(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export async function resolveValue(value: unknown, data: unknown): Promise<unknown> {
  if (typeof value === 'string') {
    if (value.startsWith('=')) return evaluate(value.slice(1), data);
    if (!value.includes('{{')) return value;
    const parts: string[] = [];
    let last = 0;
    for (const match of value.matchAll(TEMPLATE)) {
      parts.push(value.slice(last, match.index));
      parts.push(stringify(await evaluate(match[1]!.trim(), data)));
      last = match.index! + match[0].length;
    }
    parts.push(value.slice(last));
    return parts.join('');
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) out.push(await resolveValue(item, data));
    return out;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await resolveValue(v, data);
    return out;
  }
  return value;
}

/** Collects every expression embedded in a config value, used for publish-time syntax checks. */
export function collectExpressions(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') {
    if (value.startsWith('=')) acc.push(value.slice(1));
    else for (const m of value.matchAll(TEMPLATE)) acc.push(m[1]!.trim());
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectExpressions(v, acc));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectExpressions(v, acc));
  }
  return acc;
}
