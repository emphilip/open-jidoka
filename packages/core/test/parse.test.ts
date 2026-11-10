import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseBpmn } from '../src/bpmn/parse';
import { parseIsoDuration } from '../src/duration';
import { resolveValue } from '../src/expressions';

const example = new URL('../../../examples/invoice-approval.bpmn', import.meta.url);

const wrap = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:jidoka="http://openjidoka.dev/schema/bpmn/1.0" id="defs" targetNamespace="t">
  <bpmn:process id="p" isExecutable="true">${body}</bpmn:process>
</bpmn:definitions>`;

describe('parseBpmn', () => {
  it('parses the invoice example into an executable graph', async () => {
    const result = await parseBpmn(await readFile(example, 'utf8'), 'invoice');
    expect(result.errors).toEqual([]);
    const ir = result.ir!;
    expect(ir.startNodeIds).toEqual(['start']);
    expect(ir.nodes.extract!.taskType).toBe('openjev.extract');
    expect(ir.nodes.extract!.resultVariable).toBe('invoice');
    expect(ir.nodes.route!.defaultFlow).toBe('f_route_review');
    expect(ir.flows.f_route_auto!.condition).toContain('vars.decision.choice');
    expect(ir.nodes.archive_join!.incoming).toHaveLength(2);
    expect(ir.nodes.approve!.type).toBe('userTask');
  });

  it('reports missing task types and unconditioned gateway flows', async () => {
    const result = await parseBpmn(
      wrap(`
      <bpmn:startEvent id="s" />
      <bpmn:task id="t" name="Untyped" />
      <bpmn:exclusiveGateway id="g" />
      <bpmn:endEvent id="e1" /><bpmn:endEvent id="e2" />
      <bpmn:sequenceFlow id="a" sourceRef="s" targetRef="t" />
      <bpmn:sequenceFlow id="b" sourceRef="t" targetRef="g" />
      <bpmn:sequenceFlow id="c" sourceRef="g" targetRef="e1" />
      <bpmn:sequenceFlow id="d" sourceRef="g" targetRef="e2" />`),
      'bad',
    );
    expect(result.ir).toBeUndefined();
    const ids = result.errors.map((e) => e.elementId);
    expect(ids).toContain('t');
    expect(ids).toContain('c');
    expect(ids).toContain('d');
  });

  it('rejects invalid JSONata in conditions', async () => {
    const result = await parseBpmn(
      wrap(`
      <bpmn:startEvent id="s" /><bpmn:endEvent id="e" />
      <bpmn:sequenceFlow id="a" sourceRef="s" targetRef="e"><bpmn:conditionExpression>vars.x = = 1</bpmn:conditionExpression></bpmn:sequenceFlow>`),
      'bad',
    );
    expect(result.errors.some((e) => e.elementId === 'a')).toBe(true);
  });

  it('parses timer durations', async () => {
    const result = await parseBpmn(
      wrap(`
      <bpmn:startEvent id="s" />
      <bpmn:intermediateCatchEvent id="w"><bpmn:timerEventDefinition><bpmn:timeDuration>PT1H30M</bpmn:timeDuration></bpmn:timerEventDefinition></bpmn:intermediateCatchEvent>
      <bpmn:endEvent id="e" />
      <bpmn:sequenceFlow id="a" sourceRef="s" targetRef="w" />
      <bpmn:sequenceFlow id="b" sourceRef="w" targetRef="e" />`),
      'timer',
    );
    expect(result.errors).toEqual([]);
    expect(result.ir!.nodes.w!.timerMs).toBe(90 * 60 * 1000);
  });
});

describe('expressions', () => {
  it('resolves expressions and templates recursively', async () => {
    const ctx = { input: { name: 'Ada', items: [1, 2, 3] }, vars: {} };
    const resolved = await resolveValue(
      { greeting: 'Hi {{ input.name }}', total: '=$sum(input.items)', nested: ['={ "n": input.name }'], plain: 3 },
      ctx,
    );
    expect(resolved).toEqual({ greeting: 'Hi Ada', total: 6, nested: [{ n: 'Ada' }], plain: 3 });
  });

  it('parses ISO durations', () => {
    expect(parseIsoDuration('P1D')).toBe(86_400_000);
    expect(parseIsoDuration('PT0.5S')).toBe(500);
    expect(parseIsoDuration('P1W')).toBe(604_800_000);
    expect(parseIsoDuration('PT')).toBeUndefined();
    expect(parseIsoDuration('1 hour')).toBeUndefined();
  });
});
