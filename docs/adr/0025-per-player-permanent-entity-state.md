# ADR 0025 — Per-player permanent entity state via a Player overlay + snapshot projection

- Status: Accepted
- Date: 2026-06-25

## Context

We want a Landmark in the shared open world (`bigworld_01`): a colossal Tier 4
woodcutting **Giant Stump** that each player breaks **once**, after which it stays
broken **forever for that player** and reveals a Travel signpost north — while
other players, who have not broken it yet, still see (and can break) their own
intact copy. This is the seed for a reusable capability ("Personal Breakable"),
not a one-off.

Two invariants constrain the design:

1. **The `World` is the single authority** for world *and* player state
   (AGENTS invariant #2, ADR-0006), and the sim is **multi-tenant**: per-player
   state lives in a `PlayerSession`; entities + respawn/loot are world-owned and
   shared across sessions (ADR-0014 §3).
2. **Commands in, events out** (invariant #1); the client projects authoritative
   events and never mutates game state. So "this player has broken it" must be
   real sim state, not a render-only flag.

The naive options each break something:

- **Per-player entity instancing** (a private copy of the stump per session) is a
  large change to the world model — entity ids, contention, respawn, snapshots,
  and the server fan-out all assume one shared `EntityInstance` per placement. It
  would also Balloon snapshots for a feature that is "one bit per player".
- **Mutating the shared `EntityInstance`** to depleted on break is wrong: it would
  break the stump for *everyone* the moment the first player finishes it.

## Decision

**Per-player permanent break is a thin overlay on the Player plus per-player
snapshot projection — the shared `EntityInstance` is never depleted.**

- A new `personalBreak?: { revealTag?: string }` component marks an Entity as a
  **Personal Breakable** (paired with `damageable`, usually `breakable`). A
  **Landmark** is a Personal Breakable whose break gates progression via
  `revealTag`.
- `Player.brokenEntities: string[]` records the instance ids a player has broken
  (sparse, latched — the same shape as `quests`/`collections`). It is portable
  across Levels (ADR-0011) and persisted client-side for now (ADR-0016 defers the
  server save).
- The sim routes interaction with a Personal Breakable down a separate path: a
  per-player HP copy in `PlayerSession.personalHp` (lazy-initialised from `maxHp`)
  is whittled down by active taps (Smite/crit included) and passive/idle ticks.
  The shared `EntityInstance.hp`/`state` and the contention map are untouched.
- New **player-scoped** events carry the private projection: `entity.personalDamaged`
  (the acting player's own remaining hp — the world-scoped `entity.damaged` is for
  shared entities) and `entity.brokenForPlayer` (the break, plus the
  `revealedInstanceIds` it unlocks). On break the sim pushes the id to
  `brokenEntities`, awards the loot/XP/quest credit to that player, and reveals
  Locked entities tagged by `revealTag` **for that player only**.
- `World.getSnapshot(playerId)` **projects** the shared entity map for that player:
  ids in `brokenEntities` read as `depleted` (hp 0, so the client shows the broken
  remnant); a break-in-progress shows the player's private hp; and any Locked
  entity revealed by a break they own reads `locked: false`. Other players'
  snapshots are unaffected.
- The client mirrors `brokenEntities` in its HUD store (projected from
  `entity.brokenForPlayer`) so persistence captures a live break even in networked
  play, where the transport's base snapshot is frozen at join. On hydration a
  broken Personal Breakable renders its remnant and its revealed gateway is shown.

## Consequences

- A reusable, low-cost mechanism: any future "break once, forever, per player"
  entity (a blocked cave mouth, a sealed door) is now authoring data —
  `personalBreak` + a loot table + a `revealTag` — with no new system code. The
  world model keeps one shared `EntityInstance` per placement; snapshots grow by
  at most one id list per player.
- The break is real sim state (loot, XP, reveal all flow through normal
  award/event paths), so the carried Player snapshot and the client projection
  agree, honouring invariants #1 and #2.
- **Given up / deferred:** the broken state persists only in client `localStorage`
  today (the known server-persistence seam, ADR-0016/0019); a wipe or a different
  device re-shows the Landmark. `loot.rolled` for a personal break is world-scoped,
  so other players may see a one-off loot burst at the stump — harmless
  presentation we accept rather than add a personal loot event. Credit is the
  depleting player's only (no shared-contribution split), consistent with the
  open world's `lastHit` model.
