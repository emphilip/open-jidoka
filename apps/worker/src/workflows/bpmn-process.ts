import {
  ApplicationFailure,
  CancellationScope,
  condition,
  defineQuery,
  defineSignal,
  isCancellation,
  proxyActivities,
  proxyLocalActivities,
  setHandler,
  sleep,
  TemporalFailure,
  uuid4,
} from '@temporalio/workflow';
import { evaluate, evaluateCondition, resolveValue } from '@openjidoka/core/expressions';
import {
  AI_TASK_TYPES,
  type AiTaskResult,
  type ConnectorTaskConfig,
  type FlowNode,
  type ProcessInput,
  type RetryConfig,
  type RunState,
  type UserTaskCompletion,
  type UserTaskConfig,
  type ValidationConfig,
  type ValidationResult,
} from '@openjidoka/core/types';
import type { Activities } from '../activities';

export const completeUserTaskSignal = defineSignal<[UserTaskCompletion]>('completeUserTask');
export const stateQuery = defineQuery<RunState>('state');

const MAX_NODE_EXECUTIONS = 5_000;

const bookkeeping = proxyLocalActivities<Activities>({
  startToCloseTimeout: '30 seconds',
  retry: { initialInterval: '1s', maximumInterval: '1 minute', backoffCoefficient: 2 },
});

function taskActivities(retry: RetryConfig | undefined, defaultTimeout: string) {
  return proxyActivities<Activities>({
    startToCloseTimeout: (retry?.startToCloseTimeout ?? defaultTimeout) as any,
    retry: {
      maximumAttempts: retry?.maximumAttempts ?? 5,
      initialInterval: (retry?.initialInterval ?? '2s') as any,
      backoffCoefficient: retry?.backoffCoefficient ?? 2,
      maximumInterval: (retry?.maximumInterval ?? '5 minutes') as any,
    },
  });
}

const now = () => new Date().toISOString();
const messageOf = (err: unknown) => {
  const e = err as { message?: string; cause?: { message?: string } } | undefined;
  const cause = e?.cause?.message && e.cause.message !== e.message ? `: ${e.cause.message}` : '';
  return e?.message ? `${e.message}${cause}` : String(err);
};

/**
 * Generic BPMN interpreter. Each run receives the immutable IR of the version it was started with,
 * so publishing a new version never changes in-flight runs.
 */
