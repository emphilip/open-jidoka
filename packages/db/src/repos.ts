import type { RunStatus, StepStatus, ValidationResult, WorkflowIR } from '@openjidoka/core/types';
import { query, queryOne, withTransaction } from './pool';

// ---------- workflow definitions ----------

export interface DefinitionRow {
  id: string;
  key: string;
  name: string;
  description: string;
  draftXml: string;
  archived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  latestVersion: number | null;
}

const DEFINITION_COLS = `d.id, d.key, d.name, d.description, d.draft_xml AS "draftXml", d.archived,
  d.created_by AS "createdBy", d.created_at AS "createdAt", d.updated_at AS "updatedAt",
  (SELECT max(v.version) FROM workflow_versions v WHERE v.definition_id = d.id) AS "latestVersion"`;

export function listDefinitions(includeArchived = false) {
  return query<DefinitionRow>(
    `SELECT ${DEFINITION_COLS} FROM workflow_definitions d
     WHERE $1 OR NOT d.archived ORDER BY d.updated_at DESC`,
    [includeArchived],
  );
}

export function getDefinition(id: string) {
  return queryOne<DefinitionRow>(`SELECT ${DEFINITION_COLS} FROM workflow_definitions d WHERE d.id = $1`, [id]);
}

export function getDefinitionByKey(key: string) {
  return queryOne<DefinitionRow>(`SELECT ${DEFINITION_COLS} FROM workflow_definitions d WHERE d.key = $1`, [key]);
}

export async function createDefinition(input: {
  key: string;
  name: string;
  description?: string;
  draftXml: string;
  actor: string;
}) {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO workflow_definitions (key, name, description, draft_xml, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.key, input.name, input.description ?? '', input.draftXml, input.actor],
  );
  return (await getDefinition(row!.id))!;
}

export async function updateDefinition(
  id: string,
  patch: { name?: string; description?: string; draftXml?: string; archived?: boolean },
) {
  await query(
    `UPDATE workflow_definitions SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       draft_xml = COALESCE($4, draft_xml),
       archived = COALESCE($5, archived),
       updated_at = now()
     WHERE id = $1`,
    [id, patch.name ?? null, patch.description ?? null, patch.draftXml ?? null, patch.archived ?? null],
  );
  return getDefinition(id);
}

// ---------- versions ----------

export interface VersionRow {
  id: string;
  definitionId: string;
  version: number;
  bpmnXml: string;
  ir: WorkflowIR;
  publishedBy: string;
  publishedAt: string;
}

const VERSION_COLS = `id, definition_id AS "definitionId", version, bpmn_xml AS "bpmnXml", ir,
  published_by AS "publishedBy", published_at AS "publishedAt"`;

export function listVersions(definitionId: string) {
  return query<Omit<VersionRow, 'bpmnXml' | 'ir'>>(
    `SELECT id, definition_id AS "definitionId", version, published_by AS "publishedBy", published_at AS "publishedAt"
     FROM workflow_versions WHERE definition_id = $1 ORDER BY version DESC`,
    [definitionId],
  );
}

export function getVersion(definitionId: string, version?: number) {
  return version === undefined
    ? queryOne<VersionRow>(
        `SELECT ${VERSION_COLS} FROM workflow_versions WHERE definition_id = $1 ORDER BY version DESC LIMIT 1`,
        [definitionId],
      )
    : queryOne<VersionRow>(`SELECT ${VERSION_COLS} FROM workflow_versions WHERE definition_id = $1 AND version = $2`, [
        definitionId,
        version,
      ]);
}

export function getVersionById(id: string) {
  return queryOne<VersionRow>(`SELECT ${VERSION_COLS} FROM workflow_versions WHERE id = $1`, [id]);
}

export function createVersion(input: { definitionId: string; xml: string; ir: WorkflowIR; actor: string }) {
  return withTransaction(async (client) => {
    await client.query('SELECT id FROM workflow_definitions WHERE id = $1 FOR UPDATE', [input.definitionId]);
    const { rows } = await client.query<VersionRow>(
      `INSERT INTO workflow_versions (definition_id, version, bpmn_xml, ir, published_by)
       VALUES ($1, COALESCE((SELECT max(version) FROM workflow_versions WHERE definition_id = $1), 0) + 1, $2, $3, $4)
       RETURNING ${VERSION_COLS}`,
      [input.definitionId, input.xml, JSON.stringify(input.ir), input.actor],
    );
    return rows[0]!;
  });
}

// ---------- runs ----------

export interface RunRow {
  id: string;
  definitionId: string;
  definitionKey: string;
  definitionName: string;
  versionId: string;
  version: number;
  status: RunStatus;
  input: Record<string, unknown>;
  output: unknown;
  error: string | null;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
}

