# ADR 0020 — Skill Points from Collections drive per-skill Active damage; Tools gate access

- Status: Superseded by [ADR-0022](0022-skill-trees-replace-flat-upgrades.md)
- Date: 2026-06-21

> **Update (2026-06-23):** Superseded by ADR-0022. Collections now award **Skill
> XP** (not Skill Points); "Skill Point" is redefined as a per-level tree point;
> the flat `skillUpgrades`/`active_click_damage` purchase is replaced by per-Skill
> **Skill Trees**; and **Tier access is gated by the tree**, not by tool tier or
> wield level. The reasoning below is preserved as a point-in-time record.

## Context

We are adding the Collection Book (see CONTEXT.md: Collection, Skill Point): a
reusable progression loop where gathering yields collectible drops, Registering
them into Collection Entries awards per-Skill Skill Points, and Skill Points buy
permanent upgrades. The first (and for V1, only) upgrade is `+1 Active click
damage` for the upgrade's Skill.

This forced a decision about where Active click damage comes from. Two facts
about the existing code:

- Active click damage is a flat Level value (`CombatConfig.activeDamage`, default
  `3`), applied in `World.applyActiveTap`. Tools do **not** add damage today —
  `ToolDefinition` has tier, type, and a wield requirement, and is used only by
  `blockedReason` to *gate* whether an Entity may be damaged (see ADR-0008).
- `Documentation/CORE_GAME_DESIGN.md` implied the opposite ("Basic Axe: 1 damage
  per click / Reinforced Axe: 3 damage per click"), which was never built.

So we had to choose: should the early "power spike" come from better tools
(scaling damage by tool tier), or from a separate, account-style growth stat?

## Decision

**Tools gate access; Collection-funded Skill Points grow Active damage.**

- Active click damage is resolved in one place, `World.resolveActiveDamage`, as
  `combat.activeDamage + skillUpgrades[skillId].activeClickDamage`, where
  `skillId` is the tapped Entity's `requirements.skill.skillId`. The bonus is
  player-owned, per-Skill state on the `Player` (`skillUpgrades`), portable
  across Levels (see ADR-0011) and persisted client-side (see ADR-0016).
- The bonus only applies to Entities whose skill matches, so a Mining upgrade
  never raises Woodcutting damage and vice versa. Smite multiplies the resolved
  amount, so upgrades compound with the divine power cleanly.
- Tools keep their existing job: unlocking which nodes/zones a player may damage
  and providing tier identity (`minTier`), not click power.
- Skill Points are a per-Skill pool, earned only by completing Collection Entries
  and spent only in that Skill's Upgrade panel. The pool (`skillPoints`) is kept
  separate from purchased upgrades (`skillUpgrades`) so future upgrades can also
  cost points without reworking state.

The V1 upgrade is deliberately a single repeatable `+1 Active click damage` per
Skill (`active_click_damage`), one Skill Point each. The `skillUpgrades` shape is
left open (`{ activeClickDamage: number }`) so later upgrades (idle/hover damage,
yield, rare-drop chance, auto-collect, respawn reduction) add fields rather than
a new system.

## Consequences

- The early power spike is now a loop, not a purchase: gather → Register a
  Collection Entry → earn a Skill Point → buy `+1` → feel the next node die
  faster. This is the intended core engine and generalises to every future Skill.
- `CORE_GAME_DESIGN.md` is corrected to match: tools gate access/tier, Skill
  Points grow damage. The unbuilt "tool tier = click damage" idea is dropped.
- Damage is computed at one choke point (`resolveActiveDamage`), so future
  modifiers (buffs, more upgrades) extend there without touching interaction
  handlers — keeping game rules out of presentation code.
- Reversing this is costly: it is baked into persisted `Player` state and the
  balance of both tools and Collections. We accept that; the separation of
  "access (tools)" from "growth (skills)" is a foundational choice we want.
- The client never decides damage, Skill Point grants, or upgrade effects; it
  sends `collection.register` / `skill.purchaseUpgrade` and reacts to the
  authoritative events (commands in, events out).
