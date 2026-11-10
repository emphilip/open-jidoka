import { PlayCircleIcon } from '@heroicons/react/24/outline';
import { useSearchParams } from 'react-router-dom';
import { api, fmtDate, type Run } from '../api';
import { Page } from '../components/AppShell';
import { Alert, ButtonLink, EmptyState, ListHeader, RowLink, Select, StatusBadge, Table } from '../components/ui';
import { useResource } from '../hooks';

const STATUSES = ['', 'pending', 'running', 'completed', 'failed', 'cancelled', 'terminated'];

export function RunsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const workflowId = params.get('workflowId') ?? '';
  const query = new URLSearchParams({ ...(status && { status }), ...(workflowId && { workflowId }) }).toString();
  const { data, error } = useResource(
    () => api<Run[]>(`/runs?${query}`),
    [query],
    (runs) => runs.some((r) => r.status === 'running' || r.status === 'pending'),
  );
  const filtered = Boolean(status || workflowId);

  return (
    <Page>
      <ListHeader
        title="Runs"
        description={workflowId && data?.[0] ? `Runs of ${data[0].definitionName}.` : 'Every workflow run, newest first. Running runs refresh automatically.'}
        action={
          <>
            {workflowId && (
              <ButtonLink to={status ? `/runs?status=${status}` : '/runs'} variant="link" className="text-sm">
                All workflows
              </ButtonLink>
            )}
            <label htmlFor="status-filter" className="sr-only">
              Status
            </label>
            <Select
              id="status-filter"
              className="w-44"
              value={status}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                if (e.target.value) next.set('status', e.target.value);
                else next.delete('status');
                setParams(next);
              }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s || 'All statuses'}
                </option>
              ))}
            </Select>
          </>
        }
      />
      {error && <Alert tone="error" title="Could not load runs">{error}</Alert>}

      {data && data.length === 0 ? (
        <EmptyState
          icon={PlayCircleIcon}
          title={filtered ? 'No matching runs' : 'No runs yet'}
          description={
            filtered ? 'No runs match this filter. Clear it to see every run.' : 'Runs appear here when a published workflow is started from its editor, the API or a trigger.'
          }
          action={
            filtered ? (
              <ButtonLink to="/runs">Clear filter</ButtonLink>
            ) : (
              <ButtonLink to="/workflows" variant="primary">
                Go to workflows
              </ButtonLink>
            )
          }
        />
      ) : (
        <Table
          rows={data ?? []}
          rowKey={(r) => r.id}
          columns={[
            {
              header: 'Workflow',
              cell: (r) => (
                <>
                  {r.definitionName} <span className="font-normal text-gray-500">v{r.version}</span>
                  <div className="mt-1 font-mono text-xs font-normal text-gray-500">{r.id.slice(0, 8)}</div>
                </>
              ),
            },
            { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            { header: 'Started', hideBelow: 'sm', cell: (r) => fmtDate(r.startedAt) },
            { header: 'Completed', hideBelow: 'lg', cell: (r) => (r.completedAt ? fmtDate(r.completedAt) : null) },
            { header: 'Triggered by', hideBelow: 'lg', cell: (r) => r.triggeredBy },
          ]}
          action={(r) => <RowLink to={`/runs/${r.id}`} label="View" name={`run ${r.id.slice(0, 8)}`} />}
        />
      )}
    </Page>
  );
}
