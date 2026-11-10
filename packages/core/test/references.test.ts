import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseBpmn, withFlowReferences } from '../src/bpmn/parse';

const example = () => readFile(new URL('../../../examples/invoice-approval.bpmn', import.meta.url), 'utf8');

/** Maps element id to its declared incoming/outgoing flow ids. */
function declaredReferences(xml: string) {
  const refs: Record<string, { incoming: string[]; outgoing: string[] }> = {};
  for (const m of xml.matchAll(/<bpmn:(?!process\b|definitions\b)(\w+) id="([^"]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/bpmn:\1>)/g)) {
    if (m[1] === 'sequenceFlow') continue;
    const body = m[3] ?? '';
    refs[m[2]!] = {
      incoming: [...body.matchAll(/<bpmn:incoming>([^<]+)<\/bpmn:incoming>/g)].map((x) => x[1]!).sort(),
      outgoing: [...body.matchAll(/<bpmn:outgoing>([^<]+)<\/bpmn:outgoing>/g)].map((x) => x[1]!).sort(),
    };
  }
  return refs;
}

describe('withFlowReferences', () => {
  it('declares every sequence flow on its source and target', async () => {
    const original = await example();
    expect(original).not.toContain('<bpmn:outgoing>');
    const ir = (await parseBpmn(original, 'invoice')).ir!;
    const refs = declaredReferences(await withFlowReferences(original));
    for (const node of Object.values(ir.nodes)) {
      expect(refs[node.id], node.id).toEqual({ incoming: [...node.incoming].sort(), outgoing: [...node.outgoing].sort() });
    }
  });

  it('does not duplicate references that are already declared', async () => {
    const once = await withFlowReferences(await example());
    const twice = await withFlowReferences(once);
    expect(declaredReferences(twice)).toEqual(declaredReferences(once));
  });

  it('preserves the executable graph, task config, conditions and timers', async () => {
    const original = await example();
    const before = await parseBpmn(original, 'invoice');
    const after = await parseBpmn(await withFlowReferences(original), 'invoice');
    expect(after.errors).toEqual([]);
    expect(after.ir).toEqual(before.ir);

    const timer = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="defs" targetNamespace="t">
  <bpmn:process id="p" isExecutable="true">
    <bpmn:startEvent id="s" />
    <bpmn:intermediateCatchEvent id="w"><bpmn:timerEventDefinition><bpmn:timeDuration>PT5M</bpmn:timeDuration></bpmn:timerEventDefinition></bpmn:intermediateCatchEvent>
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="a" sourceRef="s" targetRef="w" />
    <bpmn:sequenceFlow id="b" sourceRef="w" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`;
    expect((await parseBpmn(await withFlowReferences(timer), 't')).ir).toEqual((await parseBpmn(timer, 't')).ir);
  });
});
