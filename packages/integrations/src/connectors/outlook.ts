import { NonRetryableError } from '../errors';
import { GRAPH_CONFIG_FIELDS, graphRequest } from './graph';
import type { Connector } from './types';

const recipients = (v: unknown) =>
  (Array.isArray(v) ? v : v ? [v] : []).map((address) => ({ emailAddress: { address: String(address) } }));

export const outlook: Connector = {
  type: 'outlook',
  displayName: 'Outlook mail',
  description: 'Send mail from a mailbox via Microsoft Graph (app-only, Mail.Send).',
  configFields: [
    ...GRAPH_CONFIG_FIELDS,
    { name: 'mailbox', label: 'Default sender mailbox (UPN)', required: true },
  ],
  secretDescription: 'Client secret of the app registration. Scope it with an application access policy.',
  actions: {
    sendMail: {
      description: 'Send an email.',
      params: {
        to: 'Address or list',
        cc: 'Address or list',
        subject: 'Subject',
        body: 'Body',
        contentType: 'Text or HTML',
        from: 'Override sender mailbox',
      },
      async run(p, ctx) {
        const from = (p.from as string) ?? (ctx.config.mailbox as string);
        if (!from) throw new NonRetryableError('No sender mailbox configured');
        if (!p.to) throw new NonRetryableError('to is required');
        await graphRequest(ctx, 'POST', `/users/${encodeURIComponent(from)}/sendMail`, {
          json: {
            message: {
              subject: String(p.subject ?? ''),
              body: { contentType: p.contentType === 'HTML' ? 'HTML' : 'Text', content: String(p.body ?? '') },
              toRecipients: recipients(p.to),
              ccRecipients: recipients(p.cc),
            },
            saveToSentItems: true,
          },
        });
        return { sent: true };
      },
    },
  },
};
