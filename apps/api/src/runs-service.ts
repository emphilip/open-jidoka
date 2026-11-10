import { randomUUID } from 'node:crypto';
import type { RunStatus, RunState } from '@openjidoka/core/types';
import * as db from '@openjidoka/db';
import { getTemporal, temporalConfig } from './temporal';

export class HttpError extends Error {
  constructor(readonly statusCode: number, message: string, readonly details?: unknown) {
    super(message);
  }
}

export async function startRun(opts: {
  definition: db.DefinitionRow;
  version?: number;
  input: Record<string, unknown>;
  actor: string;
}) {
  if (opts.definition.archived) throw new HttpError(409, 'Workflow is archived');
  const version = await db.getVersion(opts.definition.id, opts.version);
  if (!version) throw new HttpError(409, 'Workflow has no published version');

  const id = randomUUID();
  await db.createRun({ id, definitionId: opts.definition.id, versionId: version.id, input: opts.input, triggeredBy: opts.actor });
  try {
    const temporal = await getTemporal();
    await temporal.workflow.start('bpmnProcess', {
      taskQueue: temporalConfig.taskQueue,
      workflowId: id,
      args: [{ runId: id, ir: version.ir, input: opts.input }],
      memo: { workflowKey: opts.definition.key, version: version.version },
    });
  } catch (err) {
    await db.updateRunStatus(id, 'failed', { error: `Could not start: ${(err as Error).message}` });
    throw new HttpError(503, `Temporal is unavailable: ${(err as Error).message}`);
  }
  await db.writeAudit(opts.actor, 'run.start', 'run', id, { workflow: opts.definition.key, version: version.version });
  return { id, version: version.version };
}

const CLOSED: Record<string, RunStatus> = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TERMINATED: 'terminated',
  TIMED_OUT: 'failed',
  CONTINUED_AS_NEW: 'running',
};

/** Temporal is the source of truth; reconcile runs that ended without the worker recording it (e.g. terminate). */
export async function liveRunState(run: db.RunRow): Promise<{ run: db.RunRow; state?: RunState; temporalStatus?: string }> {
  if (run.status !== 'pending' && run.status !== 'running') return { run };
  try {
    const handle = (await getTemporal()).workflow.getHandle(run.id);
    const description = await handle.describe();
    const temporalStatus = description.status.name;
    const closed = CLOSED[temporalStatus];
    if (closed && closed !== 'running') {
      await db.updateRunStatus(run.id, closed, closed === 'completed' ? {} : { error: `Workflow ${temporalStatus.toLowerCase()}` });
      await db.cancelOpenTasksForRun(run.id);
      return { run: (await db.getRun(run.id))!, temporalStatus };
    }
    const state = await handle.query<RunState>('state').catch(() => undefined);
    return { run, state, temporalStatus };
  } catch {
    return { run };
  }
}
