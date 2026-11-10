import { useState } from 'react';
import { api, fmtDate } from '../api';
import { Page } from '../components/AppShell';
import { Alert, Code, Drawer, DrawerFacts, DrawerSection, ListHeader, RowLink, Table } from '../components/ui';
import { useResource } from '../hooks';

interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: unknown;
  at: string;
}

export function AuditPage() {
  const { data, error } = useResource(() => api<AuditEntry[]>('/audit?limit=200'), []);
  const [open, setOpen] = useState<AuditEntry>();
  return (
    <Page>
      <ListHeader title="Audit log" description="Every change and action, newest first. The latest 200 entries are shown." />
      {error && <Alert tone="error" title="Could not load the audit log">{error}</Alert>}
      <Table
        rows={data ?? []}
        rowKey={(a) => String(a.id)}
        empty="No audit entries yet."
        columns={[
          { header: 'Action', cell: (a) => <span className="font-mono text-xs">{a.action}</span> },
          { header: 'Actor', cell: (a) => a.actor },
          { header: 'Entity', hideBelow: 'sm', cell: (a) => `${a.entityType} ${a.entityId?.slice(0, 8) ?? ''}` },
          { header: 'When', hideBelow: 'md', cell: (a) => fmtDate(a.at) },
        ]}
        action={(a) => <RowLink onClick={() => setOpen(a)} label="Details" name={`${a.action} at ${fmtDate(a.at)}`} />}
      />
      <Drawer open={Boolean(open)} onClose={() => setOpen(undefined)} title={open?.action ?? ''} description={open && fmtDate(open.at)}>
        {open && (
          <>
            <DrawerSection title="Information">
              <DrawerFacts
                items={[
                  { term: 'Actor', detail: open.actor },
                  { term: 'Entity type', detail: open.entityType },
                  { term: 'Entity id', detail: <span className="font-mono text-xs">{open.entityId ?? '—'}</span> },
                ]}
              />
            </DrawerSection>
            <DrawerSection title="Details">
              <Code value={open.details} />
            </DrawerSection>
          </>
        )}
      </Drawer>
    </Page>
  );
}
