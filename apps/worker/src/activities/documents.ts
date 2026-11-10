import type { DocumentRef } from '@openjidoka/core/types';
import { connectors, downloadSharePointFile } from '@openjidoka/integrations/connectors';
import type { Attachment } from '@openjidoka/integrations/openjev';
import { RetryableError } from '@openjidoka/integrations/errors';
import { fail } from './failures';
import type { ConnectionLoader } from './connector';

export type LoadedDocument = { kind: 'text'; text: string; filename?: string } | { kind: 'file'; attachment: Attachment };

const TEXT_TYPES = /^(text\/|application\/(json|xml|csv))/;

function maxBytes() {
  return Number(process.env.DOCUMENT_MAX_BYTES ?? 20 * 1024 * 1024);
}

function checkHost(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') fail(`Unsupported document URL scheme ${url.protocol}`);
  const allow = (process.env.DOCUMENT_URL_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length && !allow.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
    fail(`Document host ${url.hostname} is not in DOCUMENT_URL_ALLOWLIST`);
  }
}

function toLoaded(bytes: Buffer, mimeType: string, filename: string): LoadedDocument {
  if (bytes.length > maxBytes()) fail(`Document ${filename} exceeds DOCUMENT_MAX_BYTES`);
  if (TEXT_TYPES.test(mimeType)) return { kind: 'text', text: bytes.toString('utf8'), filename };
  return { kind: 'file', attachment: { filename, mimeType, data: bytes.toString('base64') } };
}

export async function loadDocument(ref: DocumentRef | string, loadConnection: ConnectionLoader): Promise<LoadedDocument> {
  if (typeof ref === 'string') ref = ref.startsWith('http') ? { url: ref } : { text: ref };
  if (!ref || typeof ref !== 'object') fail('document must resolve to an object such as { url } or { sharepoint }');

  if (ref.text !== undefined) return { kind: 'text', text: String(ref.text), filename: ref.filename };

  if (ref.base64) {
    return toLoaded(Buffer.from(ref.base64, 'base64'), ref.mimeType ?? 'application/pdf', ref.filename ?? 'document');
  }

  if (ref.url) {
    const url = new URL(ref.url);
    checkHost(url);
    let res: Response;
    try {
      res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(60_000) });
    } catch (err) {
      throw new RetryableError(`Document download failed: ${(err as Error).message}`);
    }
    if (!res.ok) {
      if (res.status >= 500 || res.status === 429) throw new RetryableError(`Document download returned ${res.status}`);
      fail(`Document download returned ${res.status}`);
    }
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > maxBytes()) fail('Document exceeds DOCUMENT_MAX_BYTES');
    const bytes = Buffer.from(await res.arrayBuffer());
    const mimeType = ref.mimeType ?? res.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
    const filename = ref.filename ?? (decodeURIComponent(url.pathname.split('/').pop() || 'document'));
    return toLoaded(bytes, mimeType, filename);
  }

  if (ref.sharepoint) {
    const { connection, ...location } = ref.sharepoint;
    const ctx = await loadConnection(connection);
    if (ctx.type !== connectors.sharepoint!.type) fail(`Connection ${connection} is not a SharePoint connection`);
    const file = await downloadSharePointFile(ctx.context, location);
    return toLoaded(Buffer.from(file.base64, 'base64'), ref.mimeType ?? file.mimeType, file.filename);
  }

  return fail('document needs one of text, base64, url or sharepoint');
}
