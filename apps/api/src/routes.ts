import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseBpmn } from '@openjidoka/core/bpmn';
import { TASK_TEMPLATES } from '@openjidoka/core/task-templates';
import { TASK_TYPES } from '@openjidoka/core/types';
import * as db from '@openjidoka/db';
import { connectorCatalog, connectors } from '@openjidoka/integrations/connectors';
import { emptyProcessXml, layoutForDisplay } from './bpmn-utils';
import { HttpError, liveRunState, startRun } from './runs-service';
import { getTemporal } from './temporal';

const slug = z.string().regex(/^[a-z0-9][a-z0-9_-]{1,62}$/, 'lowercase letters, digits, - and _, 2-63 chars');
const uuid = z.string().uuid();
const idParams = z.object({ id: uuid });
const jsonObject = z.record(z.string(), z.unknown());

async function requireDefinition(id: string) {
  const def = await db.getDefinition(id);
  if (!def) throw new HttpError(404, 'Workflow not found');
  return def;
}

export async function registerRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => ({ ok: true }));

  // ---------- catalogue ----------

  app.get('/api/catalog', async () => ({
    taskTypes: TASK_TYPES,
    templates: TASK_TEMPLATES,
    connectors: connectorCatalog(),
  }));

  // ---------- workflows ----------

  app.get('/api/workflows', async (req) => {
    const { archived } = z.object({ archived: z.coerce.boolean().optional() }).parse(req.query);
    return db.listDefinitions(archived);
  });

  app.post('/api/workflows', async (req, reply) => {
    const body = z
      .object({ key: slug, name: z.string().min(1).max(200), description: z.string().max(2000).optional(), bpmnXml: z.string().optional() })
      .parse(req.body);
    const draftXml = body.bpmnXml ? await layoutForDisplay(body.bpmnXml) : emptyProcessXml(body.key, body.name);
    const def = await db.createDefinition({ ...body, draftXml, actor: req.actor });
    await db.writeAudit(req.actor, 'workflow.create', 'workflow', def.id, { key: def.key });
    return reply.code(201).send(def);
  });

  app.get('/api/workflows/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    const def = await requireDefinition(id);
    return { ...def, draftXml: await layoutForDisplay(def.draftXml), versions: await db.listVersions(id) };
  });

  app.put('/api/workflows/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    await requireDefinition(id);
    const body = z
      .object({
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        draftXml: z.string().optional(),
        archived: z.boolean().optional(),
      })
      .parse(req.body);
    const def = await db.updateDefinition(id, body);
    await db.writeAudit(req.actor, body.archived ? 'workflow.archive' : 'workflow.update', 'workflow', id);
    return def;
  });

  app.post('/api/workflows/:id/validate', async (req) => {
    const { id } = idParams.parse(req.params);
    const def = await requireDefinition(id);
    const { xml } = z.object({ xml: z.string().optional() }).parse(req.body ?? {});
    const { errors, warnings } = await parseBpmn(xml ?? def.draftXml, def.key);
    return { valid: errors.length === 0, errors, warnings };
  });

  app.post('/api/workflows/:id/publish', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const def = await requireDefinition(id);
    const { xml } = z.object({ xml: z.string().optional() }).parse(req.body ?? {});
    const source = xml ?? def.draftXml;
    if (xml) await db.updateDefinition(id, { draftXml: xml });
    const result = await parseBpmn(source, def.key);
    if (!result.ir) {
      return reply.code(422).send({ error: 'Workflow has validation errors', errors: result.errors, warnings: result.warnings });
    }
    const version = await db.createVersion({ definitionId: id, xml: source, ir: result.ir, actor: req.actor });
    await db.writeAudit(req.actor, 'workflow.publish', 'workflow', id, { version: version.version });
    return reply.code(201).send({ version: version.version, warnings: result.warnings });
  });

  app.get('/api/workflows/:id/versions/:version', async (req) => {
    const { id, version } = z.object({ id: uuid, version: z.coerce.number().int().positive() }).parse(req.params);
    const v = await db.getVersion(id, version);
    if (!v) throw new HttpError(404, 'Version not found');
    return { ...v, bpmnXml: await layoutForDisplay(v.bpmnXml) };
  });

  app.post('/api/workflows/:id/runs', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const body = z.object({ input: jsonObject.default({}), version: z.number().int().positive().optional() }).parse(req.body ?? {});
    const run = await startRun({ definition: await requireDefinition(id), input: body.input, version: body.version, actor: req.actor });
    return reply.code(202).send(run);
  });

  // External systems: POST the run input as the JSON body to start the latest published version.
  app.post('/api/triggers/:key', async (req, reply) => {
    const { key } = z.object({ key: slug }).parse(req.params);
    const def = await db.getDefinitionByKey(key);
    if (!def) throw new HttpError(404, 'Workflow not found');
    const input = jsonObject.parse(req.body ?? {});
    return reply.code(202).send(await startRun({ definition: def, input, actor: `trigger:${req.actor}` }));
  });

  // ---------- runs ----------

  app.get('/api/runs', async (req) => {
    const q = z
      .object({
        workflowId: uuid.optional(),
        status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'terminated']).optional(),
        limit: z.coerce.number().int().positive().max(500).optional(),
      })
      .parse(req.query);
    return db.listRuns({ definitionId: q.workflowId, status: q.status, limit: q.limit });
  });

  app.get('/api/runs/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    const run = await db.getRun(id);
    if (!run) throw new HttpError(404, 'Run not found');
    const live = await liveRunState(run);
    const [steps, tasks, version] = await Promise.all([
      db.listSteps(id),
      db.listUserTasks({ runId: id }),
      db.getVersionById(run.versionId),
    ]);
    return { ...live, steps, tasks, bpmnXml: version && (await layoutForDisplay(version.bpmnXml)) };
  });

  app.post('/api/runs/:id/cancel', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const run = await db.getRun(id);
    if (!run) throw new HttpError(404, 'Run not found');
    if (run.status !== 'pending' && run.status !== 'running') throw new HttpError(409, `Run is ${run.status}`);
    await (await getTemporal()).workflow.getHandle(id).cancel();
    await db.writeAudit(req.actor, 'run.cancel', 'run', id);
    return reply.code(202).send({ ok: true });
  });

  // ---------- user tasks ----------

  app.get('/api/tasks', async (req) => {
    const q = z
      .object({ status: z.enum(['open', 'completed', 'cancelled']).optional(), assignee: z.string().optional() })
      .parse(req.query);
    return db.listUserTasks({ status: q.status ?? 'open', assignee: q.assignee });
  });

  app.post('/api/tasks/:id/complete', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const body = z.object({ approved: z.boolean().optional(), result: jsonObject.default({}) }).parse(req.body ?? {});
    const task = await db.getUserTask(id);
    if (!task) throw new HttpError(404, 'Task not found');
    if (task.status !== 'open') throw new HttpError(409, `Task is ${task.status}`);
    await (await getTemporal()).workflow.getHandle(task.runId).signal('completeUserTask', {
      taskId: id,
      actor: req.actor,
      approved: body.approved,
      result: body.result,
    });
    await db.writeAudit(req.actor, 'task.complete', 'task', id, { approved: body.approved, runId: task.runId });
    return reply.code(202).send({ ok: true });
  });

  // ---------- connections ----------

  const connectionBody = z.object({
    name: slug,
    type: z.string().refine((t) => t in connectors, 'unknown connector type'),
    config: jsonObject.default({}),
    secretEnv: z
      .string()
      .regex(/^OPENJIDOKA_SECRET_[A-Z0-9_]+$/, 'must be an env var name starting with OPENJIDOKA_SECRET_')
      .nullable()
      .optional(),
  });

  app.get('/api/connections', async () => db.listConnections());

  app.post('/api/connections', async (req, reply) => {
    const body = connectionBody.parse(req.body);
    const conn = await db.createConnection(body);
    await db.writeAudit(req.actor, 'connection.create', 'connection', conn.id, { name: conn.name, type: conn.type });
    return reply.code(201).send(conn);
  });

  app.put('/api/connections/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    const body = connectionBody.pick({ config: true, secretEnv: true }).partial().parse(req.body);
    const conn = await db.updateConnection(id, body);
    if (!conn) throw new HttpError(404, 'Connection not found');
    await db.writeAudit(req.actor, 'connection.update', 'connection', id);
    return conn;
  });

  app.delete('/api/connections/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    await db.deleteConnection(id);
    await db.writeAudit(req.actor, 'connection.delete', 'connection', id);
    return reply.code(204).send();
  });

  // ---------- audit ----------

  app.get('/api/audit', async (req) => {
    const { limit } = z.object({ limit: z.coerce.number().int().positive().max(1000).optional() }).parse(req.query);
    return db.listAudit(limit);
  });
}
