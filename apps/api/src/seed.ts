import { readFile } from 'node:fs/promises';
import { parseBpmn } from '@openjidoka/core/bpmn';
import * as db from '@openjidoka/db';
import { layoutForDisplay } from './bpmn-utils';

/** Idempotent: creates the example workflow, publishes it, and adds placeholder connections. */
await db.migrate();

const examplePath = process.env.SEED_EXAMPLE ?? new URL('../../../examples/invoice-approval.bpmn', import.meta.url).pathname;
const xml = await layoutForDisplay(await readFile(examplePath, 'utf8'));

let def = await db.getDefinitionByKey('invoice-approval');
if (!def) {
  def = await db.createDefinition({
    key: 'invoice-approval',
    name: 'Invoice approval',
    description: 'Extract, validate and route supplier invoices; files approved invoices in SharePoint and notifies Teams.',
    draftXml: xml,
    actor: 'seed',
  });
  const parsed = await parseBpmn(xml, def.key);
  if (!parsed.ir) throw new Error(`Example does not parse: ${JSON.stringify(parsed.errors)}`);
  await db.createVersion({ definitionId: def.id, xml, ir: parsed.ir, actor: 'seed' });
  console.log('seeded workflow invoice-approval v1');
}

const placeholders = [
  { name: 'finance-teams', type: 'teams', config: { channelLabel: 'Finance / Approvals' }, secretEnv: 'OPENJIDOKA_SECRET_TEAMS_WEBHOOK' },
  {
    name: 'finance-sharepoint',
    type: 'sharepoint',
    config: { tenantId: '<TENANT_ID>', clientId: '<CLIENT_ID>', siteId: '<SITE_ID>' },
    secretEnv: 'OPENJIDOKA_SECRET_SHAREPOINT',
  },
];
for (const c of placeholders) {
  if (!(await db.getConnectionByName(c.name))) {
    await db.createConnection(c);
    console.log(`seeded connection ${c.name}`);
  }
}
await db.closePool();
