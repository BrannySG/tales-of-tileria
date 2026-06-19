# ADR 0018 — Stateful items as separate definitions, a data-driven Item interaction table, and a client-only armed cursor

- Status: Accepted
- Date: 2026-06-19

## Context

The Hotbar (a row of owned Tools) was redundant: Tools auto-equip per target, so
there was nothing to pick. Meanwhile the player had no way to *see* their held
Items (Wood, Stone, Iron Chunk…) or learn what they are, and no way to *use* an
item on the world. We want a RuneScape-style **Bag**: a comfortably on-screen
window onto the Inventory with rich hover info, plus a foundation for "use item
on world" interactions — the canonical example being a Bucket filled at water and
then used to douse a fire. This loop is meant to generalize to bosses, combat,
and puzzles later.

The open question was how to model an item that *changes* (an empty bucket
becoming a full one), where the use-on-world rules should live, and how the
player expresses "use this".

## Decision

### Items stay count-based; stateful items are separate definitions

The Inventory stays `Record<itemId, count>` (no per-instance item state). A
stateful item is modeled as **distinct Item definitions** — `bucket` and
`bucket_of_water` are two ids — RuneScape-style. Filling a bucket consumes one
`bucket` and grants one `bucket_of_water`; dousing reverses it. `ItemDefinition`
gains a `category` (`resource | consumable | quest | currency`) and a hover
`description` to power the Bag tooltip.

Rejected: per-instance item state (object items with mutable fields). It would
force the Inventory off its simple count map and complicate every consumer (loot,
crafting, quests, net snapshots) for a need that variant-definitions cover.

### Use-on-world is a data-driven Item interaction table

"Use Item X on Entity Y" is authored content (`itemInteractions.ts`), like loot
tables and recipes: each rule is `{ usedItemId, target: {definitionId?|tag?},
consume[], grant[], extinguishTarget? , message? }`. The sim resolves a new
`item.useOn` command by looking up the matching rule (`findItemInteraction`),
checking the player can afford the cost, swapping the items, and applying any
world effect. A no-match (or unaffordable) is a **silent no-op**. New
interactions need zero sim changes — only content.

Target matching is by definition id and/or a **tag** (`water`, `fire`), so a
single rule covers every water/fire prop.

### Stateful world props via a small extinguishable component

Fire props use an `ExtinguishableComponent { outTextureId, relightSeconds? }`
plus an `extinguished` boolean on the entity instance — a two-look swap rather
than a new state-machine state, so respawn/contention logic is untouched. An
extinguished prop relights after `relightSeconds` (a world-scoped tick), keeping
the demo repeatable. New entity kind `prop` marks non-damageable interactable
scenery (no HP, no loot), and `PickupComponent` gained an optional
`grantsItemId` so a world pickup can grant a stackable Item (the Bucket) and not
only a Tool.

### The armed item is a client-only cursor mode

Selecting a Bag item "arms" it: a transient, **client-only** intent (like hover)
stored in the HUD store, with the cursor carrying the item's icon. The next
Entity click sends `item.useOn`; clicking empty ground, re-clicking the item, or
toggling the Bag disarms. The sim never sees an "armed" state — only the
resulting command — so there is no new authoritative surface to keep in sync or
secure.

### The Bag replaces the Hotbar

The HUD's Hotbar is retired. The **Bag** (bottom-right, open by default, toggled
by a button or the I/B hotkey, persisted per device) has an Items tab (a padded
slot grid from the Inventory, Gold excluded since it is Currency shown in the
profile) and a read-only Equipment tab (owned Tools, equipped one highlighted).
No capacity cap: loot is never rejected; the grid just grows.

## Consequences

- New "use item on world" content is pure data; the sim path is generic.
- Variant items can multiply ids (e.g. every fill/empty/charge state is its own
  definition). Acceptable, and explicit; revisit only if combinatorial states
  appear.
- Tools are no longer manually selectable (the Equipment tab is read-only); the
  sim's auto-equip remains the only equip path. `onSelectTool`'s authoritative
  `tool.equip` command stays wired for future/other callers.
- The armed cursor is presentation; a malicious client could send `item.useOn`
  directly, but the sim validates holdings + rule, so the worst case is a normal
  legal interaction. Consistent with the client-seeded-snapshot trust model
  (ADR-0016).
- Extinguish/relight is world-scoped, so in multiplayer everyone sees a fire go
  out and come back.
