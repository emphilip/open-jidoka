import { NonRetryableError } from '../errors';
import { encodePath, GRAPH_CONFIG_FIELDS, graphRequest } from './graph';
import type { Connector, ConnectorContext } from './types';

function drive(ctx: ConnectorContext, driveId?: string) {
  const siteId = ctx.config.siteId as string | undefined;
  const id = driveId ?? (ctx.config.driveId as string | undefined);
  if (id) return `/drives/${encodeURIComponent(id)}`;
  if (!siteId) throw new NonRetryableError('SharePoint connection needs siteId or driveId');
  return `/sites/${encodeURIComponent(siteId)}/drive`;
}

function site(ctx: ConnectorContext) {
  const siteId = ctx.config.siteId as string | undefined;
  if (!siteId) throw new NonRetryableError('SharePoint connection needs siteId');
  return `/sites/${encodeURIComponent(siteId)}`;
}

function itemPath(ctx: ConnectorContext, p: { itemId?: string; path?: string; driveId?: string }) {
  if (p.itemId) return `${drive(ctx, p.driveId)}/items/${encodeURIComponent(p.itemId)}`;
  if (p.path) return `${drive(ctx, p.driveId)}/root:/${encodePath(p.path)}:`;
  throw new NonRetryableError('Provide itemId or path');
}

export async function downloadSharePointFile(
  ctx: ConnectorContext,
  p: { itemId?: string; path?: string; driveId?: string },
) {
  const base = itemPath(ctx, p);
  const meta = await graphRequest(ctx, 'GET', `${base}?$select=id,name,size,file`);
  const res: Response = await graphRequest(ctx, 'GET', `${base}/content`, { raw: true });
  const bytes = Buffer.from(await res.arrayBuffer());
  return {
    id: meta.id as string,
    filename: meta.name as string,
    mimeType: (meta.file?.mimeType as string) ?? 'application/octet-stream',
    size: bytes.length,
    base64: bytes.toString('base64'),
  };
}

export const sharepoint: Connector = {
  type: 'sharepoint',
  displayName: 'SharePoint',
  description: 'Files and lists in a SharePoint site via Microsoft Graph (app-only).',
  configFields: [
    ...GRAPH_CONFIG_FIELDS,
    { name: 'siteId', label: 'Site ID', required: true, description: 'e.g. contoso.sharepoint.com,<guid>,<guid>' },
    { name: 'driveId', label: 'Default drive (document library) ID' },
  ],
  secretDescription: 'Client secret of the app registration (Sites.Selected or Sites.ReadWrite.All).',
  actions: {
    listFiles: {
      description: 'List files in a folder of the document library.',
      params: { folderPath: 'Folder path, empty for root', driveId: 'Override drive' },
      async run(p, ctx) {
        const base = drive(ctx, p.driveId);
        const path = p.folderPath ? `${base}/root:/${encodePath(p.folderPath)}:/children` : `${base}/root/children`;
        const res = await graphRequest(ctx, 'GET', `${path}?$select=id,name,size,webUrl,file,folder,lastModifiedDateTime`);
        return res.value;
      },
    },
    downloadFile: {
      description: 'Download a file as base64 (use as an openjev.extract document).',
      params: { itemId: 'Drive item ID', path: 'Or a path within the drive', driveId: 'Override drive' },
      run: (p, ctx) => downloadSharePointFile(ctx, p),
    },
    uploadFile: {
      description: 'Create or replace a file (simple upload, up to 250 MB).',
      params: {
        folderPath: 'Target folder',
        filename: 'File name',
        content: 'Text content',
        base64: 'Or base64 content',
        contentType: 'MIME type',
        driveId: 'Override drive',
      },
      async run(p, ctx) {
        if (!p.filename) throw new NonRetryableError('filename is required');
        const body = p.base64 ? Buffer.from(String(p.base64), 'base64') : Buffer.from(String(p.content ?? ''), 'utf8');
        const target = encodePath(`${p.folderPath ?? ''}/${p.filename}`);
        const item = await graphRequest(ctx, 'PUT', `${drive(ctx, p.driveId)}/root:/${target}:/content`, {
          body,
          contentType: p.contentType ?? 'application/octet-stream',
        });
        return { id: item.id, name: item.name, webUrl: item.webUrl, size: item.size };
      },
    },
    createListItem: {
      description: 'Add an item to a SharePoint list.',
      params: { listId: 'List ID or name', fields: 'Object of column values' },
      async run(p, ctx) {
        const item = await graphRequest(ctx, 'POST', `${site(ctx)}/lists/${encodeURIComponent(p.listId)}/items`, {
          json: { fields: p.fields ?? {} },
        });
        return { id: item.id, webUrl: item.webUrl, fields: item.fields };
      },
    },
    getListItems: {
      description: 'Read list items with their fields.',
      params: { listId: 'List ID or name', filter: 'OData $filter', top: 'Max items' },
      async run(p, ctx) {
        const qs = new URLSearchParams({ $expand: 'fields', $top: String(p.top ?? 100) });
        if (p.filter) qs.set('$filter', p.filter);
        const res = await graphRequest(ctx, 'GET', `${site(ctx)}/lists/${encodeURIComponent(p.listId)}/items?${qs}`);
        return (res.value as any[]).map((i) => ({ id: i.id, ...i.fields }));
      },
    },
  },
};
