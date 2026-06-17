# ADR 0010 — Crafting is sim-authoritative and tick-based; results are claimed at the Shrine

- Status: Accepted
- Date: 2026-06-17

## Context

Crafting the Stone Axe is the loop's payoff: spend gathered Wood and Stone, wait,
get a tool. We needed to decide where the craft *runs* and how its result *enters*
the inventory.

Two temptations to avoid:

1. Running the craft timer on the client (a `setTimeout` in the crafting menu).
   That puts authoritative progress in the browser, breaks if the menu closes,
   and won't port to a server.
2. Auto-awarding the crafted tool the instant the craft finishes, the way loot is
   auto-awarded (ADR-0007). Loot bursts are a generous, frictionless flourish over
   state you already own — right for breaking a rock, wrong for the deliberate,
   ceremonial moment of receiving your first crafted tool at a shrine.

## Decision

Crafting is **sim-authoritative and tick-based**. A `craft.start` command
validates `craftingUnlocked` and the recipe cost, consumes the resources up
front, and sets the player's single `craftingJob`. `World.tick()` advances the
job (no DOM timers); there is at most one job per player. On completion the sim
does **not** hand the tool over — it places the result on the **Shrine** as a
pending `Offering` and emits `craftingJobCompleted` + `craftedItemPlacedAtShrine`.

The player then **claims** it: a `craft.claim` on the shrine grants the tool id
(emitting `craftedItemClaimed` and the `toolAcquired` signal that advances the
`first_offering` quest) and clears the offering. So unlike auto-awarded loot, a
crafted result is **real pending state** the player must collect.

## Consequences

- This is **deliberately unlike loot (ADR-0007)**. Loot = auto-awarded, cosmetic
  burst; a crafted item = authoritative pending Offering that must be claimed. The
  contrast is intentional: the shrine claim is the ceremony.
- Progress is server-safe and UI-independent: closing the crafting menu can't lose
  a craft, and the whole flow ports into a Durable Object unchanged.
- The Offering lives on the Shrine entity (`pendingOffering`), so it's visible,
  serializable world state, not a transient client effect.
- A "you missed it" failure mode reappears for crafted items (the offering waits
  to be claimed), accepted here because there's exactly one, it's quest-tracked,
  and the shrine pulses until claimed.
- One in-flight job per player keeps the model simple; queues/parallel crafts are
  out of scope.
