# ADR 0004 — Entity art as an editable overlay over typed definitions

- Status: Accepted
- Date: 2026-06-16

## Context

Entity definitions are authored as typed TypeScript modules in
`packages/shared` (behavior, loot, HP, requirements, XP, plus an `art` block).
We wanted an **Entity Editor** to tune the *global* visual transform of an
entity type — scale, rotation, anchor — with the changes applying to every
instance across all Levels (per `CONTEXT.md`). That requires persisting edits,
but the definitions are code, not data, so the editor cannot simply rewrite
them, and we did not want to migrate the whole typed definition model to JSON
just to make a few visual fields editable.

## Decision

Keep entity *behavior* in the typed TS definitions, and layer *visual
transforms* on top via an editable JSON **art overlay**:

- A single file, `packages/shared/content/entity-art.json`, maps `definitionId`
  → `{ scale?, rotation?, anchorX?, anchorY? }`.
- The client resolves art with `resolveArt(def)` (`content/entityArt.ts`),
  merging the overlay over the definition's `art` defaults (overlay wins). All
  render surfaces — `EntityView`, the Level Editor, and the Entity Editor
  preview — go through this resolver so they always agree.
- The Entity Editor writes the overlay via a dev-only middleware endpoint
  (`/api/entity-art`), mirroring the existing level-save plugin. In production
  (no middleware) the fetch fails silently and the typed defaults are used.
- The sim (`packages/sim`) is unaffected: it never reads art, so the overlay is
  purely a client-render concern.

## Consequences

- Behavior stays typed and type-checked in TS; only visual tuning is data, and
  it is editable live without code changes or rebuilds.
- Art is intentionally split across two sources (TS defaults + JSON overlay).
  A future reader must know `resolveArt` is the single point of truth for what
  an entity actually looks like; reading `def.art` alone can be misleading.
- Edits are global by design (all Levels). Per-Level visual overrides are not
  supported and would require extending `PlacedEntity`/resolution — deliberately
  out of scope for now.
- Production builds rely on whatever overlay JSON is committed at build time;
  there is no runtime persistence without the dev middleware, consistent with
  how authored Levels already work.
