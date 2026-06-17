# ADR 0008 — Tools are identified content with tiers; gating is owned-based with auto-equip

- Status: Accepted
- Date: 2026-06-17

## Context

The first core loop introduces tool *progression*: the player starts with a
Wooden Axe but must craft a Stone Axe to fell an Oak Tree, and the Stone Axe
should feel like a real upgrade you grow into rather than a flat key. The
original model (ADR-0005/0006) treated a tool as just a `ToolType` (axe / pickaxe
/ sword): owning the type was the whole gate. That can't express "a *better* axe",
"this tree needs a tier-2 axe", or "you own the Stone Axe but aren't skilled
enough to wield it yet".

We also wanted equipping to stop being busywork. With multiple axes in hand, a
manual "equip the right one" step adds clicks without decisions.

## Decision

Make tools **identified content**. A `ToolDefinition` has an `id`, a `toolType`,
a numeric `tier`, a display name, an icon, and an optional `wieldRequirement` (a
Skill + level needed to *use* it). The Player owns a **set of tool ids**
(`ownedTools: ToolId[]`), not a set of types. Pickups grant a tool id, and the
quest `acquireTool` objective keys off the tool id — so "obtain the Stone Axe"
needs no new objective kind.

Entity tool requirements gain an optional `minTier` (default 1). Gating stays
**owned-based**: an interaction is allowed when the player owns a *usable* tool of
the required type at or above `minTier`, where "usable" means its
`wieldRequirement` is met. A shared pure helper, `bestUsableTool(player,
toolType)`, is the single source of truth for both sim gating and the client
cursor ring, which **auto-equips the best usable tool** for the current target.
`equippedToolType` therefore becomes presentation-derived, not a gating input.

Blocks become granular so the UI can explain them: `missingTool`,
`toolTierTooLow`, `toolWieldLevel` (owns it, Skill too low to wield), and
`skillLevel` (entity's own Skill gate). The same gate runs for active taps and
passive tick damage.

## Consequences

- Progression is expressible without new gating concepts: new tools are pure
  content (add a `ToolDefinition`), and "a harder node needs a better tool" is one
  `minTier` field.
- Owning ≠ wielding. The Stone Axe can sit in your inventory as a goal you grow
  into (Woodcutting 3), which the `toolWieldLevel` block communicates directly.
- Equipping is automatic and always correct, matching the divine-cursor fantasy
  (you don't fumble for tools). Manual loadout choice is deliberately given up.
- Because `bestUsableTool` is shared and pure, sim and client never disagree about
  what's usable, and it ports unchanged into a server-authoritative world.
- Migrating off `ToolType`-only ownership touched the Player shape, pickups,
  quests, and the client store; the payoff is one consistent identified-item model
  that Recipes (ADR-0010) also grant into.
