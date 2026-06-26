# ADR 0030 — Unified Equipment: equipping gates access AND grants Stats

- Status: Accepted
- Date: 2026-06-26

## Context

`creative/design-ideas.md` calls for buyable/upgradeable gear that *matters* —
the player should choose what to wear, and wearing it should change how they
play. The codebase had three obstacles:

1. **Tools were a one-off model, not a subtype of anything.** A `Tool` was an
   owned id that gated a Skill by *type* (own *an* axe → Woodcutting works, see
   ADR-0008 as retired by ADR-0022). Owning was enough; there was no "wear it"
   step, and Tools contributed **no** Stats — `deriveStats` had only two sources
   (base + Skill Tree), with a reserved-but-empty third slot (ADR-0022).
2. **Auto-equip hid the choice.** The cursor "auto-equipped" the best usable Tool
   for whatever you hovered (`bestUsableTool`, a presentation swap backed by a
   `defaultEquippedToolType` hint). The player never *decided* what was equipped,
   so equipment could never carry a meaningful loadout decision or a stat trade.
3. **Gear could not be acquired.** ADR-0027 shipped a Sell economy and explicitly
   **deferred buying to "a future Gear ADR"**. There was no Buy path, so even if
   gear mattered there was no way to get a better piece.

ADR-0022 framed the eventual third `deriveStats` source as "Artifacts supersede
Gear." On building it out, the cleaner model is the inverse: **Equipment is the
umbrella; Tools and Artifacts are both subtypes of it.** A Tool is just the first
kind of Equipment. That keeps one stat choke point and one slot model for both.

## Decision

**Introduce a unified Equipment model. Equipment is equipped into per-type slots;
equipping is a deliberate player action that gates Skill access AND contributes
Stats. Gut auto-equip. Add a sim-authoritative Buy path so Equipment can be
acquired. Tools ship now as the first subtype; Artifacts get a designed seam and
land next.**

- **Equipment umbrella, Tool subtype (content).** A base
  `EquipmentDefinition { id, stats?: Partial<Record<StatKey, number>> }`;
  `ToolDefinition extends EquipmentDefinition` (keeps `toolType`, `tier`,
  `displayName`, `iconTextureId`). The `EquipmentSlot` for a Tool *is* its
  `toolType` (`axe` / `pickaxe` / `sword`). Artifact subtypes append new slots
  later. Tools now author `stats` per tier: the tier-1 **rusty** tools grant
  *access only* (no Stat bonus — the baseline upgrades read against); Stone/Iron
  add small, flat, additive bumps (tapDamage / critChance / critDamage) that
  scale with tier.
- **Authoritative per-slot equipping (sim).** `Player.equippedToolType` (a single
  presentation hint) is replaced by `Player.equippedBySlot:
  Partial<Record<EquipmentSlot, ToolId>>` — the authoritative record of what is
  worn. `ownedTools` still tracks possession. New commands `equipment.equip
  { slot, equipmentId }` / `equipment.unequip { slot }` validate ownership + slot
  fit and emit `equipment.changed { equippedBySlot }` plus the recomputed
  `player.statsChanged`. The legacy `tool.equip` command is kept briefly for
  back-compat (routed to `equipEquipment`); `tool.equipped` is no longer emitted.
- **Equip gates access AND Stats (invariants #1/#2).** `blockedReason()` now
  requires a Tool of the entity's required type to be **equipped in its slot**:
  owning none → `missingTool` (unchanged); owning but slot empty → the new
  `notEquipped` block reason. `deriveStats(skillId)` gains the **Equipment
  source** — the Tool equipped in the slot mapped to that Skill
  (`TOOL_TYPE_BY_SKILL`) adds its `stats`. This is the ADR-0022 reserved third
  source; Artifacts append here next.
- **Auto-equip is gutted.** No `defaultEquippedToolType`, no auto-equip-on-pickup,
  no `bestUsableTool` cursor swap. The cursor ring is presentation-only: it shows
  the Tool *equipped* in the slot the hovered Entity needs, or the generic type
  icon when that slot is empty (so the player can see what to equip). The
  "equip best owned" rule survives only as a shared helper
  (`equipmentBySlotFromOwned`) used by **non-gameplay** paths: Zoo/editor sandbox
  seeding, the legacy-snapshot migration heal, and test fixtures.
- **Buy path (sim + content).** A data-driven `vendorStock` table maps a Vendor id
  → `[{ equipmentId, goldCost }]`. A new `item.buy { equipmentId, vendorId }`
  command validates the stock line + affordability + non-ownership, debits Gold,
  grants the Equipment (NOT equipped), and emits `inventory.changed` +
  `shop.bought`. The Black Market **Equipment** stall is the first Buy Vendor; the
  General stall stays the Sell hub. The client Buy tab renders the same table and
  sends `item.buy`; the Bag's Equipment tab is now an interactive equip/unequip
  surface.
- **Starter loadout + onboarding.** New players start Axe-only with the Rusty Axe
  **pre-equipped** (`equippedBySlot = { axe: 'axe_rusty' }`); the Rusty Pickaxe is
  dropped from the starter set. Mining is therefore naturally gated until the
  player buys + equips a Pickaxe — the first deliberate-equip beat. The
  onboarding Director sends explicit `equipment.equip` after each scripted Tool
  pickup (it drives the world through the same public commands, invariant #4).
- **Migration (no soft-locks).** `clonePlayer` heals snapshots from before this
  model — those have **no** `equippedBySlot` field (`undefined`) and are
  auto-equipped from `ownedTools`. A *defined-but-empty* `{}` is a valid
  "nothing equipped" state and is preserved (a fresh player, or one who unequipped
  everything), so the heal can't silently re-equip.

## Consequences

- One stat choke point and one slot model now serve both Equipment subtypes.
  Artifacts are a new subtype with new slots that plug into the same
  `deriveStats` Equipment source and the same `equipment.equip` flow — no new
  system.
- Equipment is now a *decision*: a loadout the player chooses, gates Skill access,
  and changes their Stats. The trade-off is one more required action — Mining no
  longer "just works" once you own a pickaxe; you must equip it. The
  `notEquipped` prompt ("Equip your Pickaxe") teaches this, and the migration +
  pre-equipped starter Axe keep existing players unblocked.
- ADR-0027's deferred Buy seam is filled: Gold now has a sink that feeds power
  progression, not just XP. Buying is the only acquisition source this sprint
  (no Tool loot/craft beyond the existing Shrine craft path).
- This reframes ADR-0022's "Artifacts supersede Gear" into "**Equipment is the
  umbrella; Tools and Artifacts are subtypes**," and supersedes the ADR-0008 tool
  model for the equip path (Tools are Equipment; equipping, not owning, is what
  satisfies the gate). The tier/wield *gating* stays retired (ADR-0022); tier is
  now a Stat-quality indicator, and `wieldRequirement` remains non-gating.
- **Given up / deferred (designed-for):** the Artifact subtype (procs / AoE /
  Smite-rhythm) and its Clicker-tree slot unlocks; randomized stat rolls on
  dropped/crafted Equipment; an `+XP yield` Stat; and loot/craft acquisition of
  Tools. All slot into the same source + slot model next sprint. Stat values and
  Buy prices are a first tuning pass.
