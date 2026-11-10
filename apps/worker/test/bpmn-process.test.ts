import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { WorkflowFailedError } from '@temporalio/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseBpmn } from '@openjidoka/core/bpmn';
import type { WorkflowIR } from '@openjidoka/core/types';
import type { OpenJevClient } from '@openjidoka/integrations/openjev';
import { MockOpenJevClient } from '@openjidoka/integrations/openjev';
import { createActivities } from '../src/activities';

const workflowsPath = fileURLToPath(new URL('../src/workflows/index.ts', import.meta.url));
let env: TestWorkflowEnvironment;
let invoiceIr: WorkflowIR;

function memoryStore() {
  const steps: any[] = [];
  const runs: Record<string, string> = {};
  const tasks: any[] = [];
  return {
    steps,
    runs,
    tasks,
    store: {
      updateRunStatus: async (id: string, status: string) => void (runs[id] = status),
      insertStep: async (s: any) => void steps.push(s),
      createUserTask: async (t: any) => void tasks.push(t),
      completeUserTaskRecord: async () => {},
      cancelOpenTasksForRun: async () => {},
    } as any,
  };
}

const connectorCalls: any[] = [];
const fakeConnections = async (name: string) => ({
  type: 'http',
  context: {
    config: {},
    fetch: (async () => new Response('{}')) as typeof fetch,
  },
  name,
});

async function runWith(
  ir: WorkflowIR,
  input: Record<string, unknown>,
  openjev: OpenJevClient,
  drive?: (handle: any, mem: ReturnType<typeof memoryStore>) => Promise<void>,
) {
  const mem = memoryStore();
  const activities = createActivities({ openjev, store: mem.store, loadConnection: fakeConnections as any });
  activities.invokeConnector = async (i) => {
    connectorCalls.push(i);
    return { ok: true, action: i.action };
  };
  const taskQueue = `test-${Math.random()}`;
  const worker = await Worker.create({ connection: env.nativeConnection, taskQueue, workflowsPath, activities });
  return worker.runUntil(async () => {
    const handle = await env.client.workflow.start('bpmnProcess', {
      taskQueue,
      workflowId: `run-${Math.random()}`,
      args: [{ runId: 'run-1', ir, input }],
    });
    if (drive) await drive(handle, mem);
    try {
      return { result: await handle.result(), mem };
    } catch (error) {
      return { error, mem };
    }
  });
}

async function waitFor<T>(fn: () => T | undefined, ms = 10_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
}

beforeAll(async () => {
  env = await TestWorkflowEnvironment.createTimeSkipping();
  const xml = await readFile(new URL('../../../examples/invoice-approval.bpmn', import.meta.url), 'utf8');
  invoiceIr = (await parseBpmn(xml, 'invoice')).ir!;
}, 120_000);

afterAll(async () => {
  await env?.teardown();
});

