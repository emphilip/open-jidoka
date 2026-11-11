# Proposal

## Why

BPMN imported without a diagram layout gets a generated one, but the layout library only follows each element's
optional `incoming`/`outgoing` references. BPMN that declares flows only through `sourceRef`/`targetRef` (valid, and
how the bundled examples are written) is laid out as a single column with no connections drawn, so diagrams such as
the seeded invoice workflow look linear and have no arrows in the modeler and the run viewer. Execution is not
affected. Diagrams already stored this way, including published versions, need to display correctly too.

## What Changes

- Before generating a layout, derive each element's incoming and outgoing flow references from the sequence flows, so
  the generated layout includes every connection and follows the process's branches and joins.
- When a stored draft or published version has sequence flows but no drawn connections at all, return a freshly
  generated layout wherever the API serves diagram XML (workflow draft, published version, run detail).
- Published versions stay unchanged in storage; the regenerated layout is only used for display. A draft served with a
  regenerated layout is stored the next time the user saves it.
- Diagrams that already have drawn connections are never re-laid out, so hand-arranged diagrams keep their positions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workflow-definitions`: the Drafts requirement now requires generated layouts to draw every sequence flow and follow
  branches, and a new requirement covers displaying stored diagrams that have no drawn connections.

## Out of scope

- Improving layout quality beyond the library's output (spacing, label placement, manual arrangement).
- Changing stored published versions or their executable form.
- Detecting diagrams that miss only some connections; only diagrams with none drawn are regenerated.

## Affected README sections and specs

- README: API (diagram XML in responses), Business rules (immutability note), Known issues (remove the single-column
  layout item), Feature status, Changelog and version (0.3.1).
- Specs: `workflow-definitions`.

## Impact

- Code: `packages/core` (flow reference normalization next to the BPMN parser), `apps/api` (layout and the three
  endpoints that return diagram XML), tests in both.
- No database migration, no worker or admin UI changes, no new dependencies.
