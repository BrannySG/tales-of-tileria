---
name: ideas
description: Dump raw ideas, feedback, or creative vision — the skill extracts actionable tasks and routes them into the right design doc. Use whenever you want to brain-dump, log feedback, capture a design vision, or just think out loud about the game.
disable-model-invocation: true
---

# Ideas Capture

Brain-dump freely. This skill listens, extracts, and organises — turning rambles into actionable tasks across the right docs.

## What this handles

- Raw creative vision ("I want the game to feel like...")
- Design feedback ("The loot reel feels wrong because...")
- Feature ideas ("What if we added...")
- UX observations ("Players probably get confused when...")
- Prioritisation nudges ("This should be built next, because...")
- Open questions ("I'm not sure whether to...")
- Friction notes ("I keep running into...")

## Hard boundaries

1. Do not modify product code, game features, runtime config, tests, or build files.
2. Do not implement, scaffold, or refactor anything in `apps/`, `packages/`, or `tools/` (source, not docs).
3. Documentation-only. In-scope: `creative/`, `docs/` (including `docs/adr/`), `Documentation/`, root refs (`README.md`, `AGENTS.md`, `CONTEXT.md`), `.cursor` rules/skills, and README files inside source folders.
4. Respect each doc's own conventions. Follow the ADR process in `AGENTS.md` for `docs/adr/`.

## Workflow

### Step 1 — Intake

Read the user's full dump without interrupting. Extract every distinct concept, observation, or question. Label each one:

- **IDEA** — a new feature, mechanic, or system
- **FEEDBACK** — a reaction to something that already exists
- **VISION** — a direction, feel, or north-star statement
- **TASK** — a concrete, scoped thing to do
- **DECISION** — a question that must be answered before building

### Step 2 — Route

Place each extracted item in the right doc:

| Content | Destination |
|---|---|
| IDEA or VISION about features / systems / mechanics | `creative/design-ideas.md` |
| FEEDBACK or TASK about UX / polish / feel / housekeeping | `creative/ux-housekeeping.md` |
| Narrative, fiction, or world-building | `creative/story-arc.md` |
| Architectural decisions (follow the ADR process in `AGENTS.md`) | `docs/adr/` |
| Canonical vocabulary additions or corrections | `CONTEXT.md` |
| Operational or design reference | `AGENTS.md` / `README.md` / `Documentation/` |

### Step 3 — Write it up

Add each item to its target doc using that doc's existing structure and tone.

For `creative/` docs:
- Give every new item a **Priority** rating from the [priority scale](../../.cursor/rules/creative-docs.mdc).
- Add a **Review block** (Pros / Cons-Risks / Notes) with a date stamp.
- If an item clearly upgrades, contradicts, or reinforces an *existing* entry, note that inline.

### Step 4 — Re-review the touched doc

Per the [creative docs protocol](../../.cursor/rules/creative-docs.mdc):

- Re-read the entire doc after writing.
- Re-rate every idea (HIGH / MEDIUM / LOW / LONG-TERM / DECISION FIRST).
- Update each item's Review block where context has shifted.
- Update the Current Game Loop Snapshot if the loop has materially changed.
- Escalate previously LONG-TERM items when they become actionable, with a note.
- Update the "Last reviewed" marker.

### Step 5 — Digest back

After writing, give the user a short summary:

- What was captured (list by type: IDEA / FEEDBACK / VISION / TASK / DECISION)
- Where each item landed
- Any high-priority items or open DECISION gates that need attention
- Any ideas that conflict with or reinforce existing entries — call them out explicitly

Keep the digest to 10 lines or fewer. Highlight the most important signal, not everything.

## Output style

- Concise and editorial. Not speculative implementation detail.
- New entries: actionable bullets with clear sequencing.
- Decision gates: flagged explicitly as **DECISION FIRST** with the question stated plainly.
- Digest: tight. Surface what matters.
