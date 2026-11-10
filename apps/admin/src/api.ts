const TOKEN_KEY = 'openjidoka.token';
const ACTOR_KEY = 'openjidoka.actor';

export const session = {
  get token() {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  },
  get actor() {
    return localStorage.getItem(ACTOR_KEY) ?? '';
  },
  save(token: string, actor: string) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ACTOR_KEY, actor);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly body: any) {
    super(message);
  }
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: {
      authorization: `Bearer ${session.token}`,
      ...(session.actor ? { 'x-openjidoka-actor': session.actor } : {}),
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 401) {
    session.clear();
    window.dispatchEvent(new Event('openjidoka:logout'));
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const issues = body?.issues?.map((i: any) => `${i.path?.join('.')}: ${i.message}`).join('; ');
    throw new ApiError(res.status, issues || body?.error || res.statusText, body);
  }
  return body as T;
}

export interface ParseIssue {
  elementId?: string;
  message: string;
}

export interface Workflow {
  id: string;
  key: string;
  name: string;
  description: string;
  draftXml: string;
  archived: boolean;
  latestVersion: number | null;
  updatedAt: string;
  versions?: Array<{ id: string; version: number; publishedBy: string; publishedAt: string }>;
}

export interface Run {
  id: string;
  definitionId: string;
  definitionKey: string;
  definitionName: string;
  version: number;
  status: string;
  input: unknown;
  output: unknown;
  error: string | null;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
}

export interface Step {
  id: string;
  nodeId: string;
  nodeName: string | null;
  taskType: string | null;
  attempt: number;
  status: string;
  input: unknown;
  output: unknown;
  reasoning: string | null;
  validation: { passed: boolean; issues: string[]; confidence?: number; judgeReasoning?: string } | null;
  error: string | null;
  startedAt: string;
  completedAt: string;
}

export interface UserTask {
  id: string;
  runId: string;
  nodeId: string;
  name: string;
  kind: 'user' | 'review';
  assignee: string | null;
  instructions: string | null;
  form: Array<{ name: string; label?: string; type?: string }>;
  context: unknown;
  status: string;
  result: Record<string, unknown> | null;
  completedBy: string | null;
  createdAt: string;
  definitionName?: string;
}

export interface Catalog {
  taskTypes: string[];
  templates: Record<string, Record<string, unknown>>;
  connectors: Array<{
    type: string;
    displayName: string;
    description: string;
    configFields: Array<{ name: string; label: string; required?: boolean; description?: string }>;
    secretDescription?: string;
    actions: Record<string, { description: string; params: Record<string, string> }>;
  }>;
}

export const fmtDate = (v: string | null | undefined) => (v ? new Date(v).toLocaleString() : '—');
