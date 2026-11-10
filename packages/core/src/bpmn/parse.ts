/// <reference path="./bpmn-moddle.d.ts" />
import * as bpmnModdleLib from 'bpmn-moddle';
import jidokaModdle from './jidoka-moddle.json' with { type: 'json' };
import { checkSyntax, collectExpressions } from '../expressions';
import { parseIsoDuration } from '../duration';
import {
  AI_TASK_TYPES,
  TASK_TYPES,
  type FlowNode,
  type NodeType,
  type ParseIssue,
  type ParseResult,
  type SequenceFlow,
  type TaskType,
  type WorkflowIR,
} from '../types';

export { jidokaModdle };
export { withFlowReferences } from './references';

// bpmn-moddle's generated typings only describe model elements, not the factory.
type ModdleElement = any;
const createModdle = (bpmnModdleLib as unknown as { BpmnModdle: (pkgs: object) => any }).BpmnModdle;

const TASK_ELEMENTS = new Set([
  'bpmn:Task',
  'bpmn:ServiceTask',
  'bpmn:SendTask',
  'bpmn:BusinessRuleTask',
  'bpmn:ScriptTask',
]);

export async function parseBpmn(xml: string, key: string): Promise<ParseResult> {
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];
  const moddle = createModdle({ jidoka: jidokaModdle });

  let definitions: ModdleElement;
  try {
    const result = await moddle.fromXML(xml, 'bpmn:Definitions');
    definitions = result.rootElement;
    for (const w of result.warnings ?? []) warnings.push({ message: String(w.message ?? w) });
  } catch (err) {
    return { errors: [{ message: `Invalid BPMN XML: ${(err as Error).message}` }], warnings };
  }

  const processes: ModdleElement[] = (definitions.rootElements ?? []).filter(
    (e: ModdleElement) => e.$type === 'bpmn:Process',
  );
  if (processes.length === 0) return { errors: [{ message: 'No bpmn:Process found' }], warnings };
  const process = processes.find((p) => p.isExecutable) ?? processes[0];
  if (processes.length > 1) {
    warnings.push({ message: `Multiple processes found, executing "${process.id}" only` });
  }

  const nodes: Record<string, FlowNode> = {};
  const flows: Record<string, SequenceFlow> = {};

  for (const el of process.flowElements ?? []) {
    if (el.$type === 'bpmn:SequenceFlow') {
      flows[el.id] = {
        id: el.id,
        name: el.name || undefined,
        source: el.sourceRef?.id,
        target: el.targetRef?.id,
        condition: el.conditionExpression?.body?.trim() || undefined,
      };
      continue;
    }
    const node = toNode(el, errors);
    if (node) nodes[node.id] = node;
  }

  for (const flow of Object.values(flows)) {
    const source = nodes[flow.source];
    const target = nodes[flow.target];
    if (!source || !target) {
      errors.push({ elementId: flow.id, message: 'Sequence flow connects an unsupported or missing element' });
      continue;
    }
    source.outgoing.push(flow.id);
    target.incoming.push(flow.id);
    if (flow.condition) {
      const syntax = checkSyntax(flow.condition);
      if (syntax) errors.push({ elementId: flow.id, message: `Condition syntax error: ${syntax}` });
    }
  }

  const startNodeIds = Object.values(nodes)
    .filter((n) => n.type === 'startEvent')
    .map((n) => n.id);
  if (startNodeIds.length === 0) errors.push({ message: 'Process needs a start event' });
  if (!Object.values(nodes).some((n) => n.type === 'endEvent')) {
    errors.push({ message: 'Process needs an end event' });
  }

  for (const node of Object.values(nodes)) checkNode(node, flows, errors, warnings);
  checkReachability(nodes, flows, startNodeIds, warnings);

  if (errors.length > 0) return { errors, warnings };

  const ir: WorkflowIR = {
    key,
    name: process.name || key,
    processId: process.id,
    startNodeIds,
    nodes,
    flows,
  };
  return { ir, errors, warnings };
}

function readTaskConfig(el: ModdleElement, errors: ParseIssue[]) {
  const ext = (el.extensionElements?.values ?? []).find((v: ModdleElement) => v.$type === 'jidoka:TaskConfig');
  if (!ext) return { config: {} as Record<string, unknown> };
  let config: Record<string, unknown> = {};
  const body = ext.body?.trim();
  if (body) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config = parsed;
      else errors.push({ elementId: el.id, message: 'Task config must be a JSON object' });
    } catch (err) {
      errors.push({ elementId: el.id, message: `Task config is not valid JSON: ${(err as Error).message}` });
    }
  }
  return {
    taskType: ext.taskType as string | undefined,
    resultVariable: (ext.resultVariable as string | undefined) || undefined,
    config,
  };
}

