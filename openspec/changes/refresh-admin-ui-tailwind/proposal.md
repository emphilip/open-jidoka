# Proposal

## Why

The admin UI is styled with a hand-written stylesheet that predates the project's UI standard (Tailwind CSS v4 built
from Tailwind Plus components). It is not usable on narrow screens, has no empty states, and every new screen adds
more custom CSS. Refreshing it now, while it has seven screens, is cheaper than after more features land.

## What Changes

- Rebuild every admin screen (sign-in, app shell, workflows, workflow editor chrome, runs, run detail, task inbox,
  connections, audit log) from Tailwind Plus Application UI blocks, adapted to the existing data and behavior.
- Replace the custom stylesheet with Tailwind utilities and a small set of shared UI components (button, badge,
  card, table, form fields, alert, page heading, empty state). Keep only a minimal CSS block for bpmn-js markers.
- Add a responsive app shell: a collapsible navigation drawer on small screens, the fixed sidebar on large screens.
- Show statuses as text badges with color as a secondary cue; add empty states with a next action to the list screens.
- No change to API calls, routes, data handling, or the BPMN modeler and viewer behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-ui`: adds requirements for responsive layout, status presentation that does not rely on color alone, and
  empty states with a next action. Existing requirements are unchanged.

## Out of scope

- Dark mode (the bpmn-js canvas has no matching dark theme yet).
- Replacing bpmn-js or changing modeler and viewer behavior, including the properties panel's fields.
- New screens or features (SSO, dashboards, search, pagination).
- Code-splitting the bundle (tracked separately under Known issues).

## Affected README sections and specs

- README: Architecture (admin row), Feature status, Known issues (bundle size note), Changelog and version (0.3.0).
- Specs: `admin-ui`.

## Impact

- Code: `apps/admin` only (`src/**`, `vite.config.ts`, `index.html`); `src/styles.css` shrinks to Tailwind imports,
  theme tokens and the bpmn-js marker block.
- Dependencies (admin only): `tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/forms`, `@headlessui/react`,
  `@heroicons/react`.
- No API, database, worker or deployment changes; the admin container is rebuilt as before.
