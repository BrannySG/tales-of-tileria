# ADR 0033 — Regions group Levels by cosmology

- Status: Accepted
- Date: 2026-06-27

## Context

The Player profile HUD redesign (a frameless, badge-based identity block) added a
location row that shows not just the current Level name ("The Clearing") but a
higher grouping label ("Tileria") above it. The domain had no concept above a
Level: `Level` is the canonical term for a single place, and the glossary had only
retired the *single-place* synonyms "Area"/"Zone". There was nothing to name a
*set* of Levels.

A grouping was wanted that:

- Has a clear in-fiction meaning rather than being arbitrary UI flavor text.
- Lives in content (so it is a single source of truth) without leaking into the
  sim, which must stay headless and not learn presentation concepts.
- Can later back other surfaces (Collections grouping, a future world map) without
  a re-model.

The split that emerged from the game's cosmology: the **mortal realm** (where the
player gathers and progresses) versus the **Clicker/celestial spaces** inhabited
by Cursor-beings (the Council of Clickers; the Black Market's Vendors).

## Decision

**Introduce `Region`: a named, content-defined grouping of Levels, split by the
game's cosmology. Presentation/content only — no sim involvement.**

- **Content model.** A new `RegionDefinition { id, displayName }`
  (`packages/shared/src/types/region.ts`) with a small registry
  (`packages/shared/src/content/regions.ts`) holding two Regions: `tileria`
  ("Tileria", the mortal realm) and `the_inbetween` ("The Inbetween", the Clicker
  realm). Lookups (`getRegion` / `listRegions`) live in `registry.ts`, mirroring
  the Cursor-skin registry pattern.
- **Levels opt in.** `LevelDefinition` gains an optional `regionId`. The bundled
  Levels are tagged: `bigworld_01` (The Clearing) and `deepwood_01` (The Deepwood)
  → `tileria`; `council_01` (The Council of Clickers) and `blackmarket_01` (The
  Black Market) → `the_inbetween`. `tutorial_01` is left untagged (parked content);
  an untagged Level simply hides the Region tag.
- **Presentation resolves it.** `WorldScene` reads `level.regionId` and resolves
  the display name via `getRegion`, threading `regionName` to the `Hud` → the
  profile `ProfileViewModel`. The sim, server, and Level instances never see
  Regions; nothing about a Region is authoritative or persisted.
- **Term un-retire, not override.** The glossary previously retired "Area"/"Zone"
  as synonyms for a *single* place. A Region is a *different axis* — a set of
  Levels — so adding it does not contradict that retirement; `CONTEXT.md` records
  the distinction.

## Consequences

- The profile location row now reads "Tileria · The Clearing", giving the world a
  legible two-level geography for free, and the mortal/Clicker cosmology is now a
  first-class content distinction rather than implied lore.
- Region is content-only: adding or re-tagging Regions is a content edit, and the
  sim/headless invariant is untouched. Removing the profile row would change no
  sim state.
- A Level can have at most one Region, and a Region is a flat label (no nesting,
  ordering, or metadata beyond `displayName`). If a future world map needs sort
  order, art, or per-Region Collections grouping, extend `RegionDefinition` then.
- The UI-lab note ("true per-region Collections grouping needs a region/Level tag")
  now has its tag; wiring Collections to Regions is deferred to a Collections pass.
- `tutorial_01` shows no Region until deliberately tagged — acceptable while that
  onboarding Level is parked.
