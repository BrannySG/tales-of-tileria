# ADR 0006 — The sim World owns authoritative Player state

- Status: Accepted
- Date: 2026-06-17
- Evolved by: [ADR-0014](0014-multi-tenant-world-and-event-addressing.md), [ADR-0016](0016-authoritative-multiplayer-runtime.md) (single-player `World` → multi-tenant)

## Context

ADR-0002 put game rules in a headless `World` (entities, cursor targeting, damage,
respawn, loot). But player-scoped state — owned/equipped tools, inventory, and
quest progress — lived only on the client (a Zustand store accumulated coins from
`loot.rolled`; tools auto-equipped on hover). The `Player` type in
`packages/shared` existed but was unused by the sim.

The onboarding work needs two things the client-only model can't do faithfully:

1. **Tool gating** — "you cannot chop a tree without an Axe" must be enforced
   where damage is decided, and must report *why* a tap did nothing.
2. **Quest tracking** — quests advance from authoritative outcomes (an entity
   depleted, an item acquired, a tool picked up), and the design treats quest
   progress as server-validated, personal state.

Enforcing these on the client would split authority across two places and diverge
from the server-authoritative direction (the single-authority `World` invariant;
see `AGENTS.md`).

## Decision

Extend the `World` to be the **single authority for Player state**: owned tools,
equipped tool, inventory, and quest progress. Concretely:

- `World` holds a `Player` and resolves loot into the player's inventory itself,
  emitting `inventory.changed` rather than relying on the client to tally loot.
- `entity.tap` checks the target's tool requirement against the equipped/owned
  tools; if unmet it deals no damage and emits `entity.blocked`.
- New commands model player-scoped changes: `pickup.collect` (grant + equip a
  tool from a pickup entity), `tool.equip`, `entity.spawn` (runtime placement),
  and `quest.grant`. New events broadcast the results (`pickup.collected`,
  `entity.spawned`, `quest.updated`).
- A generic quest engine inside the sim advances data-driven `QuestDefinition`s
  from existing domain events and emits `quest.updated`.
- The client Zustand store becomes a **projection** of these events: it renders
  what the sim reports and stops owning inventory/tool truth.

## Consequences

- One authority for player progress, server-portable: the same `World` (with a
  per-connection `Player`) runs in a Durable Object later; only the transport
  changes.
- Tool gating and quests are unit-testable headlessly alongside damage/respawn.
- The client store shrinks to a view-model. Removing client-side auto-equip means
  tools must be earned, which is the intended fantasy.
- The prototype `World` modelled a single local `Player`. *(Superseded by
  ADR-0014/0016: the `World` is now multi-tenant — per-player state lives in a
  `PlayerSession` map keyed by `PlayerId`, while entities/respawn/loot stay
  world-owned. The single-authority principle below is unchanged; only the
  one-player scoping was lifted.)* Multiplayer needed per-player state and command
  attribution, which ADR-0014 designed and ADR-0016 implemented.
- Snapshot/serialization grows to include `Player`, keeping the "whole world is
  snapshottable" property from ADR-0002.
