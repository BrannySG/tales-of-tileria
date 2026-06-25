# ADR 0009 — Quest chaining and world unlocks are data-driven in the sim

- Status: Accepted
- Date: 2026-06-17

## Context

The core loop is a chain of quests: pick up the axe → chop trees → rebuild the
shack → take the pickaxe → mine stone → build the furnace → make the first
offering → fell the oak. Each step also opens up the world: claiming a quest
should enable the next interactable (the pickaxe pickup, the furnace, the shrine).

Under ADR-0005 the client Onboarding Director hand-granted each quest and timed
the reveals. Extending that to a seven-step chain would push real game
progression — ordering, prerequisites, what-unlocks-what — into client cinematic
code, where it can't be tested headlessly, can't run on a server, and drifts from
the authoritative state.

## Decision

Move chaining and world unlocks **into the sim as data**. A quest declares
`prerequisiteQuestIds`; when a quest is claimed, the `World` auto-grants any quest
whose prerequisites are now all claimed (emitting `quest.updated`). Quest rewards
gain `enableEntityTag`: on claim, the sim enables every locked entity carrying
that tag and emits `entity.enabled`. So "rebuilding the shack reveals the pickaxe"
and "mining stone reveals the furnace" are authored entirely in
`content/quests.ts` + level data, not scripted.

This **revises the scope of ADR-0005**: the Onboarding Director shrinks to the
opening cinematic and grants only the first quest (`pickup_axe`). The rest of the
chain self-propagates in the sim; the Director and other client code now only
*react* to `quest.updated` / `entity.enabled` for dialogue and presentation. (One
deliberate exception stays client-side per ADR-0011: crafting unlocks at the
shrine Dedication, not as a quest reward, because naming is a scripted client beat.
*Originally the `player.setName` command set `craftingUnlocked = true` as a side
effect; ADR-0021 decoupled this — `player.setCraftingUnlocked` is now separate, and
the minimal onboarding flow seeds crafting unlocked directly.*)

## Consequences

- Progression is content. Reordering steps, adding a quest, or changing what a
  step unlocks is data, and is covered by headless sim tests (chain advancement,
  tag-enable) with no client in the loop.
- The chain runs anywhere the `World` runs, including a future Durable Object —
  the server stays authoritative over what's unlocked, not the browser.
- The Director keeps only what's genuinely presentational (fades, void props,
  dialogue pacing), consistent with ADR-0002's portable core.
- `enableEntityTag` couples quests to entity tags; tags must be authored
  consistently in level/content data, which is the intended seam.