describe('bpmnProcess', () => {
  it('auto-approves a valid low value invoice through the parallel archive branch', async () => {
    connectorCalls.length = 0;
    const { result, mem, error } = await runWith(
      invoiceIr,
      { document: { text: 'Invoice INV-1 from Acme, total 1250 CAD' } },
      new MockOpenJevClient(),
    );
    expect(error).toBeUndefined();
    expect((result as any).decision.choice).toBe('approve');
    expect(connectorCalls.map((c) => c.action).sort()).toEqual(['postMessage', 'uploadFile']);
    expect(connectorCalls.find((c) => c.action === 'uploadFile').params.filename).toBe('sample-invoiceNumber.json');
    expect(mem.runs['run-1']).toBe('completed');
    expect(mem.steps.filter((s) => s.nodeId === 'extract')[0].validation.passed).toBe(true);
  }, 60_000);

  it('retries with feedback, then escalates to human review when validation keeps failing', async () => {
    const prompts: string[] = [];
    const badTotal: OpenJevClient = {
      mode: 'test',
      async generate(req) {
        prompts.push(req.prompt);
        if (req.schemaName === 'extraction') {
          const json = { result: { invoiceNumber: 'INV-9', vendor: 'Acme', total: -5, currency: 'CAD' }, reasoning: 'r' };
          return { text: '', json, model: 'test' };
        }
        return new MockOpenJevClient().generate(req);
      },
    };
    const { result, mem } = await runWith(
      invoiceIr,
      { document: { text: 'doc' } },
      badTotal,
      async (handle, m) => {
        const review = await waitFor(() => m.tasks.find((t) => t.kind === 'review'));
        expect(review.context.issues).toContain('Total must be positive');
        await handle.signal('completeUserTask', {
          taskId: review.id,
          actor: 'reviewer@example.com',
          approved: true,
          result: { output: { invoiceNumber: 'INV-9', vendor: 'Acme', total: 50, currency: 'CAD' } },
        });
      },
    );
    expect((result as any).invoice.total).toBe(50);
    const attempts = mem.steps.filter((s) => s.nodeId === 'extract');
    expect(attempts).toHaveLength(3);
    expect(attempts.every((a) => a.status === 'validation_failed')).toBe(true);
    expect(prompts.some((p) => p.includes('failed validation') && p.includes('Total must be positive'))).toBe(true);
  }, 60_000);

  it('waits for the approver when the decision routes to review and ends on rejection', async () => {
    connectorCalls.length = 0;
    const reviewer: OpenJevClient = {
      mode: 'test',
      async generate(req) {
        if (req.schemaName === 'decision') {
          return { text: '', json: { choice: 'review', confidence: 0.95, reasoning: 'new vendor' }, model: 'test' };
        }
        return new MockOpenJevClient().generate(req);
      },
    };
    const { result } = await runWith(invoiceIr, { document: { text: 'doc' } }, reviewer, async (handle, m) => {
      const task = await waitFor(() => m.tasks.find((t) => t.nodeId === 'approve'));
      expect(task.instructions).toContain('sample-invoiceNumber');
      await handle.signal('completeUserTask', {
        taskId: task.id,
        actor: 'approver@example.com',
        approved: false,
        result: { comment: 'Duplicate invoice' },
      });
    });
    expect((result as any).approval.approved).toBe(false);
    expect(connectorCalls.map((c) => c.action)).toEqual(['postMessage']);
    expect(connectorCalls[0].params.text).toContain('Duplicate invoice');
  }, 60_000);

  it('fails instead of silently completing when a parallel join can never fire', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="defs" targetNamespace="t">
  <bpmn:process id="p" isExecutable="true">
    <bpmn:startEvent id="s" />
    <bpmn:exclusiveGateway id="x" default="toJoin1" />
    <bpmn:parallelGateway id="join" />
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="a" sourceRef="s" targetRef="x" />
    <bpmn:sequenceFlow id="toJoin1" sourceRef="x" targetRef="join" />
    <bpmn:sequenceFlow id="toJoin2" sourceRef="x" targetRef="join"><bpmn:conditionExpression>false</bpmn:conditionExpression></bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="b" sourceRef="join" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;
    const parsed = await parseBpmn(xml, 'stuck');
    const { error, mem } = await runWith(parsed.ir!, {}, new MockOpenJevClient());
    expect(error).toBeInstanceOf(WorkflowFailedError);
    expect(String((error as any).cause?.message)).toContain('only 1 arrived');
    expect(mem.runs['run-1']).toBe('failed');
  }, 60_000);

  it('fails the run cleanly when a gateway expression errors at runtime', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:jidoka="http://openjidoka.dev/schema/bpmn/1.0" id="defs" targetNamespace="t">
  <bpmn:process id="p" isExecutable="true">
    <bpmn:startEvent id="s" />
    <bpmn:intermediateCatchEvent id="wait"><bpmn:timerEventDefinition><bpmn:timeDuration>P2D</bpmn:timeDuration></bpmn:timerEventDefinition></bpmn:intermediateCatchEvent>
    <bpmn:scriptTask id="calc"><bpmn:extensionElements><jidoka:taskConfig taskType="transform" resultVariable="x">{"expression": "$number('abc')"}</jidoka:taskConfig></bpmn:extensionElements></bpmn:scriptTask>
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="a" sourceRef="s" targetRef="wait" />
    <bpmn:sequenceFlow id="b" sourceRef="wait" targetRef="calc" />
    <bpmn:sequenceFlow id="c" sourceRef="calc" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;
    const parsed = await parseBpmn(xml, 'broken');
    expect(parsed.errors).toEqual([]);
    const { error, mem } = await runWith(parsed.ir!, {}, new MockOpenJevClient());
    expect(error).toBeInstanceOf(WorkflowFailedError);
    expect(mem.runs['run-1']).toBe('failed');
    expect(mem.steps.find((s) => s.nodeId === 'calc').status).toBe('failed');
  }, 60_000);
});
