import { http } from './http';
import { outlook } from './outlook';
import { sharepoint } from './sharepoint';
import { teams } from './teams';
import type { Connector } from './types';

export * from './types';
export { downloadSharePointFile } from './sharepoint';

export const connectors: Record<string, Connector> = Object.fromEntries(
  [sharepoint, teams, outlook, http].map((c) => [c.type, c]),
);

/** Serializable catalogue for the admin UI. */
export function connectorCatalog() {
  return Object.values(connectors).map((c) => ({
    type: c.type,
    displayName: c.displayName,
    description: c.description,
    configFields: c.configFields,
    secretDescription: c.secretDescription,
    actions: Object.fromEntries(
      Object.entries(c.actions).map(([name, a]) => [name, { description: a.description, params: a.params }]),
    ),
  }));
}
