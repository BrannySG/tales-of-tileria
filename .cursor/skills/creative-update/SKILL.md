---
name: creative-update
description: Capture rambling ideation into structured creative-doc tasks, and maintain any documentation, without implementing features. Use when the user wants to brainstorm, outline, or dump ideas, or asks to clean up / reconcile / update documentation.
disable-model-invocation: true
---

# Creative Update

Use this skill when the user wants ideation capture or documentation maintenance,
not implementation.

## Hard boundaries

1. Do not modify product code, game features, runtime config, tests, or build files.
2. Do not implement, scaffold, or refactor anything in `apps/`, `packages/`, or
   `tools/` (source, not docs).
3. This is **documentation-only** work. Any documentation file is in scope when the
   user asks for it: `creative/`, `docs/` (including `docs/adr/`), `Documentation/`,
   root reference docs (`README.md`, `AGENTS.md`, `CONTEXT.md`), and `.cursor`
   rules/skills. README files that live inside a source folder (e.g.
   `tools/spritegen/README.md`) count as documentation.
4. Respect each doc's own conventions. In particular, follow the ADR process in
   `AGENTS.md` for `docs/adr/` (point-in-time records; revise bodies only when the
   user explicitly asks to reconcile them, and preserve original rationale).

## Workflow

1. Read the user's raw ideas (or cleanup request) and extract distinct concepts.
2. Convert concepts into concrete, scoped task statements.
3. Place each task in the correct doc:
   - `creative/design-ideas.md` for design/features/systems.
   - `creative/ux-housekeeping.md` for UX/polish/housekeeping.
   - `creative/story-arc.md` for narrative/fiction beats.
   - `docs/adr/` for recorded architectural decisions (per the ADR process).
   - `CONTEXT.md` for canonical vocabulary; `AGENTS.md` / `README.md` /
     `Documentation/` for operational and design reference.
4. Update the selected doc using its existing structure and tone.
5. Re-review the full edited creative doc and apply the creative-doc protocol:
   - Re-rate every idea (HIGH / MEDIUM / LOW / LONG-TERM / DECISION FIRST).
   - Update each item's Review block (Pros / Cons-Risks / Notes).
   - Update the Current Game Loop Snapshot if the loop has materially changed.
   - Escalate previously long-term items when they become actionable, with a note.
6. Update the doc's "Last reviewed" marker to reflect the new pass.

## Output style

- Be concise and editorial, not speculative implementation detail.
- Prefer actionable bullets and clear sequencing over long prose.
- Flag decision gates explicitly as **DECISION FIRST** questions.
