# ADR 0012 — Divine powers are removable, sim-owned Player state (Smite)

- Status: Accepted
- Date: 2026-06-17

## Context

The Banishment Arc gives the player a taste of godlike power before it is taken
away: a temporary **Smite** ability where every third consecutive tap on the same
target lands as a massively amplified hit. The whole emotional point is that the
power is granted, *felt*, then stripped by the Council — and later rebuilt. So the
ability cannot be a render-only flourish or a client flag: whether it is active,
how it triggers, and how much it hits must be authoritative, and it must survive a
Level swap (it carries from the tutorial into the Council Level) yet be cleanly
revocable by a single sim beat.

We also wanted room for *more* divine powers later (weaker Smite, charges, skill-
specific powers) without reshaping state each time.

## Decision

Model divine powers as **removable, sim-owned Player state**. `Player` gains
`divinePowers: { smite: { unlocked; everyNthClick; damageMultiplier } }`, defaulted
locked by `createPlayer`/`emptyDivinePowers` and **deep-cloned in the snapshot**, so
it is portable across Levels (see ADR-0011) until revoked.

A generic command toggles any power symmetrically:
`{ type: 'player.setDivinePower'; power: 'smite'; unlocked }` → mutates
`player.divinePowers` and emits `divinePowerChanged`. Grant happens at the intro
start; the Council issues the same command with `unlocked: false` at Banishment.

Smite itself lives in `World.entity.tap`: a **transient** per-target counter
(`lastSmiteTargetId`/`smiteCount`, not in the snapshot) resets on target change and,
on every `everyNthClick`th landed tap, upgrades that single Active hit to
`activeDamage * damageMultiplier` and emits `smiteTriggered { instanceId, x, y, amount }`
(emitted *before* its `entity.damaged`). The Smite **replaces** the normal hit; it is
not an extra swing. The renderer reacts to `smiteTriggered` with the presentation
(flash, big "SMITE!" text + oversized number, impact sprite, sound, one NPC reaction).

## Consequences

- Smite is authoritative and testable: grant/trigger/reset/revoke are pure sim,
  verified by unit tests; the renderer stays a reactor.
- Banishment removes intro-only power **only** — tools, skills, inventory, name, and
  quests are untouched — because the command flips one flag and the carried snapshot
  inherits it.
- The unlock flag is portable (snapshot) while the click counter is transient World
  state, matching the "session-scoped vs. portable" split already used elsewhere.
- The `divinePowers` shape and the generic `setDivinePower` command leave room for
  future powers without protocol churn. Long-term Smite progression is deliberately
  out of scope for this pass.
