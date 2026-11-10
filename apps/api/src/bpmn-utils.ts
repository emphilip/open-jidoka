import { withFlowReferences } from '@openjidoka/core/bpmn';
import { layoutProcess } from 'bpmn-auto-layout';

const count = (xml: string, pattern: RegExp) => (xml.match(pattern) ?? []).length;

/**
 * bpmn-js cannot render a process without diagram interchange, and older generated layouts drew no connections.
 * Generates a layout when the diagram is missing, or when it has sequence flows but not a single drawn edge;
 * any diagram with at least one edge (everything drawn in the modeler) is returned untouched.
 */
export async function layoutForDisplay(xml: string): Promise<string> {
  const hasDiagram = /<(\w+:)?BPMNDiagram[\s>]/.test(xml);
  const flows = count(xml, /<(\w+:)?sequenceFlow[\s>]/g);
  const edges = count(xml, /<(\w+:)?BPMNEdge[\s>]/g);
  if (hasDiagram && (flows === 0 || edges > 0)) return xml;
  return layoutProcess(await withFlowReferences(xml));
}

export function emptyProcessXml(key: string, name: string): string {
  const id = key.replace(/[^A-Za-z0-9_]/g, '_');
  const esc = name.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:jidoka="http://openjidoka.dev/schema/bpmn/1.0"
  id="Definitions_${id}" targetNamespace="http://openjidoka.dev/workflows">
  <bpmn:process id="${id}" name="${esc}" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${id}">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}
