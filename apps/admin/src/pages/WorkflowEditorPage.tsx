import { CheckIcon, CloudArrowUpIcon, PlayIcon, ShieldCheckIcon, TagIcon } from '@heroicons/react/20/solid';
import jidokaModdle from '@openjidoka/core/bpmn/jidoka-moddle.json';
import Modeler from 'bpmn-js/lib/Modeler';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fmtDate, type Catalog, type ParseIssue, type Workflow } from '../api';
import { PropertiesPanel } from '../bpmn/PropertiesPanel';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, PageHeading, Textarea } from '../components/ui';

type Issues = { errors: ParseIssue[]; warnings: ParseIssue[] };

export function WorkflowEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const container = useRef<HTMLDivElement>(null);
  const modeler = useRef<any>(null);
  const [workflow, setWorkflow] = useState<Workflow>();
  const [catalog, setCatalog] = useState<Catalog>();
  const [connections, setConnections] = useState<Array<{ name: string; type: string }>>([]);
  const [selected, setSelected] = useState<any>();
  const [, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [issues, setIssues] = useState<Issues>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [runInput, setRunInput] = useState<string | null>(null);

  const load = useCallback(async () => {
    const wf = await api<Workflow>(`/workflows/${id}`);
    setWorkflow(wf);
    return wf;
  }, [id]);

  useEffect(() => {
    const m: any = new Modeler({ container: container.current!, moddleExtensions: { jidoka: jidokaModdle } });
    modeler.current = m;
    m.on('selection.changed', (e: any) => setSelected(e.newSelection.length === 1 ? e.newSelection[0] : undefined));
    m.on('elements.changed', () => setRevision((r) => r + 1));
    m.on('commandStack.changed', () => setDirty(true));

    let cancelled = false;
    Promise.all([load(), api<Catalog>('/catalog'), api('/connections')])
      .then(async ([wf, cat, conns]) => {
        if (cancelled) return;
        setCatalog(cat);
        setConnections(conns);
        await m.importXML(wf.draftXml);
        m.get('canvas').zoom('fit-viewport');
        setDirty(false);
      })
      .catch((err) => setError((err as Error).message));
    return () => {
      cancelled = true;
      m.destroy();
    };
  }, [load]);

  const xml = async () => (await modeler.current.saveXML({ format: true })).xml as string;

  function markIssues(next: Issues) {
    const canvas = modeler.current.get('canvas');
    const registry = modeler.current.get('elementRegistry');
    registry.forEach((el: any) => {
      canvas.removeMarker(el.id, 'jidoka-error');
      canvas.removeMarker(el.id, 'jidoka-warning');
    });
    for (const w of next.warnings) if (w.elementId && registry.get(w.elementId)) canvas.addMarker(w.elementId, 'jidoka-warning');
    for (const e of next.errors) if (e.elementId && registry.get(e.elementId)) canvas.addMarker(e.elementId, 'jidoka-error');
    setIssues(next);
  }

  async function run(action: () => Promise<void>) {
    setError('');
    setMessage('');
    try {
      await action();
    } catch (err: any) {
      if (err.body?.errors) markIssues({ errors: err.body.errors, warnings: err.body.warnings ?? [] });
      setError(err.message);
    }
  }

  const save = () =>
    run(async () => {
      await api(`/workflows/${id}`, { method: 'PUT', body: { draftXml: await xml() } });
      setDirty(false);
      setMessage('Draft saved');
    });

  const validate = () =>
    run(async () => {
      const result = await api<Issues & { valid: boolean }>(`/workflows/${id}/validate`, { body: { xml: await xml() } });
      markIssues(result);
      setMessage(result.valid ? 'No errors' : '');
    });

  const publish = () =>
    run(async () => {
      const result = await api<{ version: number; warnings: ParseIssue[] }>(`/workflows/${id}/publish`, { body: { xml: await xml() } });
      markIssues({ errors: [], warnings: result.warnings });
      setDirty(false);
      setMessage(`Published version ${result.version}`);
      await load();
    });

  const startRun = () =>
    run(async () => {
      const input = JSON.parse(runInput || '{}');
      const res = await api<{ id: string }>(`/workflows/${id}/runs`, { body: { input } });
      navigate(`/runs/${res.id}`);
    });

  function focus(elementId?: string) {
    if (!elementId) return;
    const el = modeler.current.get('elementRegistry').get(elementId);
    if (el) modeler.current.get('selection').select(el);
  }

  const hasIssues = issues && (issues.errors.length > 0 || issues.warnings.length > 0);

  return (
    <div className="flex flex-col lg:h-dvh">
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <PageHeading
          title={workflow?.name ?? 'Workflow'}
          breadcrumbs={[{ label: 'Workflows', to: '/workflows' }, { label: workflow?.name ?? '…' }]}
          meta={[
            { icon: TagIcon, content: <code className="font-mono text-xs">{workflow?.key}</code> },
            { icon: CloudArrowUpIcon, content: workflow?.latestVersion ? `Live: v${workflow.latestVersion}` : 'Not published' },
            ...(dirty ? [{ content: <span className="font-medium text-yellow-700">Unsaved changes</span> }] : []),
          ]}
          actions={
            <>
              <Button onClick={save}>Save draft</Button>
              <Button icon={ShieldCheckIcon} onClick={validate}>
                Validate
              </Button>
              <Button
                icon={PlayIcon}
                disabled={!workflow?.latestVersion}
                onClick={() => setRunInput(runInput === null ? '{\n  \n}' : null)}
              >
                Start run
              </Button>
              <Button variant="primary" icon={CheckIcon} onClick={publish}>
                Publish
              </Button>
            </>
          }
        />
        {(message || error) && (
          <Alert className="mt-4" tone={error ? 'error' : 'success'} title={error ? 'Action failed' : message}>
            {error || undefined}
          </Alert>
        )}
        {runInput !== null && (
          <div className="mt-4 rounded-lg bg-gray-50 p-4 ring-1 ring-gray-200">
            <Field label={<>Run input (JSON, available as <code className="font-mono">input</code>)</>}>
              {(fid) => <Textarea id={fid} mono rows={5} value={runInput} onChange={(e) => setRunInput(e.target.value)} />}
            </Field>
            <div className="mt-3 flex justify-end gap-3">
              <Button onClick={() => setRunInput(null)}>Cancel</Button>
              <Button variant="primary" icon={PlayIcon} onClick={startRun}>
                Start run of v{workflow?.latestVersion}
              </Button>
            </div>
          </div>
        )}
      </header>

      <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row">
        <div ref={container} className="relative h-[60vh] min-w-0 bg-white lg:h-auto lg:flex-1" />
        <aside className="space-y-4 border-t border-gray-200 bg-gray-50 p-4 lg:w-96 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <PropertiesPanel modeler={modeler.current} element={selected} catalog={catalog} connections={connections} />
          {hasIssues && (
            <Card>
              <CardHeader title="Problems" description="Select a problem to highlight its element." />
              <ul role="list" className="divide-y divide-gray-100">
                {[...issues!.errors.map((e) => ({ ...e, kind: 'error' as const })), ...issues!.warnings.map((w) => ({ ...w, kind: 'warning' as const }))].map(
                  (p, i) => (
                    <li key={i} className="relative flex gap-x-3 px-4 py-4 hover:bg-gray-50 sm:px-6">
                      <Badge size="sm" color={p.kind === 'error' ? 'red' : 'yellow'} className="mt-0.5 h-fit">
                        {p.kind}
                      </Badge>
                      <div className="min-w-0">
                        <button type="button" onClick={() => focus(p.elementId)} className="text-left text-sm/6 text-gray-900">
                          <span className="absolute inset-0" />
                          {p.message}
                        </button>
                        {p.elementId && <p className="mt-1 truncate font-mono text-xs/5 text-gray-500">{p.elementId}</p>}
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </Card>
          )}
          {workflow?.versions && workflow.versions.length > 0 && (
            <Card>
              <CardHeader title="Versions" />
              <CardBody className="py-3 sm:py-3">
                <ul role="list" className="space-y-1 text-sm text-gray-600">
                  {workflow.versions.map((v) => (
                    <li key={v.id}>
                      <span className="font-medium text-gray-900">v{v.version}</span> by {v.publishedBy}, {fmtDate(v.publishedAt)}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
