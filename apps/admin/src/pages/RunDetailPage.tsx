import { CalendarIcon, ClockIcon, UserIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate, type Run, type Step, type UserTask } from '../api';
import { BpmnViewer } from '../bpmn/BpmnViewer';
import { Page } from '../components/AppShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Code,
  Drawer,
  DrawerFacts,
  DrawerSection,
  PageHeading,
  RowLink,
  SectionHeading,
  StatusBadge,
  Table,
} from '../components/ui';
import { useResource } from '../hooks';

interface RunDetail {
  run: Run;
  state?: { activeNodeIds: string[]; completedNodeIds: string[]; failedNodeIds: string[]; vars: unknown };
  temporalStatus?: string;
  steps: Step[];
  tasks: UserTask[];
  bpmnXml?: string;
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge size="sm" color="indigo">
        active
      </Badge>
      <Badge size="sm" color="green">
        done
      </Badge>
      <Badge size="sm" color="red">
        failed
      </Badge>
    </div>
  );
}

function ValidationSummary({ step }: { step: Step }) {
  const v = step.validation;
  if (!v) return <span className="text-gray-400">—</span>;
  return (
    <span className="flex items-center gap-x-2">
      <Badge color={v.passed ? 'green' : 'yellow'}>{v.passed ? 'passed' : 'failed'}</Badge>
      {v.confidence !== undefined && <span>judge {v.confidence.toFixed(2)}</span>}
      {v.issues.length > 0 && <span>{v.issues.length === 1 ? '1 issue' : `${v.issues.length} issues`}</span>}
    </span>
  );
}

