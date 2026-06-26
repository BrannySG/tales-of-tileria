# ADR 0029 — A generic Refining system and tiered raw wood

- Status: Accepted
- Date: 2026-06-26

## Context

`creative/design-ideas.md` calls for a "saw refinement loop": milling raw wood
into a more valuable Refined good (planks) at a Sawmill — a timed, batch action
upgradeable per Skill, with the time scaling by wood tier. We want this to be the
first of a *family* of refineries (Stone milling, etc.), not a one-off.

Two gaps blocked a clean build:

1. **Only one raw wood existed.** The codebase had a single generic `wood` Item
   even though the design talks about "wood of all types" and a "wood tier". The
   Oak Tree and Elder Pine both dropped the same `wood`, so there was nothing to
   make per-tier refining (or richer per-tier content) meaningful.
2. **Crafting is the wrong shape.** The existing Crafting system (ADR-0010) is
   tool-focused: it consumes a fixed `cost`, runs one job, and places a single
   tool **Offering** on the Shrine to be **claimed**. Refining is 1:1, batched,
   direct-to-Bag, and station-anchored — bending crafting to fit would have
   coupled two unlike loops and blocked crafting + refining running at once.

The interaction also needed an affordance: the design's "drag-to-saw" isn't built,
and the existing pattern is "arm an Item, tap a target" (`item.useOn`, ADR-0018).
There was no shared cue telling the player an armed Item can act on a hovered
Entity.

## Decision

**Add a new, generic, data-driven Refining system — separate from Crafting — with
the Sawmill as its first Refinery, and introduce a tiered raw-wood ladder so
refining (and content) can scale by tier.**

- **Tiered raw wood (content).** Three raw tiers: `wood` (T1 Tree), `oak_wood`
  (T2 Oak Tree), `pine_wood` (T3 Elder Pine); the T4 `giant_stump` Landmark keeps
  paying out `wood`. Oak/Pine loot tables drop their own raw wood; existing
  collectible ladders are reused. Each tier mills into a Refined Item:
  `refined_wood`, `refined_oak_wood`, `refined_pine_wood`.
- **Refining is its own loop (commands in, events out — invariant #1).** New
  `RefineRecipe` content (`refineRecipes.ts`) keyed by a Refinery **station tag**
  + the raw input Item. A new `{ type: 'refine.start'; itemId; targetInstanceId }`
  command is handled by `World.startRefine`: it matches a recipe by the target's
  tags, consumes up to the batch of raw input up-front, and begins a per-player
  `RefineJob` advanced in `World.tick` (`tickRefining`, beside `tickCrafting`).
  When the timer elapses the run becomes **claimable** (`refineJobReady`) — the
  job lingers and the player **taps the Refinery to claim** (`refine.claim`),
  which grants the Refined Item to the Bag with Skill XP (`refineJobClaimed`),
  mirroring a crafting Offering. `refineJobStarted` / `refineJobReady` /
  `refineJobClaimed` drive the presentation (countdown → tap-to-claim prompt). A
  player can craft and refine simultaneously (separate job slot).
- **Tier timing is authored per recipe.** `baseSeconds` rises with tier
  (2 / 4 / 6s); default batch is 20. 1:1 conversion — value lives in higher Sell
  price and the Refined Collection entries, not a lossy ratio.
- **Upgradable in the Skill Tree (generic).** A new `refineStat` node effect kind
  (`batchSize` | `speedPct`), resolved per-Skill by `deriveRefineStats`. The
  Woodcutting tree gains `Mill Capacity` (+batch) and `Mill Speed` (faster) nodes;
  because they hang off the shared tree LAYOUT, a future Mining/Stone mill inherits
  the same hooks for free. Speed is capped so a run can never become instant.
- **One affordance for "armed Item can act here" (invariant #6).** A single
  `canArmedItemInteract(itemId, entityDef)` predicate covers BOTH refine recipes
  AND existing `itemInteractions` (buckets). The client lights a gentle glow on the
  hovered Entity while a compatible Item is armed, and routes the tap to
  `refine.start` (Refinery) or `item.useOn` (everything else). The sim re-validates
  either way.
- **Presentation stays dumb.** A generic, instance-keyed World-Prompt countdown +
  wood-chip particles play over the Sawmill while a run is in flight; removing them
  changes no sim state. A mid-run reload rehydrates both from the snapshot's
  `Player.refineJob`.
- **Economy + Collections (content).** Refined Items sell (source Skill =
  Woodcutting) with `SELL_OVERRIDES` giving a clear gold margin over the raw log,
  while sell-XP is held *below* the matching Refined Collection-entry rate so
  Collections stay the better long play (ADR-0027). New refined Collection entries
  extend the Timber Archive + Oak Codex, and a new Pinewright Ledger covers pine.

## Consequences

- Refining is a reusable system: a second refinery (Stone Mill) is a new entity
  with a station tag + a new `RefineRecipe`, no system code. The `refineStat`
  hooks already exist on every Skill tree.
- The raw-wood ladder makes tier matter for loot, refining, economy, and
  Collections — at the cost of a one-time content retheme (Oak Codex `wood` →
  `oak_wood`; Elder Pine now drops `pine_wood`). The T4 Giant Stump intentionally
  still pays `wood`.
- Crafting and Refining stay cleanly separate (two job slots, two completion
  models) rather than one overloaded loop.
- **Given up / deferred:** the 20-stack cap experiment and tutorialising the
  Sawmill are out of scope; the new pine source reuses oak collectibles rather
  than introducing pine-specific ones; sawmill placement in authored Levels is
  left to the repo owner. Sell/XP values are a first tuning pass.