function toNode(el: ModdleElement, errors: ParseIssue[]): FlowNode | undefined {
  const base = { id: el.id as string, name: (el.name as string) || undefined, incoming: [], outgoing: [] };
  const make = (type: NodeType, extra: Partial<FlowNode> = {}): FlowNode => ({ ...base, type, config: {}, ...extra });

  switch (el.$type) {
    case 'bpmn:StartEvent':
      if (el.eventDefinitions?.length) {
        errors.push({ elementId: el.id, message: 'Only plain start events are supported, use the API or a trigger to start runs' });
      }
      return make('startEvent');
    case 'bpmn:EndEvent':
      return make('endEvent');
    case 'bpmn:ExclusiveGateway':
      return make('exclusiveGateway', { defaultFlow: el.default?.id });
    case 'bpmn:ParallelGateway':
      return make('parallelGateway');
    case 'bpmn:IntermediateCatchEvent': {
      const def = el.eventDefinitions?.[0];
      if (def?.$type !== 'bpmn:TimerEventDefinition') {
        errors.push({ elementId: el.id, message: 'Only timer intermediate catch events are supported' });
        return undefined;
      }
      const raw = def.timeDuration?.body?.trim();
      const timerMs = raw ? parseIsoDuration(raw) : undefined;
      if (timerMs === undefined) {
        errors.push({ elementId: el.id, message: 'Timer needs an ISO 8601 duration such as PT15M or P1D' });
      }
      return make('timerEvent', { timerMs });
    }
    case 'bpmn:UserTask': {
      const { config, resultVariable } = readTaskConfig(el, errors);
      return make('userTask', { config, resultVariable });
    }
    default:
      break;
  }

  if (TASK_ELEMENTS.has(el.$type)) {
    const { taskType, config, resultVariable } = readTaskConfig(el, errors);
    let resolvedType = taskType as TaskType | undefined;
    if (!resolvedType && el.$type === 'bpmn:ScriptTask') {
      resolvedType = 'transform';
      if (el.script && !config.expression) config.expression = el.script;
    }
    return make('serviceTask', { taskType: resolvedType, config, resultVariable });
  }

  if (el.$type === 'bpmn:TextAnnotation' || el.$type === 'bpmn:Association' || el.$type === 'bpmn:DataObjectReference' || el.$type === 'bpmn:DataObject') {
    return undefined;
  }

  errors.push({ elementId: el.id, message: `Unsupported BPMN element ${el.$type}` });
  return undefined;
}

function requireKeys(node: FlowNode, keys: string[], errors: ParseIssue[]) {
  for (const k of keys) {
    if (node.config[k] === undefined || node.config[k] === '') {
      errors.push({ elementId: node.id, message: `${node.taskType} task requires config.${k}` });
    }
  }
}

function checkNode(
  node: FlowNode,
  flows: Record<string, SequenceFlow>,
  errors: ParseIssue[],
  warnings: ParseIssue[],
) {
  const label = node.name ?? node.id;
  if (node.type === 'startEvent' && node.incoming.length > 0) {
    errors.push({ elementId: node.id, message: 'Start event cannot have incoming flows' });
  }
  if (node.type !== 'endEvent' && node.outgoing.length === 0) {
    errors.push({ elementId: node.id, message: `"${label}" has no outgoing flow` });
  }
  if (node.type === 'endEvent' && node.outgoing.length > 0) {
    errors.push({ elementId: node.id, message: 'End event cannot have outgoing flows' });
  }

  if (node.type === 'exclusiveGateway' && node.outgoing.length > 1) {
    for (const flowId of node.outgoing) {
      if (flowId !== node.defaultFlow && !flows[flowId]!.condition) {
        errors.push({ elementId: flowId, message: `Flow out of gateway "${label}" needs a condition or must be the default flow` });
      }
    }
  }

  if (node.type === 'parallelGateway' && node.incoming.length > 1 && node.outgoing.length > 1) {
    warnings.push({
      elementId: node.id,
      message: `Parallel gateway "${label}" both joins and splits; it waits for all ${node.incoming.length} incoming flows. Merge alternative paths with an exclusive gateway first.`,
    });
  }

  if (node.type === 'serviceTask') {
    if (!node.taskType) {
      errors.push({ elementId: node.id, message: `Task "${label}" has no task type` });
      return;
    }
    if (!TASK_TYPES.includes(node.taskType)) {
      errors.push({ elementId: node.id, message: `Unknown task type "${node.taskType}"` });
      return;
    }
    switch (node.taskType) {
      case 'openjev.prompt':
        requireKeys(node, ['prompt'], errors);
        break;
      case 'openjev.extract':
        requireKeys(node, ['document', 'schema'], errors);
        break;
      case 'openjev.decide':
        requireKeys(node, ['question', 'options'], errors);
        if (node.config.options !== undefined && !Array.isArray(node.config.options) && typeof node.config.options !== 'string') {
          errors.push({ elementId: node.id, message: 'config.options must be an array or an expression' });
        }
        break;
      case 'connector':
        requireKeys(node, ['connection', 'action'], errors);
        break;
      case 'transform':
        requireKeys(node, ['expression'], errors);
        if (typeof node.config.expression === 'string') {
          const syntax = checkSyntax(node.config.expression);
          if (syntax) errors.push({ elementId: node.id, message: `Expression syntax error: ${syntax}` });
        }
        break;
    }
    if (AI_TASK_TYPES.includes(node.taskType) && !node.config.validation) {
      warnings.push({ elementId: node.id, message: `AI task "${label}" has no validation configured` });
    }
  }

  const exprConfig = node.taskType === 'transform' ? { ...node.config, expression: undefined } : node.config;
  for (const expr of collectExpressions(exprConfig)) {
    const syntax = checkSyntax(expr);
    if (syntax) errors.push({ elementId: node.id, message: `Expression "${expr}" syntax error: ${syntax}` });
  }
}

function checkReachability(
  nodes: Record<string, FlowNode>,
  flows: Record<string, SequenceFlow>,
  startNodeIds: string[],
  warnings: ParseIssue[],
) {
  const seen = new Set<string>();
  const stack = [...startNodeIds];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const f of nodes[id]?.outgoing ?? []) stack.push(flows[f]!.target);
  }
  for (const node of Object.values(nodes)) {
    if (!seen.has(node.id)) warnings.push({ elementId: node.id, message: `"${node.name ?? node.id}" is unreachable` });
  }
}
