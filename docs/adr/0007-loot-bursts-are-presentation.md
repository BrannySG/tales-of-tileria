# ADR 0007 — Loot bursts are presentation-only; the sim auto-awards loot

- Status: Accepted
- Date: 2026-06-17

## Context

Depleting an entity is one of the game's key reward moments. We want the rolled
items to visibly burst from the entity, arc out, land on the floor, and settle —
each glowing in its Rarity color — so players can parse and feel excited about
what they got.

There are two broad ways to model this:

1. **Ground pickups** — depletion spawns collectible item entities in the world;
   loot enters the Inventory only when the player touches/collects each drop.
2. **Auto-award + cosmetic burst** — the sim grants loot to the Inventory the
   instant the entity is depleted, and the visible burst is a pure flourish over
   loot the player already owns.

Per ADR-0006 the sim `World` already resolves loot into the player's inventory at
depletion (`awardItems`) and emits `loot.rolled` (with the entity position and the
awarded items) alongside `inventory.changed`. So the authoritative award already
happens up front; nothing in the sim waits for a pickup step.

## Decision

Keep loot **auto-awarded by the sim at depletion**, and make the loot burst a
**presentation-only** reaction to the `loot.rolled` event on the client. The
renderer's `LootDropSystem` spawns the arcing, glowing, shadow-casting drops as a
flourish; they never gate, hold, or re-deliver loot, and removing them would not
change a single byte of authoritative state.

## Consequences

- The reward feels generous and frictionless: no "you missed a drop" failure mode,
  and the moment scales cleanly to hundreds of simultaneous drops because the
  visuals are throwaway (pooled, capped, recycle-oldest) and carry no state.
- Rarity, display name, and icon are read from a shared `ItemDefinition` registry
  so the sim, HUD, and burst all agree on what an item is.
- An item only produces a visible drop when its definition has art
  (`worldTextureId`); art-less items (currently the rare `smooth_pebble` /
  `strong_branch`) are still awarded, just not shown bursting yet.
- This is deliberately hard to reverse: if we later want true ground pickups
  (loot the player must walk/click to collect), depletion would have to stop
  auto-awarding and instead spawn collectible entities, changing the sim contract
  and quest "itemCollected" timing. We are choosing the divine-cursor fantasy
  (loot is yours the moment you break the thing) over scavenging.
