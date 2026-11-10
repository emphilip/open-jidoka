import { ArrowUpTrayIcon, PlusIcon } from '@heroicons/react/20/solid';
import { RectangleGroupIcon } from '@heroicons/react/24/outline';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtDate, type Workflow } from '../api';
import { Page } from '../components/AppShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  EmptyState,
  Field,
  FileDrop,
  Input,
  ListHeader,
  RowActions,
  RowLink,
  RowMenu,
  Table,
} from '../components/ui';
import { useResource } from '../hooks';

export function WorkflowsPage() {
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const { data, error, reload } = useResource(() => api<Workflow[]>(showArchived ? '/workflows?archived=true' : '/workflows'), [showArchived]);
  const [form, setForm] = useState({ key: '', name: '', description: '' });
  const [file, setFile] = useState<File>();
  const [createError, setCreateError] = useState('');
  const formRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    try {
      const bpmnXml = file ? await file.text() : undefined;
      const wf = await api<Workflow>('/workflows', { body: { ...form, bpmnXml } });
      navigate(`/workflows/${wf.id}`);
    } catch (err) {
      setCreateError((err as Error).message);
    }
  }

  async function toggleArchive(wf: Workflow) {
    await api(`/workflows/${wf.id}`, { method: 'PUT', body: { archived: !wf.archived } });
    reload();
  }

  const startCreate = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
    keyRef.current?.focus();
  };

  return (
    <Page>
      <ListHeader
        title="Workflows"
        description="BPMN process definitions. Publish a version to make it runnable."
        action={
          <Button variant="primary" onClick={startCreate}>
            New workflow
          </Button>
        }
      />
      {error && <Alert tone="error" title="Could not load workflows">{error}</Alert>}

      {data && data.length === 0 && !showArchived ? (
        <EmptyState
          icon={RectangleGroupIcon}
          title="No workflows yet"
          description="A workflow is a BPMN diagram of tasks, decisions and approvals that OpenJidoka runs durably. Create one from scratch or import a .bpmn file."
          action={
            <>
              <Button variant="primary" icon={PlusIcon} onClick={startCreate}>
                Create workflow
              </Button>
              <Button icon={ArrowUpTrayIcon} onClick={startCreate}>
                Import BPMN
              </Button>
            </>
          }
        />
      ) : (
        <Table
          rows={data ?? []}
          rowKey={(wf) => wf.id}
          empty="No workflows, including archived ones."
          columns={[
            {
              header: 'Name',
              cell: (wf) => (
                <>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {wf.name}
                    {wf.archived && <Badge size="sm">archived</Badge>}
                  </div>
                  {wf.description && <div className="mt-1 font-normal text-gray-500">{wf.description}</div>}
                </>
              ),
            },
            { header: 'Key', hideBelow: 'sm', cell: (wf) => <span className="font-mono text-xs">{wf.key}</span> },
            { header: 'Version', cell: (wf) => (wf.latestVersion ? `v${wf.latestVersion}` : 'draft only') },
            { header: 'Updated', hideBelow: 'lg', cell: (wf) => fmtDate(wf.updatedAt) },
          ]}
          action={(wf) => (
            <RowActions>
              <RowLink to={`/workflows/${wf.id}`} label="Edit" name={wf.name} />
              <RowMenu
                name={wf.name}
                items={[
                  { label: 'View runs', to: `/runs?workflowId=${wf.id}` },
                  { label: wf.archived ? 'Restore' : 'Archive', onClick: () => toggleArchive(wf) },
                ]}
              />
            </RowActions>
          )}
        />
      )}
      <Checkbox label="Show archived workflows" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />

      <div ref={formRef}>
        <Card className="max-w-2xl">
          <CardHeader title="New workflow" description="Starts as a draft with a single start event, or with the diagram you import." />
          <CardBody>
            <form onSubmit={create} className="space-y-6">
              <Field label="Key" hint="Lowercase letters, digits, - and _. Used by triggers; cannot be changed later.">
                {(id) => (
                  <Input id={id} ref={keyRef} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="invoice-approval" mono required />
                )}
              </Field>
              <Field label="Name">{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}</Field>
              <Field label="Description">
                {(id) => <Input id={id} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
              </Field>
              <FileDrop label="Import BPMN file" hint=".bpmn or .xml, optional. Diagrams without layout get one generated." accept=".bpmn,.xml" file={file} onFile={setFile} />
              {createError && <Alert tone="error" title="Could not create workflow">{createError}</Alert>}
              <div className="flex justify-end">
                <Button type="submit" variant="primary">
                  Create workflow
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
