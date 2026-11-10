import { useEffect, useState } from 'react';
import type { Catalog } from '../api';
import { Button, Card, CardBody, CardHeader, Checkbox, Field, Input, Select, Textarea } from '../components/ui';
import {
  getTaskConfig,
  prettyJson,
  setCondition,
  setDefaultFlow,
  setTimerDuration,
  TASK_ELEMENT_TYPES,
  updateTaskConfig,
} from './helpers';

interface Props {
  modeler: any;
  element: any;
  catalog?: Catalog;
  connections: Array<{ name: string; type: string }>;
}

const TASK_TYPE_HELP: Record<string, string> = {
  'openjev.prompt': 'Free-form reasoning with OpenJEV. Returns outputSchema-shaped JSON plus reasoning.',
  'openjev.extract': 'Extract structured data from a document (url, base64, text or SharePoint item).',
  'openjev.decide': 'Pick one of a fixed set of options with confidence and reasoning; route on it with a gateway.',
  connector: 'Call an enterprise connector action (SharePoint, Teams, Outlook, HTTP).',
  transform: 'Compute a value with a JSONata expression (runs deterministically inside the workflow).',
};

const code = (s: string) => <code className="font-mono text-xs text-gray-700">{s}</code>;

function TextField(props: { label: string; value: string; onCommit: (v: string) => void; placeholder?: string; multiline?: boolean; mono?: boolean; rows?: number }) {
  const [value, setValue] = useState(props.value);
  useEffect(() => setValue(props.value), [props.value]);
  const common = {
    value,
    placeholder: props.placeholder,
    mono: props.mono,
    onChange: (e: { target: { value: string } }) => setValue(e.target.value),
    onBlur: () => value !== props.value && props.onCommit(value),
  };
  return (
    <Field label={props.label}>
      {(id) => (props.multiline ? <Textarea id={id} rows={props.rows ?? 4} {...common} /> : <Input id={id} {...common} />)}
    </Field>
  );
}

function ConfigEditor({ modeler, element, templateKey, catalog }: { modeler: any; element: any; templateKey?: string; catalog?: Catalog }) {
  const cfg = getTaskConfig(element.businessObject);
  const [text, setText] = useState(prettyJson(cfg?.body));
  const [error, setError] = useState('');
  useEffect(() => setText(prettyJson(getTaskConfig(element.businessObject)?.body)), [element, cfg?.body]);

  function commit(next: string) {
    if (next.trim()) {
      try {
        JSON.parse(next);
      } catch (err) {
        setError(`Invalid JSON: ${(err as Error).message}`);
        return;
      }
    }
    setError('');
    if (next !== (cfg?.body ?? '')) updateTaskConfig(modeler, element, { body: next });
  }

  const template = templateKey ? catalog?.templates[templateKey] : undefined;
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm/6 font-medium text-gray-900">Config (JSON)</span>
        {template && (
          <Button
            variant="link"
            className="text-sm"
            onClick={() => {
              const next = JSON.stringify(template, null, 2);
              setText(next);
              commit(next);
            }}
          >
            Insert template
          </Button>
        )}
      </div>
      <Textarea
        aria-label="Config (JSON)"
        className="mt-2"
        mono
        rows={16}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(text)}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-xs/5 text-gray-500">
        Strings starting with {code('=')} are JSONata expressions; {code('{{ expr }}')} interpolates. Data: {code('input')}, {code('vars')},{' '}
        {code('nodes')}, {code('run')}.
      </p>
    </div>
  );
}

