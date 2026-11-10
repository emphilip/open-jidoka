import { readFile } from 'node:fs/promises';
import { parseBpmn } from '@openjidoka/core/bpmn';
import { layoutProcess } from 'bpmn-auto-layout';
import { describe, expect, it } from 'vitest';
import { emptyProcessXml, layoutForDisplay } from '../src/bpmn-utils';

const example = () => readFile(new URL('../../../examples/invoice-approval.bpmn', import.meta.url), 'utf8');
const edges = (xml: string) => (xml.match(/<bpmndi:BPMNEdge /g) ?? []).length;
const flows = (xml: string) => (xml.match(/<bpmn:sequenceFlow /g) ?? []).length;
const shapeY = (xml: string) => new Set([...xml.matchAll(/<bpmndi:BPMNShape [\s\S]*?<dc:Bounds x="[-\d.]+" y="([-\d.]+)"/g)].map((m) => m[1]));
const elementIds = (xml: string) =>
  [...xml.matchAll(/<bpmn:(?!definitions\b|process\b)\w+ id="([^"]+)"/g)].map((m) => m[1]).sort();

describe('layoutForDisplay', () => {
  it('lays out BPMN without diagram with one edge per flow and branches on separate rows', async () => {
    const xml = await example();
    const out = await layoutForDisplay(xml);
    expect(edges(out)).toBe(flows(xml));
    expect(shapeY(out).size).toBeGreaterThan(1);
    expect(elementIds(out)).toEqual(elementIds(xml));
    expect((await parseBpmn(out, 'invoice')).ir).toEqual((await parseBpmn(xml, 'invoice')).ir);
  });

  it('re-lays out a stored diagram that has shapes but no edges (the old generated layout)', async () => {
    const broken = await layoutProcess(await example());
    expect(edges(broken)).toBe(0);
    const repaired = await layoutForDisplay(broken);
    expect(edges(repaired)).toBe(flows(broken));
  });

  it('returns a diagram that already has edges byte for byte', async () => {
    const drawn = await layoutForDisplay(await example());
    expect(await layoutForDisplay(drawn)).toBe(drawn);
  });

  it('leaves a diagram without flows unchanged', async () => {
    const empty = emptyProcessXml('fresh', 'Fresh');
    expect(await layoutForDisplay(empty)).toBe(empty);
  });
});
