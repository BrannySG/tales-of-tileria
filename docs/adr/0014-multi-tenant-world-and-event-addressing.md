# ADR 0014 — Multi-tenant World shape, event addressing, and the interactionRule claim model

- Status: Accepted — implemented in the Multiplayer Shared World sprint (see ADR-0016)
- Date: 2026-06-18 (implemented 2026-06-19)

## Context

The sim is single-tenant: one `World` owns exactly one `Player` plus one `cursor`
and one passive-damage accumulator (`packages/sim/src/world.ts`). Commands flow in
through `SimTransport.send` / `World.applyCommand` and events flow out through a
single broadcast in `LocalTransport.emitAll` — every subscriber sees every event.
That is correct for a local single player, but multiplayer needs three things the
current shapes don't express:

1. **Who sent a command** — commands must be attributable to a player so the
   authoritative world mutates the right player's state.
2. **Who an event is for** — some events describe shared world state (an entity
   was damaged) and must reach everyone in the Level; others describe one player's
   private projection (their inventory changed) and must reach only that player.
3. **Who owns an interaction** — when two players hit the same entity, the world
   must resolve credit/claim deterministically.

We do **not** want to retrofit player addressing across ~23 event types and every
command call site later, but we also don't want to build a multi-tenant `World`
before the gameplay justifies it. This ADR records the target shape and lands the
cheap, non-behavioral seams now.

## Decision

### 1. Event addressing is declared as data today

`packages/shared/src/types/protocol.ts` gains a total `EVENT_SCOPE:
Record<SimEvent['type'], 'world' | 'player'>`, plus a derived
`PLAYER_SCOPED_EVENTS` set and an `isPlayerScopedEvent(event)` helper. Because the
record is keyed by `SimEvent['type']`, the compiler forces every future event to
declare a scope.

- **World-scoped** (broadcast to all players in the Level): `entity.damaged`,
  `entity.depleted`, `entity.respawned`, `entity.spawned`, `entity.built`,
  `entity.enabled`, `loot.rolled`.
- **Player-scoped** (unicast to the owning player): `inventory.changed`,
  `entity.blocked`, `pickup.collected`, `tool.equipped`, `quest.updated`,
  `target.changed`, `skill.xpGained`, `skill.leveledUp`, the crafting events
  (`craftingJobStarted`, `craftingJobCompleted`, `craftedItemPlacedAtShrine`,
  `craftedItemClaimed`), `player.nameChanged`, `smiteTriggered`,
  `divinePowerChanged`, `passiveDamageChanged`.

`LocalTransport` ignores the classifier — a single local player receives
everything, so there is **zero behavior change today**. A future
`WebSocketTransport` / server fan-out uses it as the routing rule: world events go
to the room, player events go to the one socket.

Note on the crafting + offering events: `craftedItemPlacedAtShrine` /
`craftedItemClaimed` are classified **player**-scoped even though the offering sits
on a shared shrine. The crafting flow is private progression (you craft and claim
your own offering); the *shrine entity's* observable changes still ride world
events. If shrines become contended, revisit alongside the claim model below.

### 2. Commands carry an optional `playerId`

`SimCommand` is left untouched (the payloads are already player-agnostic).
Instead, the sender id rides the transport boundary: `SimTransport.send(command,
playerId?)` and `World.applyCommand(cmd, playerId?)` take an optional
`PlayerId` (a `string` alias in `protocol.ts`). `applyCommand` defaults it to the
world's sole player and no-ops a command addressed to a different player — so
existing single-arg call sites are unchanged and the multi-tenant contract is
already documented in the signature. `LocalTransport` simply forwards it.

### 3. Target multi-tenant `World` shape

When multiplayer lands, split the per-player slice out of `World`:

- Today's singletons (`player`, `cursor`, `passiveAccumulator`, plus per-player
  combat bookkeeping like `lastSmiteTargetId` / `smiteCount`) move into a
  `PlayerSession`, held as `Map<PlayerId, PlayerSession>`.
- **Entities stay world-owned** — the `Map<instanceId, EntityInstance>` and the
  respawn/loot systems remain shared; only player-scoped state is partitioned.
- `applyCommand(cmd, playerId)` resolves the `PlayerSession` and mutates only that
  slice; world mutations (damage, deplete, respawn) stay shared.
- Emission splits along `EVENT_SCOPE`: world events fan out to all sessions,
  player events to the originating session. The classifier added above is exactly
  the function the server uses here.

This is intentionally **not built yet** — it is the shape the seams above target.

### 4. `interactionRule` becomes the claim model

`EntityDefinition.interactionRule: InteractionRule` (`'claimed' |
'sharedContribution' | 'lastHit' | 'personal'`) is authored on definitions but
currently unenforced. It becomes the rule the multi-tenant `World` applies when
more than one player interacts with the same entity:

- `claimed` — first interactor locks the entity; others are blocked until release.
- `sharedContribution` — damage from all players accrues; loot/XP split by
  contribution.
- `lastHit` — whoever lands the depleting blow takes the loot/XP.
- `personal` — the entity is instanced per player (each sees their own state).

The current `EntityInstance.locked: boolean` (a pickup/shrine "not yet active"
gate) is **orthogonal** to claims and stays as is. The tech-doc's mooted
`EntityRuntimeState` values `disabled` / `claimed` are deferred: `disabled` is
already covered by `locked`, and `claimed` only becomes real with per-player claim
tracking, which we add together with the multi-tenant `World`. Reconciling that
naming is explicitly part of this future refactor, not this pass.

## Consequences

- The player-vs-world distinction is encoded once, in data, and type-checked for
  completeness — adding an event without classifying it fails the build.
- Command addressing exists at the boundary without churning command payloads or
  call sites; single-player code keeps calling `send(command)`.
- The multi-tenant refactor has a written target (per-player sessions, shared
  entities, scope-based fan-out, `interactionRule` claims) so it can be scheduled
  deliberately rather than reverse-engineered.
- **Deferred:** the actual `Map<PlayerId, PlayerSession>` rewrite, second-player
  support, `interactionRule` enforcement, and the `EntityRuntimeState` naming
  reconciliation. No runtime behavior changes with this ADR.

## Update — implemented (2026-06-19)

Sections 1–4 are now live (see ADR-0016 for the runtime that consumes them):

- **§1/§3** `World` is multi-tenant: per-player state lives in a `PlayerSession`
  map, entities + respawn/loot stay world-owned, and `tick`/commands emit
  `AddressedEvent[]` (via `addressEvent`) that the server fans out by
  `EVENT_SCOPE`. The legacy single-player API (`applyCommand(cmd)`,
  `getPlayer()`, `tick(dt)`) still targets the sole default session, so all
  existing tests and `LocalTransport` are unchanged.
- **§2** `applyCommand(cmd, playerId)` resolves the session; an unknown player is
  a no-op, as specified.
- **§4** `interactionRule` is enforced with a zone-default precedence
  (`level.multiplayer.interactionDefault` overrides the entity's own rule).
  `lastHit` (the open-world default) credits the depleting player; `claimed`
  locks an entity to its first damager and blocks others. `sharedContribution`
  tracks per-player damage but still credits the depleting player for now (a
  documented stub). The `EntityRuntimeState` naming reconciliation remains
  deferred.