export function PropertiesPanel({ modeler, element, catalog, connections }: Props) {
  if (!element) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-gray-500">Select an element in the diagram to edit its properties.</p>
        </CardBody>
      </Card>
    );
  }
  const bo = element.businessObject;
  const type: string = bo.$type;
  const modeling = modeler.get('modeling');
  const cfg = getTaskConfig(bo);
  const isTask = TASK_ELEMENT_TYPES.includes(type);
  const isUserTask = type === 'bpmn:UserTask';
  const isFlow = type === 'bpmn:SequenceFlow';
  const isTimer = bo.eventDefinitions?.[0]?.$type === 'bpmn:TimerEventDefinition';
  const taskType: string = cfg?.taskType ?? (type === 'bpmn:ScriptTask' ? 'transform' : '');
  const source = isFlow ? bo.sourceRef : undefined;
  const fromGateway = source?.$type === 'bpmn:ExclusiveGateway';
  const connector = taskType === 'connector' ? catalog?.connectors : undefined;

  return (
    <Card key={element.id}>
      <CardHeader title={type.replace('bpmn:', '')} description={code(element.id)} />
      <CardBody className="space-y-5">
        {type !== 'bpmn:Process' && (
          <TextField label="Name" value={bo.name ?? ''} onCommit={(name) => modeling.updateProperties(element, { name: name || undefined })} />
        )}

        {isTask && (
          <>
            <Field label="Task type" hint={taskType ? TASK_TYPE_HELP[taskType] : undefined}>
              {(id) => (
                <Select
                  id={id}
                  value={taskType}
                  onChange={(e) => {
                    const next = e.target.value;
                    const body = cfg?.body?.trim() ? undefined : JSON.stringify(catalog?.templates[next] ?? {}, null, 2);
                    updateTaskConfig(modeler, element, { taskType: next, ...(body ? { body } : {}) });
                  }}
                >
                  <option value="">Choose a task type</option>
                  {(catalog?.taskTypes ?? []).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <TextField
              label="Result variable (stored under vars)"
              value={cfg?.resultVariable ?? ''}
              placeholder="e.g. invoice"
              onCommit={(v) => updateTaskConfig(modeler, element, { resultVariable: v })}
            />
            {taskType && <ConfigEditor modeler={modeler} element={element} templateKey={taskType} catalog={catalog} />}
            {connector && (
              <div>
                <span className="block text-sm/6 font-medium text-gray-900">Connections</span>
                <ul role="list" className="mt-2 divide-y divide-gray-100 border-t border-b border-gray-100">
                  {connections.map((c) => {
                    const def = connector.find((x) => x.type === c.type);
                    return (
                      <li key={c.name} className="py-3">
                        <p className="font-mono text-xs/5 font-semibold text-gray-900">{c.name}</p>
                        <p className="mt-1 text-xs/5 text-gray-500">
                          {def?.displayName ?? c.type}: {def ? Object.keys(def.actions).join(', ') : 'unknown type'}
                        </p>
                      </li>
                    );
                  })}
                  {connections.length === 0 && <li className="py-3 text-xs/5 text-gray-500">No connections yet. Add one under Connections.</li>}
                </ul>
              </div>
            )}
          </>
        )}

        {isUserTask && (
          <>
            <TextField
              label="Result variable (stored under vars)"
              value={cfg?.resultVariable ?? ''}
              placeholder="e.g. approval"
              onCommit={(v) => updateTaskConfig(modeler, element, { resultVariable: v })}
            />
            <ConfigEditor modeler={modeler} element={element} templateKey="user" catalog={catalog} />
            <p className="text-xs/5 text-gray-500">The result is {code('{ approved, actor, ...formFields }')}.</p>
          </>
        )}

        {isFlow && (
          <>
            {fromGateway && (
              <Checkbox
                label="Default flow"
                description="Taken when no other condition matches."
                checked={source.default?.id === bo.id}
                onChange={(e) => setDefaultFlow(modeler, element, e.target.checked)}
              />
            )}
            <TextField
              label="Condition (JSONata)"
              multiline
              mono
              rows={3}
              value={bo.conditionExpression?.body ?? ''}
              placeholder='vars.decision.choice = "approve"'
              onCommit={(v) => setCondition(modeler, element, v)}
            />
          </>
        )}

        {isTimer && (
          <TextField
            label="Wait duration (ISO 8601)"
            value={bo.eventDefinitions[0].timeDuration?.body ?? ''}
            placeholder="PT15M, P1D"
            onCommit={(v) => setTimerDuration(modeler, element, v)}
          />
        )}
      </CardBody>
    </Card>
  );
}
