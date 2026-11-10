# Agent instructions

This project uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) for all changes.

- Requirements baseline: `openspec/specs/`. Project constraints: `openspec/config.yaml` (read it first).
- Every change (feature, fix, refactor, config, docs) starts as an OpenSpec change in `openspec/changes/<name>/`:
  propose with the `openspec-propose` skill, then stop and wait for the user's approval.
- Implement only after approval with `openspec-apply-change`; archive with `openspec-archive-change` when done.
- Skills for these workflows are in `.agents/skills/` (and `.cursor/skills/` for Cursor).
- Validate with `openspec validate --all --strict --no-interactive`.
- Read `README.md` before writing code and keep it in sync (schema, API, rules, status, known issues, changelog).