export async function bpmnProcess({ runId, ir, input }: ProcessInput): Promise<Record<string, unknown>> {
  const vars: Record<string, unknown> = {};
  const nodeResults: Record<string, unknown> = {};
  const active = new Map<string, number>();
  const completed = new Set<string>();
  const failed = new Set<string>();
  const joinArrivals = new Map<string, number>();
  const pendingTasks = new Set<string>();
  const completions = new Map<string, UserTaskCompletion>();
  let executions = 0;

  const context = () => ({ input, vars, nodes: nodeResults, run: { id: runId, workflow: ir.key } });

  setHandler(completeUserTaskSignal, (completion) => {
    if (pendingTasks.has(completion.taskId) && !completions.has(completion.taskId)) {
      completions.set(completion.taskId, completion);
    }
  });
  setHandler(stateQuery, () => ({
    activeNodeIds: [...active.keys()],
    completedNodeIds: [...completed],
    failedNodeIds: [...failed],
    vars,
  }));

  async function waitForUserTask(
    node: FlowNode,
    task: { kind: 'user' | 'review'; name: string; config: UserTaskConfig; context?: unknown },
  ): Promise<UserTaskCompletion> {
    const taskId = uuid4();
    pendingTasks.add(taskId);
    await bookkeeping.createUserTask({
      id: taskId,
      runId,
      nodeId: node.id,
      name: task.name,
      kind: task.kind,
      assignee: task.config.assignee,
      candidateGroups: task.config.candidateGroups,
      instructions: task.config.instructions,
      form: task.config.form,
      context: task.context,
    });
    await condition(() => completions.has(taskId));
    pendingTasks.delete(taskId);
    const completion = completions.get(taskId)!;
    await bookkeeping.closeUserTask({
      taskId,
      actor: completion.actor,
      result: { ...completion.result, approved: completion.approved },
    });
    return completion;
  }

  async function runAiNode(node: FlowNode): Promise<unknown> {
    const { validation, retry, ...rest } = node.config as { validation?: ValidationConfig; retry?: RetryConfig };
    const config = (await resolveValue(rest, context())) as Record<string, unknown>;
    const ai = taskActivities(retry, '10 minutes');
    const maxAttempts = Math.max(1, validation?.maxAttempts ?? (validation ? 2 : 1));
    const label = node.name ?? node.id;

    let feedback: string[] = [];
    let last: AiTaskResult | undefined;
    let lastCheck: ValidationResult = { passed: true, issues: [] };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startedAt = now();
      last = await ai.runAiTask({ taskType: node.taskType!, config, feedback });
      lastCheck = validation
        ? await ai.validateAiResult({ taskType: node.taskType!, config, result: last, validation, context: context() })
        : { passed: true, issues: [] };
      await bookkeeping.recordStep({
        runId,
        nodeId: node.id,
        nodeName: node.name,
        taskType: node.taskType,
        attempt,
        status: lastCheck.passed ? 'completed' : 'validation_failed',
        input: config,
        output: last.output,
        reasoning: last.reasoning,
        validation: validation ? lastCheck : undefined,
        startedAt,
      });
      if (lastCheck.passed) return last.output;
      feedback = lastCheck.issues;
    }

    switch (validation?.onFailure ?? 'fail') {
      case 'continue':
        return last!.output;
      case 'humanReview': {
        const review = await waitForUserTask(node, {
          kind: 'review',
          name: `Review: ${label}`,
          config: {
            assignee: validation?.reviewAssignee,
            instructions: `OpenJEV output for "${label}" failed validation after ${maxAttempts} attempt(s). Approve it as is, approve with a corrected output, or reject to fail the run.`,
            form: [
              { name: 'output', label: 'Corrected output (JSON, optional)', type: 'json' },
              { name: 'comment', label: 'Comment', type: 'text' },
            ],
          },
          context: { output: last!.output, reasoning: last!.reasoning, issues: lastCheck.issues, input: config },
        });
        if (review.approved === false) {
          throw ApplicationFailure.nonRetryable(`Reviewer ${review.actor} rejected the output of "${label}"`, 'ReviewRejected');
        }
        return review.result.output !== undefined ? review.result.output : last!.output;
      }
      default:
        throw ApplicationFailure.nonRetryable(
          `Validation failed for "${label}": ${lastCheck.issues.join('; ')}`,
          'ValidationFailed',
        );
    }
  }

  async function executeNode(node: FlowNode): Promise<unknown> {
    switch (node.type) {
      case 'startEvent':
      case 'endEvent':
      case 'exclusiveGateway':
      case 'parallelGateway':
        return undefined;
      case 'timerEvent':
        await sleep(node.timerMs!);
        return undefined;
      case 'userTask': {
        const config = (await resolveValue(node.config, context())) as UserTaskConfig;
        const c = await waitForUserTask(node, { kind: 'user', name: node.name ?? node.id, config, context: config.context });
        return { ...c.result, approved: c.approved, actor: c.actor };
      }
      case 'serviceTask':
        break;
    }

    if (AI_TASK_TYPES.includes(node.taskType!)) return runAiNode(node);

    if (node.taskType === 'transform') {
      return evaluate(node.config.expression as string, context());
    }

    if (node.taskType === 'connector') {
      const { retry, ...rest } = node.config as unknown as ConnectorTaskConfig;
      const resolved = (await resolveValue(rest, context())) as ConnectorTaskConfig;
      return taskActivities(retry, '2 minutes').invokeConnector({
        connection: resolved.connection,
        action: resolved.action,
        params: resolved.params,
      });
    }

    throw ApplicationFailure.nonRetryable(`Unsupported task type ${node.taskType}`);
  }

  async function runStep(node: FlowNode) {
    const startedAt = now();
    active.set(node.id, (active.get(node.id) ?? 0) + 1);
    try {
      const result = await executeNode(node);
      if (node.type === 'serviceTask' || node.type === 'userTask') {
        nodeResults[node.id] = result;
        if (node.resultVariable) vars[node.resultVariable] = result;
      }
      const recorded = node.type === 'userTask' || node.taskType === 'connector' || node.taskType === 'transform';
      if (recorded) {
        await bookkeeping.recordStep({
          runId,
          nodeId: node.id,
          nodeName: node.name,
          taskType: node.taskType ?? node.type,
          status: 'completed',
          output: result,
          startedAt,
        });
      }
      completed.add(node.id);
    } catch (err) {
      if (!isCancellation(err)) {
        failed.add(node.id);
        await bookkeeping.recordStep({
          runId,
          nodeId: node.id,
          nodeName: node.name,
          taskType: node.taskType ?? node.type,
          status: 'failed',
          error: messageOf(err),
          startedAt,
        });
      }
      throw err;
    } finally {
      const n = active.get(node.id)! - 1;
      if (n <= 0) active.delete(node.id);
      else active.set(node.id, n);
    }
  }

  async function nextNodes(node: FlowNode): Promise<string[]> {
    const outgoing = node.outgoing.map((id) => ir.flows[id]!);
    if (node.type === 'exclusiveGateway') {
      for (const flow of outgoing) {
        if (flow.id === node.defaultFlow) continue;
        if (!flow.condition || (await evaluateCondition(flow.condition, context()))) return [flow.target];
      }
      const fallback = node.defaultFlow && ir.flows[node.defaultFlow];
      if (fallback) return [fallback.target];
      throw ApplicationFailure.nonRetryable(`No outgoing flow of gateway "${node.name ?? node.id}" matched`, 'NoMatchingFlow');
    }
    if (node.type === 'parallelGateway') return outgoing.map((f) => f.target);
    const targets: string[] = [];
    for (const flow of outgoing) {
      if (!flow.condition || (await evaluateCondition(flow.condition, context()))) targets.push(flow.target);
    }
    return targets;
  }

  async function runToken(startId: string): Promise<void> {
    let current: string | undefined = startId;
    while (current) {
      const node: FlowNode = ir.nodes[current]!;
      if (node.type === 'parallelGateway' && node.incoming.length > 1) {
        const arrived = (joinArrivals.get(node.id) ?? 0) + 1;
        if (arrived < node.incoming.length) {
          joinArrivals.set(node.id, arrived);
          return;
        }
        joinArrivals.set(node.id, 0);
      }
      if (++executions > MAX_NODE_EXECUTIONS) {
        throw ApplicationFailure.nonRetryable(`Run exceeded ${MAX_NODE_EXECUTIONS} node executions, check for loops`);
      }
      await runStep(node);
      const next = await nextNodes(node);
      if (next.length === 1) current = next[0];
      else {
        await Promise.all(next.map(runToken));
        return;
      }
    }
  }

  await bookkeeping.recordRunStatus({ runId, status: 'running' });
  try {
    await Promise.all(ir.startNodeIds.map(runToken));
    for (const [id, arrived] of joinArrivals) {
      if (arrived > 0) {
        const node = ir.nodes[id]!;
        throw ApplicationFailure.nonRetryable(
          `Parallel gateway "${node.name ?? id}" is waiting for ${node.incoming.length} incoming flows but only ${arrived} arrived. Use an exclusive gateway to merge alternative paths.`,
          'StuckParallelJoin',
        );
      }
    }
  } catch (err) {
    if (isCancellation(err)) {
      await CancellationScope.nonCancellable(() => bookkeeping.recordRunStatus({ runId, status: 'cancelled' }));
      throw err;
    }
    await bookkeeping.recordRunStatus({ runId, status: 'failed', error: messageOf(err) });
    // Plain errors (e.g. a JSONata runtime error) would otherwise retry the workflow task forever.
    if (err instanceof TemporalFailure) throw err;
    throw ApplicationFailure.nonRetryable(messageOf(err), 'WorkflowDefinitionError');
  }
  await bookkeeping.recordRunStatus({ runId, status: 'completed', output: vars });
  return vars;
}
