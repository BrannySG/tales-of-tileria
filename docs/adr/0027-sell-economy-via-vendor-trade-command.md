# ADR 0027 — Sell economy via a sim-authoritative Vendor trade command

- Status: Accepted
- Date: 2026-06-25

## Context

Gold has existed as a Currency since the prototype, but it was a dead end: it was
only ever *earned* (from `quest.claim` rewards) and never spent — there was no
sink anywhere in `World.applyCommand`. Surplus loot had a similar problem: Items
with no recipe or Collection use just piled up in the Bag with no way to convert
them into progress. `creative/design-ideas.md` flagged "items sell for XP" as a
DECISION-FIRST idea, and the Black Market Level (`blackmarket_01`) already existed
(three placed Vendor cursor-beings + a return Beacon) but its Vendors were
non-interactive set-dressing.

We want the game's first trade system: a Black Market Vendor you can step up to
and sell to. Two product questions were open — what currency a sale yields, and
(for XP) which Skill it feeds. We also did not want to entangle this with the
larger, unstarted "tools/equipment become equippable Gear that grants Stats"
rework, nor with buying (which needs that Gear rework to have meaningful stock).

## Decision

**Selling is a sim-authoritative trade: a new `item.sell` command debits Items
and credits either Gold or source-Skill XP at a content-resolved value. Buying is
deferred.**

- **Command/events (commands in, events out — invariant #1).** A new
  `{ type: 'item.sell'; itemId; quantity; mode: 'gold' | 'xp' }` command is
  handled by `World.sellItem`, which validates ownership, resolves the value,
  debits the Item, credits the reward, and emits the existing `inventory.changed`
  (+ `skill.xpGained` for XP sales) plus a new player-scoped `shop.sold` feedback
  event. Because the same `@tot/sim` `World` runs client-side (`LocalTransport`)
  and server-side (`InstanceDO`), no server-specific code is needed; the Black
  Market being multiplayer "just works."
- **Dual currency, player's choice.** The Sell tab has a `Gold` / `XP` toggle.
  Selling for Gold is the player's income to spend on the (future) Buy tab;
  selling for XP is a progression route. This creates a real "Gold now vs XP now
  vs hold for a Collection" decision at every drop.
- **XP routes to the Item's source Skill.** Sell-for-XP feeds the Skill that
  gathers the Item (Wood → Woodcutting, Stone → Mining), authored in
  `SELL_SKILL`, mirroring how Collections route per-entry XP. Items with no mapped
  Skill are Gold-only (the XP option is hidden).
- **Values are rarity-derived content.** `SELL_VALUE_BY_RARITY` maps each Rarity
  to a `{ gold, xp }` per-unit value, with optional per-Item `SELL_OVERRIDES`;
  quantity multiplies. New Items are sellable automatically. Sell-XP is tuned
  *below* the equivalent Collection-entry XP so Collections stay the
  optimal-but-slower play (preserving the decision layer). All of this lives in
  `packages/shared/src/content/economy.ts` (content, not system logic — invariant
  #5).
- **Presentation stays dumb (invariant #6).** Tapping a Vendor opens a dedicated
  full-screen `VendorScene` (a Black Market "conversation": a bobbing Cursor-skin
  portrait that speaks Clicker-lore lines on the left, tabs on the right). The
  scene only *sends* `item.sell` and *projects* `shop.sold` for its running tally
  and reaction lines; it never mutates state. Which Vendors are interactive is
  data-driven by the presence of a client `VendorProfile` keyed on the placement
  Cursor-skin id (only the General vendor is wired this sprint).

## Consequences

- Gold finally has a real source (sell-for-Gold) and the loot loop gains a sink
  and a fast XP route, filling a felt gap. The decision layer (Gold / XP / hold)
  adds depth without new resources.
- The trade command/event protocol is now established; future trade actions
  (buying, other Vendors, other currencies) extend it the same way.
- **Given up / deferred:** **Buying** is a visible "coming soon" tab only — it
  waits on the **equippable Gear-grants-Stats rework** *(now the **Artifacts**
  system — see the Update on ADR-0022 and `creative/design-ideas.md`)*, its own
  future ADR, which is the natural stock for an Equipment vendor. The other two Black Market Vendors
  (Equipment, Generic) stay inert until they get profiles. Sell values are a
  first tuning pass, not balanced economy. The "Jim's Gym" framing for a
  sell-for-XP trainer (see `creative/design-ideas.md`) is superseded as the
  *first* home of selling — selling lands at the Black Market first.
