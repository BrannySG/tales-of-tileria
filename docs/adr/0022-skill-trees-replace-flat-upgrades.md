# ADR 0022 — Per-Skill Skill Trees replace flat upgrades; the tree gates Tier, tools gate type

- Status: Accepted
- Date: 2026-06-23
- Supersedes: [ADR-0020](0020-skill-points-drive-per-skill-active-damage.md)

## Context

ADR-0020 introduced a flat progression loop: Collections award per-Skill **Skill
Points**, which buy a single repeatable `+1 Active click damage` upgrade
(`Player.skillUpgrades`), while **Tools** gate access *and* Tier (tool `minTier`
plus a Skill-level wield requirement, see ADR-0008).

We want a deeper, more legible progression that scales to many Stats and reads
well on mobile and desktop. Concretely:

- Collections should feed the *same* XP/level economy as gathering, not a parallel
  point currency.
- Access to higher-Tier resources should be a *player choice in a build*, not a
  function of which tool tier you happen to hold.
- We need room for many Stats (Tap/Hover Damage, Hover Rate, Crit) and, later,
  account-wide Gear — all resolved at one choke point.

## Decision

**Replace the flat Skill-Point/upgrade loop with per-Skill, PoE-style Skill
Trees. The tree gates Tier; tools gate type only; Stats resolve in one place.**

- **Economy.** Completing a Collection Entry awards **Skill XP** (not points).
  XP drives levels as before; **each Skill level grants one Skill Point** for that
  Skill's tree. "Skill Point" is redefined: `available = level − Σ(allocated node
  cost)`. The old `skillPoints`/`skillUpgrades` Player fields are removed.
- **Skill Tree.** A connected graph of **Tree Nodes** (`{ id, x, y, edges, cost,
  levelReq, effect }`) per Skill, hand-authored in
  `packages/shared/src/content/skillTrees.ts`. A node is allocatable only when a
  neighbour (or the free root) is allocated, `level ≥ levelReq`, and enough points
  remain. Effects are either a **Stat** bonus or a **Tier unlock**. The root is
  free, always allocated, and grants Tier 1. **Respec** refunds a whole tree.
- **Tier gating.** Gatherable Entities carry a `requirements.tier`. The player may
  damage an Entity only when the matching Skill's tree has unlocked a Tier ≥ the
  Entity's Tier. `blockedReason` emits `tierLocked` otherwise. Tool `minTier` and
  wield-level checks are dropped; **tools gate by type ownership only** (need *an*
  axe/pickaxe). Tool tiers/crafting stay in content for the future Gear sprint.
- **Stats, one resolver.** `deriveStats(player, skillId, combat)` is the single
  choke point that sums `base (Level combat + passiveDamage) + Skill Tree (+
  future Gear)` into a `SkillStats` block (`tapDamage`, `hoverDamage`, `hoverRate`,
  `critChance`, `critDamage`, `maxTierUnlocked`). Tap damage, passive cadence/
  damage, crit, and Tier gating all read it. Nothing else computes Stats.
- **Crit.** Tap only, via the existing **seeded sim RNG** (deterministic for
  replay/server, see ADR-0016): a crit multiplies Tap Damage by Crit Damage and
  stacks multiplicatively with Smite.
- **Authority.** The sim owns it all (ADR-0006). Allocation/respec are commands
  (`skill.allocateNode`, `skill.respecTree`); the resolved Stat block ships in the
  `ZoneSnapshot` and re-emits on change (`player.statsChanged`). The client only
  renders — a dedicated DOM/SVG Skill Tree modal with CSS-transform pan/zoom.
- **Migration.** Clean replace (dev-only saves, ADR-0016): on load, drop
  `skillPoints`/`skillUpgrades`/`active_click_damage`, keep XP/levels, default
  `skillTrees` to empty. Sandbox (Zoo/editor) auto-allocates only the Tier-unlock
  nodes so dev scenes reach every Tier without distorting base damage/crit.

## Consequences

- Progression is one economy: gather/craft/Collect → XP → levels → Skill Points →
  spend in a tree → feel Stats grow and Tiers open. Generalises to every Skill.
- Builds matter: players choose offense (Tap/Crit), idle (Hover), or the Tier
  spine. Two trees (Mining, Woodcutting) ship in V1; more are pure content.
- One resolver keeps rules out of presentation and leaves a clean seam for the
  Gear sprint (add a source to `deriveStats`, change nothing else).
- Reversing is costly — it touches persisted Player state, content, and balance —
  but the "access = tree, growth = tree, gear later" split is the foundation we
  want. ADR-0020's tool-tier/wield gating and flat upgrade are retired.
- Hover Rate makes passive cadence player-derived; it is clamped to a minimum so
  the tick rate can't run away.

## Update (2026-06-24) — Multi-Rank nodes + vertical-spine layout

The core decision stands (per-Skill trees gate Tier, one resolver, sim-authoritative);
two refinements were made for legibility and depth:

- **Ranks.** A Tree Node now carries an optional `maxRank` (default 1) and can be
  allocated multiple times. `SkillTreeState.allocated` changed from `string[]` to
  `Record<nodeId, rank>` (rank `>= 1`). A `stat` node applies `amount * rank`;
  `tierUnlock` nodes stay single-Rank. Cost is flat **per Rank** and a single
  `levelReq` gates every Rank; `available = level − Σ(cost × rank)`. Each
  `skill.allocateNode` buys one Rank (rejected at `maxRank`); `skill.nodeAllocated`
  now carries the node's new `rank` and the full `Record`. Connectivity is
  generalised: a node opens when a neighbour (or the root) is at Rank `>= 1`.
- **Layout.** Both V1 trees were re-authored from the sprawling PoE-style graph
  into a single legible **vertical spine** — alternating Tap/Hover damage nodes
  interleaved with inline Tier-unlock gates — with Crit and Hover Rate as short
  side branches. Duplicate single-point nodes were consolidated into multi-Rank
  nodes. This reads top-to-bottom and scrolls cleanly on mobile.
- **UX.** The Skill Tree modal shows a node's `Rank n/max`; `Allocate` buys one
  Rank and a `Max` button buys all currently affordable Ranks.
- **Migration.** The shape change + new node ids/topology mean a clean reset:
  existing saves keep XP/levels but start with empty trees (Skill Points
  auto-refund), consistent with ADR-0016's dev-only-saves stance.