const RUN_COLS = `r.id, r.definition_id AS "definitionId", d.key AS "definitionKey", d.name AS "definitionName",
  r.version_id AS "versionId", v.version, r.status, r.input, r.output, r.error, r.triggered_by AS "triggeredBy",
  r.started_at AS "startedAt", r.completed_at AS "completedAt"`;
const RUN_FROM = `workflow_runs r JOIN workflow_definitions d ON d.id = r.definition_id JOIN workflow_versions v ON v.id = r.version_id`;

export async function createRun(input: {
  id: string;
  definitionId: string;
  versionId: string;
  input: Record<string, unknown>;
  triggeredBy: string;
}) {
  await query(
    `INSERT INTO workflow_runs (id, definition_id, version_id, status, input, triggered_by)
     VALUES ($1, $2, $3, 'pending', $4, $5)`,
    [input.id, input.definitionId, input.versionId, JSON.stringify(input.input), input.triggeredBy],
  );
}

const TERMINAL: RunStatus[] = ['completed', 'failed', 'cancelled', 'terminated'];

/** Terminal statuses are sticky so retried or late status writes cannot resurrect a finished run. */
export async function updateRunStatus(id: string, status: RunStatus, extra: { output?: unknown; error?: string } = {}) {
  await query(
    `UPDATE workflow_runs SET
       status = $2,
       output = COALESCE($3, output),
       error = COALESCE($4, error),
       completed_at = CASE WHEN $2 = ANY($5::text[]) THEN COALESCE(completed_at, now()) ELSE completed_at END
     WHERE id = $1 AND NOT (status = ANY($5::text[]))`,
    [id, status, extra.output === undefined ? null : JSON.stringify(extra.output), extra.error ?? null, TERMINAL],
  );
}

export function listRuns(filter: { definitionId?: string; status?: RunStatus; limit?: number }) {
  return query<RunRow>(
    `SELECT ${RUN_COLS} FROM ${RUN_FROM}
     WHERE ($1::uuid IS NULL OR r.definition_id = $1) AND ($2::text IS NULL OR r.status = $2)
     ORDER BY r.started_at DESC LIMIT $3`,
    [filter.definitionId ?? null, filter.status ?? null, Math.min(filter.limit ?? 50, 500)],
  );
}

export function getRun(id: string) {
  return queryOne<RunRow>(`SELECT ${RUN_COLS} FROM ${RUN_FROM} WHERE r.id = $1`, [id]);
}

// ---------- step executions ----------

export interface StepRow {
  id: string;
  runId: string;
  nodeId: string;
  nodeName: string | null;
  taskType: string | null;
  attempt: number;
  status: StepStatus;
  input: unknown;
  output: unknown;
  reasoning: string | null;
  validation: ValidationResult | null;
  error: string | null;
  startedAt: string;
  completedAt: string;
}

export interface StepInsert {
  runId: string;
  nodeId: string;
  nodeName?: string;
  taskType?: string;
  attempt?: number;
  status: StepStatus;
  input?: unknown;
  output?: unknown;
  reasoning?: string;
  validation?: ValidationResult;
  error?: string;
  startedAt: string;
}

const json = (v: unknown) => (v === undefined ? null : JSON.stringify(v));

