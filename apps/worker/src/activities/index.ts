import type { RunStatus } from '@openjidoka/core/types';
import * as db from '@openjidoka/db';
import type { OpenJevClient } from '@openjidoka/integrations/openjev';
import { runAiTask, type AiTaskInput } from './ai';
import { loadConnectionFromDb, runConnectorAction, type ConnectionLoader } from './connector';
import { asActivity } from './failures';
import { validateAiResult, type ValidateInput } from './validation';

export interface ActivityDeps {
  openjev: OpenJevClient;
  loadConnection?: ConnectionLoader;
  store?: Pick<
    typeof db,
    'updateRunStatus' | 'insertStep' | 'createUserTask' | 'completeUserTaskRecord' | 'cancelOpenTasksForRun'
  >;
}

export function createActivities({ openjev, loadConnection = loadConnectionFromDb, store = db }: ActivityDeps) {
  return {
    runAiTask: (input: AiTaskInput) => asActivity(() => runAiTask(openjev, loadConnection, input)),

    validateAiResult: (input: ValidateInput) => asActivity(() => validateAiResult(openjev, loadConnection, input)),

    invokeConnector: (input: { connection: string; action: string; params?: Record<string, unknown> }) =>
      asActivity(() => runConnectorAction(loadConnection, input)),

    async recordRunStatus(input: { runId: string; status: RunStatus; output?: unknown; error?: string }) {
      await store.updateRunStatus(input.runId, input.status, { output: input.output, error: input.error });
      if (input.status !== 'running') await store.cancelOpenTasksForRun(input.runId);
    },

    async recordStep(step: db.StepInsert) {
      await store.insertStep(step);
    },

    async createUserTask(task: Parameters<typeof db.createUserTask>[0]) {
      await store.createUserTask(task);
    },

    async closeUserTask(input: { taskId: string; result: Record<string, unknown>; actor: string }) {
      await store.completeUserTaskRecord(input.taskId, input.result, input.actor);
    },
  };
}

export type Activities = ReturnType<typeof createActivities>;
