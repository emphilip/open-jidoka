import { LinkIcon } from '@heroicons/react/24/outline';
import { PlusIcon } from '@heroicons/react/20/solid';
import { useRef, useState, type FormEvent } from 'react';
import { api, fmtDate, type Catalog } from '../api';
import { Page } from '../components/AppShell';
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, ListHeader, RowActions, RowLink, RowMenu, Select, Table } from '../components/ui';
import { useResource } from '../hooks';

interface Connection {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  secretEnv: string | null;
  updatedAt: string;
}

const blank = { id: '', name: '', type: 'sharepoint', config: {} as Record<string, string>, secretEnv: '' };

export function ConnectionsPage() {
  const { data, error, reload } = useResource(() => Promise.all([api<Connection[]>('/connections'), api<Catalog>('/catalog')]), []);
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState('');
  const formRef = useRef<HTMLDivElement>(null);
  const [connections, catalog] = data ?? [];
  const connector = catalog?.connectors.find((c) => c.type === form.type);
  const focusForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth' });

  function edit(c: Connection) {
    setForm({
      id: c.id,
      name: c.name,
      type: c.type,
      config: Object.fromEntries(Object.entries(c.config).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])),
      secretEnv: c.secretEnv ?? '',
    });
    focusForm();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    try {
      const config: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form.config)) {
        if (!v) continue;
        config[k] = v.trim().startsWith('{') ? JSON.parse(v) : v;
      }
      const body = { config, secretEnv: form.secretEnv || null };
      if (form.id) await api(`/connections/${form.id}`, { method: 'PUT', body });
      else await api('/connections', { body: { ...body, name: form.name, type: form.type } });
      setForm(blank);
      reload();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function remove(c: Connection) {
    if (!confirm(`Delete connection ${c.name}? Workflows that use it will fail.`)) return;
    await api(`/connections/${c.id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <Page>
      <ListHeader
        title="Connections"
        description={
          <>
            Non-secret settings for enterprise systems. Secrets stay in the worker environment and are referenced by variable name, which must start
            with <code className="font-mono text-xs">OPENJIDOKA_SECRET_</code>.
          </>
        }
        action={
          <Button
            variant="primary"
            onClick={() => {
              setForm(blank);
              focusForm();
            }}
          >
            New connection
          </Button>
        }
      />
      {error && <Alert tone="error" title="Could not load connections">{error}</Alert>}

      {connections && connections.length === 0 ? (
        <EmptyState
          icon={LinkIcon}
          title="No connections yet"
          description="Connector tasks call SharePoint, Teams, Outlook or HTTP APIs through a named connection. Add one, then reference its name in a task's config."
          action={
            <Button variant="primary" icon={PlusIcon} onClick={focusForm}>
              Add connection
            </Button>
          }
        />
      ) : (
        <Table
          rows={connections ?? []}
          rowKey={(c) => c.id}
          columns={[
            { header: 'Name', cell: (c) => <span className="font-mono text-xs">{c.name}</span> },
            { header: 'Type', cell: (c) => catalog?.connectors.find((x) => x.type === c.type)?.displayName ?? c.type },
            { header: 'Secret env var', hideBelow: 'sm', cell: (c) => (c.secretEnv ? <span className="font-mono text-xs">{c.secretEnv}</span> : 'none') },
            { header: 'Updated', hideBelow: 'lg', cell: (c) => fmtDate(c.updatedAt) },
          ]}
          action={(c) => (
            <RowActions>
              <RowLink onClick={() => edit(c)} label="Edit" name={c.name} />
              <RowMenu name={c.name} items={[{ label: 'Delete', danger: true, onClick: () => remove(c) }]} />
            </RowActions>
          )}
        />
      )}

      <div ref={formRef}>
        <Card className="max-w-2xl">
          <CardHeader title={form.id ? `Edit ${form.name}` : 'New connection'} description={connector?.description} />
          <CardBody>
            <form onSubmit={submit} className="space-y-6">
              {!form.id && (
                <>
                  <Field label="Name" hint="Referenced from task config as connection.">
                    {(id) => <Input id={id} mono value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}
                  </Field>
                  <Field label="Type">
                    {(id) => (
                      <Select id={id} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, config: {} })}>
                        {catalog?.connectors.map((c) => (
                          <option key={c.type} value={c.type}>
                            {c.displayName}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </>
              )}
              {connector?.configFields.map((f) => (
                <Field key={f.name} label={`${f.label}${f.required ? ' *' : ''}`} hint={f.description}>
                  {(id) => (
                    <Input
                      id={id}
                      value={form.config[f.name] ?? ''}
                      required={f.required}
                      onChange={(e) => setForm({ ...form, config: { ...form.config, [f.name]: e.target.value } })}
                    />
                  )}
                </Field>
              ))}
              {connector?.secretDescription && (
                <Field label="Secret env var" hint={connector.secretDescription}>
                  {(id) => (
                    <Input
                      id={id}
                      mono
                      value={form.secretEnv}
                      placeholder="OPENJIDOKA_SECRET_..."
                      onChange={(e) => setForm({ ...form, secretEnv: e.target.value.toUpperCase() })}
                    />
                  )}
                </Field>
              )}
              {connector && (
                <div>
                  <span className="block text-sm/6 font-medium text-gray-900">Available actions</span>
                  <ul role="list" className="mt-2 divide-y divide-gray-100 border-t border-b border-gray-100">
                    {Object.entries(connector.actions).map(([name, a]) => (
                      <li key={name} className="py-3">
                        <p className="font-mono text-xs/5 font-semibold text-gray-900">{name}</p>
                        <p className="mt-1 text-xs/5 text-gray-500">
                          {a.description} Params: {Object.keys(a.params).join(', ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {formError && <Alert tone="error" title="Could not save connection">{formError}</Alert>}
              <div className="flex justify-end gap-3">
                {form.id && <Button onClick={() => setForm(blank)}>Cancel</Button>}
                <Button type="submit" variant="primary">
                  {form.id ? 'Save' : 'Create connection'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
