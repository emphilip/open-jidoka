import { errorForStatus, NonRetryableError, RetryableError } from '../errors';
import type { Connector, ConnectorContext } from './types';

async function post(ctx: ConnectorContext, card: Record<string, unknown>) {
  // The webhook URL embeds a signature, so it is the connection secret rather than config.
  const url = ctx.secret;
  if (!url) throw new NonRetryableError('Teams connection secret (workflow webhook URL) is not available');
  if (!URL.canParse(url) || !url.startsWith('https://')) {
    throw new NonRetryableError('Teams connection secret is not a valid https webhook URL');
  }
  let res: Response;
  try {
    res = await ctx.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'message',
        attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null, content: card }],
      }),
    });
  } catch (err) {
    throw new RetryableError(`Teams webhook failed: ${(err as Error).message}`);
  }
  if (!res.ok) throw errorForStatus(res.status, `Teams webhook returned ${res.status}`);
  return { delivered: true, status: res.status };
}

export const teams: Connector = {
  type: 'teams',
  displayName: 'Microsoft Teams',
  description:
    'Post messages and Adaptive Cards to a channel or chat through a Teams Workflows webhook ("When a Teams webhook request is received").',
  configFields: [{ name: 'channelLabel', label: 'Channel label (display only)' }],
  secretDescription: 'Teams Workflows webhook URL.',
  actions: {
    postMessage: {
      description: 'Post a simple card with a title, text and optional facts.',
      params: { title: 'Heading', text: 'Body (markdown)', facts: 'Object of label: value', linkUrl: 'Optional button URL' },
      run(p, ctx) {
        const body: unknown[] = [];
        if (p.title) body.push({ type: 'TextBlock', text: String(p.title), weight: 'Bolder', size: 'Medium', wrap: true });
        if (p.text) body.push({ type: 'TextBlock', text: String(p.text), wrap: true });
        if (p.facts && typeof p.facts === 'object') {
          body.push({
            type: 'FactSet',
            facts: Object.entries(p.facts).map(([title, value]) => ({ title, value: String(value) })),
          });
        }
        const actions = p.linkUrl ? [{ type: 'Action.OpenUrl', title: 'Open', url: String(p.linkUrl) }] : [];
        return post(ctx, { $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4', body, actions });
      },
    },
    postAdaptiveCard: {
      description: 'Post a full Adaptive Card JSON payload.',
      params: { card: 'Adaptive Card object' },
      run(p, ctx) {
        if (!p.card || typeof p.card !== 'object') throw new NonRetryableError('card must be an object');
        return post(ctx, p.card);
      },
    },
  },
};