export async function insertStep(step: StepInsert) {
  await query(
    `INSERT INTO step_executions (run_id, node_id, node_name, task_type, attempt, status, input, output, reasoning, validation, error, started_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      step.runId,
      step.nodeId,
      step.nodeName ?? null,
      step.taskType ?? null,
      step.attempt ?? 1,
      step.status,
      json(step.input),
      json(step.output),
      step.reasoning ?? null,
      json(step.validation),
      step.error ?? null,
      step.startedAt,
    ],
  );
}

export function listSteps(runId: string) {
  return query<StepRow>(
    `SELECT id, run_id AS "runId", node_id AS "nodeId", node_name AS "nodeName", task_type AS "taskType", attempt,
       status, input, output, reasoning, validation, error, started_at AS "startedAt", completed_at AS "completedAt"
     FROM step_executions WHERE run_id = $1 ORDER BY started_at, completed_at`,
    [runId],
  );
}

// ---------- user tasks ----------

export interface UserTaskRow {
  id: string;
  runId: string;
  nodeId: string;
  name: string;
  kind: 'user' | 'review';
  assignee: string | null;
  candidateGroups: string[];
  instructions: string | null;
  form: unknown[];
  context: unknown;
  status: 'open' | 'completed' | 'cancelled';
  result: Record<string, unknown> | null;
  completedBy: string | null;
  createdAt: string;
  completedAt: string | null;
  definitionName?: string;
}

const TASK_COLS = `t.id, t.run_id AS "runId", t.node_id AS "nodeId", t.name, t.kind, t.assignee,
  t.candidate_groups AS "candidateGroups", t.instructions, t.form, t.context, t.status, t.result,
  t.completed_by AS "completedBy", t.created_at AS "createdAt", t.completed_at AS "completedAt"`;

export async function createUserTask(task: {
  id: string;
  runId: string;
  nodeId: string;
  name: string;
  kind: 'user' | 'review';
  assignee?: string;
  candidateGroups?: string[];
  instructions?: string;
  form?: unknown[];
  context?: unknown;
}) {
  await query(
    `INSERT INTO user_tasks (id, run_id, node_id, name, kind, assignee, candidate_groups, instructions, form, context, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open') ON CONFLICT (id) DO NOTHING`,
    [
      task.id,
      task.runId,
      task.nodeId,
      task.name,
      task.kind,
      task.assignee ?? null,
      task.candidateGroups ?? [],
      task.instructions ?? null,
      JSON.stringify(task.form ?? []),
      json(task.context),
    ],
  );
}

export function getUserTask(id: string) {
  return queryOne<UserTaskRow>(`SELECT ${TASK_COLS} FROM user_tasks t WHERE t.id = $1`, [id]);
}

export function listUserTasks(filter: { status?: string; runId?: string; assignee?: string }) {
  return query<UserTaskRow>(
    `SELECT ${TASK_COLS}, d.name AS "definitionName" FROM user_tasks t
     JOIN workflow_runs r ON r.id = t.run_id JOIN workflow_definitions d ON d.id = r.definition_id
     WHERE ($1::text IS NULL OR t.status = $1) AND ($2::uuid IS NULL OR t.run_id = $2)
       AND ($3::text IS NULL OR t.assignee = $3)
     ORDER BY t.created_at DESC LIMIT 200`,
    [filter.status ?? null, filter.runId ?? null, filter.assignee ?? null],
  );
}

export async function completeUserTaskRecord(id: string, result: Record<string, unknown>, actor: string) {
  await query(
    `UPDATE user_tasks SET status = 'completed', result = $2, completed_by = $3, completed_at = now()
     WHERE id = $1 AND status = 'open'`,
    [id, JSON.stringify(result), actor],
  );
}

export async function cancelOpenTasksForRun(runId: string) {
  await query(`UPDATE user_tasks SET status = 'cancelled', completed_at = now() WHERE run_id = $1 AND status = 'open'`, [
    runId,
  ]);
}

// ---------- connections ----------

export interface ConnectionRow {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  secretEnv: string | null;
  createdAt: string;
  updatedAt: string;
}

const CONNECTION_COLS = `id, name, type, config, secret_env AS "secretEnv", created_at AS "createdAt", updated_at AS "updatedAt"`;

export function listConnections() {
  return query<ConnectionRow>(`SELECT ${CONNECTION_COLS} FROM connections ORDER BY name`);
}

export function getConnection(id: string) {
  return queryOne<ConnectionRow>(`SELECT ${CONNECTION_COLS} FROM connections WHERE id = $1`, [id]);
}

export function getConnectionByName(name: string) {
  return queryOne<ConnectionRow>(`SELECT ${CONNECTION_COLS} FROM connections WHERE name = $1`, [name]);
}

export async function createConnection(c: { name: string; type: string; config: Record<string, unknown>; secretEnv?: string | null }) {
  return (await queryOne<ConnectionRow>(
    `INSERT INTO connections (name, type, config, secret_env) VALUES ($1,$2,$3,$4) RETURNING ${CONNECTION_COLS}`,
    [c.name, c.type, JSON.stringify(c.config), c.secretEnv ?? null],
  ))!;
}

export function updateConnection(id: string, c: { config?: Record<string, unknown>; secretEnv?: string | null }) {
  return queryOne<ConnectionRow>(
    `UPDATE connections SET config = COALESCE($2, config),
       secret_env = CASE WHEN $3 THEN $4 ELSE secret_env END, updated_at = now()
     WHERE id = $1 RETURNING ${CONNECTION_COLS}`,
    [id, c.config ? JSON.stringify(c.config) : null, c.secretEnv !== undefined, c.secretEnv ?? null],
  );
}

export async function deleteConnection(id: string) {
  await query('DELETE FROM connections WHERE id = $1', [id]);
}

// ---------- audit ----------

export async function writeAudit(actor: string, action: string, entityType: string, entityId?: string, details?: unknown) {
  await query(`INSERT INTO audit_log (actor, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`, [
    actor,
    action,
    entityType,
    entityId ?? null,
    json(details),
  ]);
}

export function listAudit(limit = 100) {
  return query(
    `SELECT id, actor, action, entity_type AS "entityType", entity_id AS "entityId", details, at
     FROM audit_log ORDER BY at DESC LIMIT $1`,
    [Math.min(limit, 1000)],
  );
}
