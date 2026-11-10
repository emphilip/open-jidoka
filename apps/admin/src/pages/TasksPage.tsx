import { CheckIcon, InboxIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, type UserTask } from '../api';
import { Page } from '../components/AppShell';
import { Alert, Badge, Button, ButtonLink, Card, CardBody, Checkbox, Code, DescriptionList, EmptyState, Field, Input, ListHeader, Textarea } from '../components/ui';
import { useResource } from '../hooks';

function Context({ value }: { value: unknown }) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return null;
    return (
      <DescriptionList
        items={entries.map(([term, v]) => ({
          term,
          detail: typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : <Code value={v} />,
        }))}
      />
    );
  }
  if (value === undefined || value === null) return null;
  return (
    <div className="px-4 py-4 sm:px-6">
      <Code value={value} />
    </div>
  );
}

function TaskCard({ task, onDone }: { task: UserTask; onDone: () => void }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function complete(approved: boolean) {
    setError('');
    const result: Record<string, unknown> = {};
    for (const field of task.form ?? []) {
      const raw = values[field.name];
      if (raw === undefined || raw === '') continue;
      try {
        if (field.type === 'number') result[field.name] = Number(raw);
        else if (field.type === 'json') result[field.name] = JSON.parse(String(raw));
        else result[field.name] = raw;
      } catch {
        setError(`${field.label ?? field.name} is not valid JSON`);
        return;
      }
    }
    setBusy(true);
    try {
      await api(`/tasks/${task.id}/complete`, { body: { approved, result } });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900">
              {task.name}
              {task.kind === 'review' && (
                <Badge size="sm" color="yellow">
                  AI review
                </Badge>
              )}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {task.definitionName} · run{' '}
              <Link to={`/runs/${task.runId}`} className="font-mono text-xs text-brand-600 hover:text-brand-500">
                {task.runId.slice(0, 8)}
              </Link>
              {task.assignee && <> · assigned to {task.assignee}</>}
            </p>
          </div>
          <span className="text-xs text-gray-500">{fmtDate(task.createdAt)}</span>
        </div>
        {task.instructions && <p className="mt-3 text-sm text-gray-700">{task.instructions}</p>}
      </div>

      {task.context !== undefined && task.context !== null && (
        <div>
          <h4 className="px-4 pt-5 text-sm font-medium text-gray-900 sm:px-6">Context</h4>
          <Context value={task.context} />
        </div>
      )}

      <CardBody className="space-y-5">
        {(task.form ?? []).map((field) =>
          field.type === 'boolean' ? (
            <Checkbox
              key={field.name}
              label={field.label ?? field.name}
              checked={Boolean(values[field.name])}
              onChange={(e) => setValues({ ...values, [field.name]: e.target.checked })}
            />
          ) : (
            <Field key={field.name} label={field.label ?? field.name}>
              {(id) =>
                field.type === 'json' ? (
                  <Textarea
                    id={id}
                    mono
                    rows={6}
                    value={String(values[field.name] ?? '')}
                    onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                  />
                ) : (
                  <Input
                    id={id}
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={String(values[field.name] ?? '')}
                    onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                  />
                )
              }
            </Field>
          ),
        )}
        {error && <Alert tone="error" title="Could not complete task">{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="danger" icon={XMarkIcon} disabled={busy} onClick={() => complete(false)}>
            Reject
          </Button>
          <Button variant="primary" icon={CheckIcon} disabled={busy} onClick={() => complete(true)}>
            Approve
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function TasksPage() {
  const { data, error, reload } = useResource(() => api<UserTask[]>('/tasks?status=open'), [], () => true);
  return (
    <Page>
      <ListHeader title="Task inbox" description="Human approvals from user tasks, and reviews of OpenJEV output that failed validation." />
      {error && <Alert tone="error" title="Could not load tasks">{error}</Alert>}
      {data?.length === 0 && (
        <EmptyState
          icon={InboxIcon}
          title="Nothing is waiting on you"
          description="Approvals and AI output reviews appear here when a run reaches a user task or validation escalates to a person."
          action={<ButtonLink to="/runs">View runs</ButtonLink>}
        />
      )}
      <div className="space-y-6">
        {data?.map((t) => (
          <TaskCard key={t.id} task={t} onDone={reload} />
        ))}
      </div>
    </Page>
  );
}
