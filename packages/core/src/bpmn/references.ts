/// <reference path="./bpmn-moddle.d.ts" />
import * as bpmnModdleLib from 'bpmn-moddle';
import jidokaModdle from './jidoka-moddle.json' with { type: 'json' };

type ModdleElement = any;
const createModdle = (bpmnModdleLib as unknown as { BpmnModdle: (pkgs: object) => any }).BpmnModdle;

function processesOf(definitions: ModdleElement): ModdleElement[] {
  return (definitions.rootElements ?? []).filter((e: ModdleElement) => e.$type === 'bpmn:Process');
}

function fillReferences(container: ModdleElement) {
  for (const el of container.flowElements ?? []) {
    if (el.$type === 'bpmn:SequenceFlow') {
      const outgoing: ModdleElement[] = el.sourceRef?.get('outgoing');
      const incoming: ModdleElement[] = el.targetRef?.get('incoming');
      if (outgoing && !outgoing.includes(el)) outgoing.push(el);
      if (incoming && !incoming.includes(el)) incoming.push(el);
    } else if (el.flowElements) {
      fillReferences(el);
    }
  }
}

/**
 * Adds each flow node's `incoming`/`outgoing` references from the sequence flows. BPMN may declare flows only via
 * `sourceRef`/`targetRef`; tools that walk the graph through the references (such as bpmn-auto-layout) need both.
 */
export async function withFlowReferences(xml: string): Promise<string> {
  const moddle = createModdle({ jidoka: jidokaModdle });
  const { rootElement } = await moddle.fromXML(xml, 'bpmn:Definitions');
  for (const process of processesOf(rootElement)) fillReferences(process);
  const { xml: out } = await moddle.toXML(rootElement, { format: true });
  return out;
}
