# Tasks

## 1. Flow reference normalization (core)

- [x] 1.1 Add `withFlowReferences(xml)` to `packages/core/src/bpmn` (bpmn-moddle with the `jidoka` descriptor), exported from `@openjidoka/core/bpmn`; verify a unit test shows every flow node's incoming/outgoing match its sequence flows
- [x] 1.2 Test that normalization preserves semantics: `parseBpmn` of the invoice example yields the same nodes, flows, conditions, task config and timers before and after; verify `pnpm --filter @openjidoka/core test` passes

## 2. Layout in the API

- [x] 2.1 Replace `ensureDiagram` with `layoutForDisplay(xml)` (no diagram, or flows with zero drawn edges → normalize then layout; otherwise unchanged); verify unit tests: invoice example gets one edge per flow and more than one row; a modeler-drawn diagram with edges is returned byte-for-byte; element ids are preserved
- [x] 2.2 Use it on import (`POST /workflows`, seed) and on read (`GET /workflows/:id` draft, `GET /workflows/:id/versions/:version`, `GET /runs/:id`) without writing to storage; verify via the API that the seeded invoice draft, v1 and a run of it return 15 edges while the stored version XML in Postgres still has 0
- [x] 2.3 Restore the `apps/api` test script so the new tests run under `pnpm test`; verify `pnpm test` runs them

## 3. Documentation

- [x] 3.1 Update README: API note on diagram XML, Business rules (display-only repair, published versions unchanged), remove the single-column Known issue, Feature status entry, version 0.3.1 and dated changelog; verify README and `package.json` versions match

## 4. Verification

- [x] 4.1 Open the seeded invoice workflow in the editor and a run of it in the admin UI at 1440px and check arrows and branches render; save the draft and verify the stored draft now has edges
- [x] 4.2 Run the smoke test against the rebuilt api container; verify both scenarios pass
- [x] 4.3 Run `pnpm typecheck`, `pnpm test` and `openspec validate --all --strict --no-interactive`; verify all pass

## Workflow follow-up

- Archive the change with `/opsx-archive` after review.
