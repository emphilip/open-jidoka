# Tasks

## 1. Setup

- [x] 1.1 Add `tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/forms`, `@headlessui/react`, `@heroicons/react` to `apps/admin` and register the Vite plugin; verify `pnpm --filter @openjidoka/admin build` succeeds
- [x] 1.2 Replace `src/styles.css` with Tailwind imports, the forms plugin, a brand `@theme` token and the labelled `jidoka-*` bpmn-js marker block, importing bpmn-js CSS after Tailwind; verify the build still emits the bpmn-js font and the editor canvas renders
- [x] 1.3 Fetch the Tailwind Plus blocks listed in design.md (React, v4) with the tailwind-ui skill script into a scratch folder outside the repo; verify every listed block was fetched

## 2. Shared UI components

- [x] 2.1 Create `src/components/ui/` (Button, Badge, Card, Table, Field inputs, Alert, PageHeading, EmptyState, DescriptionList) adapted from the fetched blocks; verify `pnpm --filter @openjidoka/admin typecheck` passes
- [x] 2.2 Map run, step and task statuses to labelled badges (text always shown, color secondary); verify every status value in the API types has a badge variant

## 3. App shell and sign-in

- [x] 3.1 Build the app shell from the dark sidebar block: fixed sidebar from 1024px, Headless UI drawer below it, current section highlighted, actor name and sign-out in the sidebar; verify navigation works at 390px and 1440px
- [x] 3.2 Rebuild sign-in from the simple card block with the same fields and 401 handling; verify a wrong token shows an error alert and a correct one signs in

## 4. Screens

- [x] 4.1 Workflows list: table in card, archive/restore, create form (stacked layout) with BPMN import, empty state; verify create, import and archive still work
- [x] 4.2 Workflow editor chrome: page heading with breadcrumbs and save/validate/publish/start-run actions, alerts for messages, side panel cards for properties, problems and versions; verify the properties panel edits, validation markers, publish and start run behave as before
- [x] 4.3 Runs list: table with status filter and badges, empty state; verify filtering and auto-refresh
- [x] 4.4 Run detail: page heading with meta and cancel action, error alert, waiting-task notice, viewer card, steps table with validation and reasoning, input/output panels; verify markers, step filtering by element and cancel still work
- [x] 4.5 Task inbox: task cards with description list context, form fields, approve/reject, AI review badge, empty state linking to runs; verify approving a review with corrected JSON and rejecting both work
- [x] 4.6 Connections and audit log: tables, connection form from connector config fields, delete confirmation, empty state; verify create, edit and delete
- [x] 4.7 Remove unused custom CSS classes and the old `Json`/badge styles; verify `rg "className=\"(card|banner|panel|muted)"` finds nothing in `apps/admin/src`

## 5. Documentation

- [x] 5.1 Update README.md: Architecture admin row, Feature status entry dated on completion, Known issues (bundle size), version 0.3.0 and dated changelog entry; verify the version in README and `package.json` match

## 6. Verification

- [x] 6.1 Capture headless screenshots of every screen at 390px and 1440px against the running stack and review them for layout breaks and bpmn-js rendering; verify no horizontal page scroll at 390px
- [x] 6.2 Rebuild the admin container and run `scripts/smoke-test.sh`; verify both scenarios pass and the admin UI loads through nginx
- [x] 6.3 Run `pnpm typecheck`, `pnpm test` and `openspec validate --all --strict --no-interactive`; verify all pass

## 7. Tailwind Plus fidelity pass (review feedback)

- [x] 7.1 Badges: status pills use the bordered badge block; inline tags (archived, AI review, problem kinds, diagram legend) use the small bordered badge; verify `rg "size-3 rounded-sm|rounded px-1.5|fill-(gray|red|green|blue|yellow|indigo)-[45]00" apps/admin/src` finds nothing
- [x] 7.2 Tables: Table component uses the Simple in card block's exact wrapper, cell and header classes (edge to edge below `sm`) and supports folding secondary columns under the first column on narrow screens; verify list pages have no in-table horizontal scroll at 390px
- [x] 7.3 Row actions: one text link per row in the last column (block link classes), extra actions in the ellipsis menu block; apply to workflows, runs, connections; verify archive, restore and delete still work through the menu
- [x] 7.4 Headings: list pages use the table block header; Steps uses the section heading block; cards use the card heading block; verify every screen still renders its title, description and primary action
- [x] 7.5 Details drawer: step and audit details open in the drawer block (description list, reasoning, validation issues, JSON); remove native `<details>` disclosures and table-cell JSON; verify `rg "<details" apps/admin/src` finds nothing and the drawer shows a step's output and validation
- [x] 7.6 BPMN import uses the stacked form's upload dropzone; sidebar actor uses the placeholder-initials avatar; verify importing a file still creates a workflow
- [x] 7.7 Re-run the interaction checks, screenshots at 390px and 1440px, smoke test, `pnpm typecheck`, `pnpm test` and `openspec validate --all --strict --no-interactive`; verify all pass

## Workflow follow-up

- Archive the change with `/opsx-archive` after review, so the `admin-ui` spec gains the new requirements.