function StepDrawer({ step, onClose }: { step?: Step; onClose: () => void }) {
  return (
    <Drawer
      open={Boolean(step)}
      onClose={onClose}
      title={step ? step.nodeName ?? step.nodeId : ''}
      description={step && <span className="font-mono text-xs">{step.taskType}</span>}
    >
      {step && (
        <>
          {step.error && <Alert tone="error" title="Step failed">{step.error}</Alert>}
          <DrawerSection title="Information">
            <DrawerFacts
              items={[
                { term: 'Status', detail: <StatusBadge status={step.status} /> },
                { term: 'Attempt', detail: step.attempt },
                { term: 'Element id', detail: <span className="font-mono text-xs">{step.nodeId}</span> },
                { term: 'Started', detail: fmtDate(step.startedAt) },
                { term: 'Finished', detail: fmtDate(step.completedAt) },
              ]}
            />
          </DrawerSection>
          {step.validation && (
            <DrawerSection title="Validation">
              <DrawerFacts
                items={[
                  { term: 'Result', detail: <Badge color={step.validation.passed ? 'green' : 'yellow'}>{step.validation.passed ? 'passed' : 'failed'}</Badge> },
                  ...(step.validation.confidence !== undefined ? [{ term: 'Judge confidence', detail: step.validation.confidence.toFixed(2) }] : []),
                ]}
              />
              {step.validation.issues.length > 0 && (
                <ul role="list" className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {step.validation.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}
              {step.validation.judgeReasoning && <p className="mt-3 text-sm text-gray-500">{step.validation.judgeReasoning}</p>}
            </DrawerSection>
          )}
          {step.reasoning && (
            <DrawerSection title="Reasoning">
              <p className="text-sm text-gray-700">{step.reasoning}</p>
            </DrawerSection>
          )}
          <DrawerSection title="Output">
            <Code value={step.output} />
          </DrawerSection>
          {step.input !== undefined && step.input !== null && (
            <DrawerSection title="Input">
              <Code value={step.input} />
            </DrawerSection>
          )}
        </>
      )}
    </Drawer>
  );
}

export function RunDetailPage() {
  const { id } = useParams();
  const [focus, setFocus] = useState<string>();
  const [openStep, setOpenStep] = useState<Step>();
  const { data, error, reload } = useResource(
    () => api<RunDetail>(`/runs/${id}`),
    [id],
    (d) => d.run.status === 'running' || d.run.status === 'pending',
  );

  const markers = useMemo(() => {
    const m: Record<string, 'active' | 'completed' | 'failed'> = {};
    if (!data) return m;
    for (const s of data.steps) m[s.nodeId] = s.status === 'failed' ? 'failed' : 'completed';
    for (const n of data.state?.completedNodeIds ?? []) m[n] ??= 'completed';
    for (const n of data.state?.failedNodeIds ?? []) m[n] = 'failed';
    for (const n of data.state?.activeNodeIds ?? []) m[n] = 'active';
    for (const t of data.tasks) if (t.status === 'open') m[t.nodeId] = 'active';
    return m;
  }, [data]);

  if (error && !data) {
    return (
      <Page>
        <Alert tone="error" title="Could not load run">{error}</Alert>
      </Page>
    );
  }
  if (!data) {
    return (
      <Page>
        <p className="text-sm text-gray-500">Loading…</p>
      </Page>
    );
  }
  const { run } = data;
  const steps = focus ? data.steps.filter((s) => s.nodeId === focus) : data.steps;
  const openTasks = data.tasks.filter((t) => t.status === 'open');
  const live = run.status === 'running' || run.status === 'pending';

  async function cancel() {
    if (!confirm('Cancel this run?')) return;
    await api(`/runs/${id}/cancel`, { body: {} });
    reload();
  }

  return (
    <Page>
      <PageHeading
        breadcrumbs={[{ label: 'Runs', to: '/runs' }, { label: run.id.slice(0, 8) }]}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {run.definitionName} <span className="text-lg font-medium text-gray-500">v{run.version}</span>
            <StatusBadge status={run.status} />
          </span>
        }
        meta={[
          { icon: CalendarIcon, content: `Started ${fmtDate(run.startedAt)}` },
          { icon: UserIcon, content: run.triggeredBy },
          ...(run.completedAt ? [{ icon: ClockIcon, content: `Finished ${fmtDate(run.completedAt)}` }] : []),
        ]}
        actions={
          live && (
            <Button variant="danger" icon={XMarkIcon} onClick={cancel}>
              Cancel run
            </Button>
          )
        }
      />

      {run.error && <Alert tone="error" title={`Run ${run.status}`}>{run.error}</Alert>}
      {openTasks.length > 0 && (
        <Alert tone="info" title={`Waiting on ${openTasks.map((t) => t.name).join(', ')}`}>
          <Link to="/tasks" className="font-medium underline">
            Open the task inbox
          </Link>
        </Alert>
      )}

      <Card>
        <CardHeader title="Diagram" description="Select an element to filter its steps." actions={<Legend />} />
        <BpmnViewer xml={data.bpmnXml} markers={markers} onSelect={(el) => setFocus(focus === el ? undefined : el)} />
      </Card>

      <div className="space-y-6">
        <SectionHeading
          title="Steps"
          action={
            focus && (
              <Button size="sm" onClick={() => setFocus(undefined)}>
                Show all steps
              </Button>
            )
          }
        />
        <Table
          rows={steps}
          rowKey={(s) => s.id}
          empty="No steps recorded yet."
          columns={[
            {
              header: 'Element',
              cell: (s) => (
                <>
                  {s.nodeName ?? s.nodeId}
                  <div className="mt-1 font-mono text-xs font-normal text-gray-500">{s.taskType}</div>
                </>
              ),
            },
            { header: 'Attempt', hideBelow: 'sm', cell: (s) => s.attempt },
            { header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
            { header: 'Validation', hideBelow: 'md', cell: (s) => <ValidationSummary step={s} /> },
            { header: 'Finished', hideBelow: 'lg', cell: (s) => fmtDate(s.completedAt) },
          ]}
          action={(s) => <RowLink onClick={() => setOpenStep(s)} label="Details" name={s.nodeName ?? s.nodeId} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Input" />
          <CardBody>
            <Code value={run.input} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={run.output ? 'Output' : 'Current variables'} />
          <CardBody>
            <Code value={run.output ?? data.state?.vars} />
          </CardBody>
        </Card>
      </div>

      <StepDrawer step={openStep} onClose={() => setOpenStep(undefined)} />
    </Page>
  );
}
