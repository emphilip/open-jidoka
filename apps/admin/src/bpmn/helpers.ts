// bpmn-js services are untyped dependency-injection lookups.
type Modeler = any;
type Element = any;

export const TASK_ELEMENT_TYPES = ['bpmn:Task', 'bpmn:ServiceTask', 'bpmn:SendTask', 'bpmn:BusinessRuleTask', 'bpmn:ScriptTask'];

export function getTaskConfig(bo: any): any | undefined {
  return bo?.extensionElements?.values?.find((v: any) => v.$type === 'jidoka:TaskConfig');
}

function ensureTaskConfig(modeler: Modeler, element: Element) {
  const bo = element.businessObject;
  const moddle = modeler.get('moddle');
  const modeling = modeler.get('modeling');
  let ext = bo.extensionElements;
  if (!ext) {
    ext = moddle.create('bpmn:ExtensionElements', { values: [] });
    modeling.updateProperties(element, { extensionElements: ext });
  }
  let cfg = getTaskConfig(bo);
  if (!cfg) {
    cfg = moddle.create('jidoka:TaskConfig');
    cfg.$parent = ext;
    modeling.updateModdleProperties(element, ext, { values: [...(ext.values ?? []), cfg] });
  }
  return cfg;
}

export function updateTaskConfig(
  modeler: Modeler,
  element: Element,
  patch: { taskType?: string; resultVariable?: string; body?: string },
) {
  const cfg = ensureTaskConfig(modeler, element);
  const clean = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === '' ? undefined : v]));
  modeler.get('modeling').updateModdleProperties(element, cfg, clean);
}

export function setCondition(modeler: Modeler, flow: Element, body: string) {
  const moddle = modeler.get('moddle');
  modeler.get('modeling').updateProperties(flow, {
    conditionExpression: body.trim() ? moddle.create('bpmn:FormalExpression', { body }) : undefined,
  });
}

export function setDefaultFlow(modeler: Modeler, flow: Element, isDefault: boolean) {
  const source = modeler.get('elementRegistry').get(flow.businessObject.sourceRef.id);
  modeler.get('modeling').updateProperties(source, { default: isDefault ? flow.businessObject : undefined });
}

export function setTimerDuration(modeler: Modeler, element: Element, body: string) {
  const def = element.businessObject.eventDefinitions?.[0];
  if (!def) return;
  const moddle = modeler.get('moddle');
  modeler.get('modeling').updateModdleProperties(element, def, {
    timeDuration: body.trim() ? moddle.create('bpmn:FormalExpression', { body }) : undefined,
  });
}

export function prettyJson(text: string | undefined): string {
  if (!text?.trim()) return '';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
