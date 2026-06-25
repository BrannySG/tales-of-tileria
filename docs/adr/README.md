# Architecture Decision Records

Point-in-time records of *why* the architecture is the way it is. Each ADR keeps a
Context / Decision / Consequences shape. ADRs are not edited to change their
reasoning after the fact — when a decision is revised, a newer ADR supersedes it
(and the older one notes it), or an "Update" section is appended.

For vocabulary see [`CONTEXT.md`](../../CONTEXT.md); for working conventions see
[`AGENTS.md`](../../AGENTS.md).

## Index

| # | Title | Status |
|---|-------|--------|
| [0001](0001-pixijs-renderer.md) | Use PixiJS as the rendering engine | Accepted |
| [0002](0002-headless-sim-core.md) | Headless TypeScript simulation core | Accepted |
| [0003](0003-one-presentation-shell.md) | One presentation shell across all modes | Accepted |
| [0004](0004-entity-art-overlay.md) | Entity art as an editable overlay over typed definitions | Accepted |
| [0005](0005-onboarding-director.md) | Scripted onboarding runs in a client Director, not the sim | Accepted — scope revised by 0009, diverged from by 0013 |
| [0006](0006-sim-owns-player-state.md) | The sim World owns authoritative Player state | Accepted |
| [0007](0007-loot-bursts-are-presentation.md) | Loot bursts are presentation-only; the sim auto-awards loot | Accepted |
| [0008](0008-tiered-identified-tools.md) | Tools are identified content with tiers; gating is owned-based with auto-equip | Accepted — damage role clarified by 0020 |
| [0009](0009-sim-owned-quest-chaining.md) | Quest chaining and world unlocks are data-driven in the sim | Accepted — revises scope of 0005 |
| [0010](0010-crafted-items-claimed-at-shrine.md) | Crafting is sim-authoritative and tick-based; results claimed at the Shrine | Accepted |
| [0011](0011-portable-player-across-levels.md) | Player state is portable across Level instances; divine name is sim-authoritative | Accepted — transition detail superseded by 0013 |
| [0012](0012-divine-powers-are-removable-sim-state.md) | Divine powers are removable, sim-owned Player state (Smite) | Accepted |
| [0013](0013-council-of-clickers-is-an-authored-level.md) | The Council of Clickers is an authored Level of Cursor-being entities | Accepted — supersedes part of 0011, diverges from 0005 |
| [0014](0014-multi-tenant-world-and-event-addressing.md) | Multi-tenant World shape, event addressing, and the interactionRule claim model | Accepted — implemented in the 0016 sprint |
| [0015](0015-player-driven-camera-coexists-with-cinematic.md) | Player-driven pan camera coexists with the cinematic camera | Accepted |
| [0016](0016-authoritative-multiplayer-runtime.md) | Authoritative multiplayer runtime: Durable Object instances, router, shared cursors | Accepted — implements 0014 |
| [0017](0017-cursor-skins-and-achievements.md) | Cursor skins as sim-authoritative cosmetics, unlocked by Achievements | Accepted |
| [0018](0018-stateful-items-as-separate-definitions.md) | Stateful items as separate definitions; data-driven Item interaction table; armed cursor | Accepted |
| [0019](0019-leaderboards-and-first-persistent-state.md) | Leaderboards: the first persistent server state (global SQLite Durable Object) | Accepted |
| [0020](0020-skill-points-drive-per-skill-active-damage.md) | Skill Points from Collections drive per-skill Active damage; Tools gate access | Superseded by 0022 |
| [0021](0021-minimal-onboarding-arc-parked.md) | Minimal onboarding is active; full arc is parked behind a typed flag | Accepted — updates active flow from 0011/0013-era onboarding |
| [0022](0022-skill-trees-replace-flat-upgrades.md) | Per-Skill Skill Trees replace flat upgrades; the tree gates Tier, tools gate type | Accepted — supersedes 0020, retires 0008 tier/wield gating |
| [0023](0023-runtime-level-travel-via-beacons.md) | Runtime Level Travel is client-orchestrated via Beacons; destinations are placement data | Accepted — extends 0011's carry mechanism, builds on 0016 |
| [0024](0024-idle-mode-and-clicker-meta-track.md) | Idle Mode is a sim-driven auto-gather loop, gated by a Clicker meta-track | Accepted — evolves 0015 (sim writes cursor coords), broadens 0022's tree machinery |
| [0025](0025-per-player-permanent-entity-state.md) | Per-player permanent entity state via a Player overlay + snapshot projection (Personal Breakables / Landmarks) | Accepted — builds on 0006/0014, persists per 0011/0016 |
| [0026](0026-edge-traversal-with-arrival-anchors.md) | Edge-to-edge Level Travel via Arrival Anchors | Accepted — extends 0023 |
| [0027](0027-sell-economy-via-vendor-trade-command.md) | Sell economy via a sim-authoritative Vendor trade command (Black Market) | Accepted — builds on 0006/0016, gives Gold its first sink/source |

## Supersession map

- **0009** revised the scope of **0005** (the Director shrank to the opening
  cinematic + first quest; the chain self-propagates in the sim).
- **0013** superseded **0011**'s detail that the tutorial→shared-world swap fires on
  the `first_offering` claim, and diverged from **0005**'s void-cutscene precedent
  (the Council is a real authored Level, not props over blackness).
- **0016** implemented the seams **0014** defined (event scopes, command `playerId`,
  multi-tenant `World`, `interactionRule` claims).
- **0020** corrected `CORE_GAME_DESIGN.md`'s unbuilt "tool tier = click damage" idea
  and clarified **0008** (tools gate *access*; Skill Points grow *damage*).
- **0021** made minimal onboarding the active flow and parked the full tutorial +
  Council arc behind a typed flag, updating live onboarding assumptions from
  **0011**/**0013** without deleting the authored arc.
- **0022** superseded **0020** (Collections now grant Skill XP; Skill Points are
  per-level tree points; per-Skill Skill Trees replace the flat upgrade) and
  retired **0008**'s tool-tier/wield gating (the tree gates Tier; tools gate type).
- **0024** evolved **0015** (the sim now writes `cursor.x/y` and reads Entity
  coordinates while idle — the Cursor is authoritative and spatial in Idle Mode)
  and broadened **0022**'s Skill Tree machinery to a non-Skill tree (the Clicker
  meta-track, keyed `'clicker'` via `TreeId`).
- **0025** builds on **0006**/**0014** (the multi-tenant `World` owns Player +
  shared entity state) by adding a per-Player break overlay + per-player snapshot
  projection, rather than per-player entity instancing; the broken state persists
  per **0011**/**0016** (client-side for now).
- **0026** extends **0023**'s placement-data Travel with named Arrival Anchors so
  edge-to-edge Travel lands at the matching edge, replacing 0023's "arrive at the
  cursor" default when an anchor is named.
- **0027** builds on **0006**/**0016** (the sim owns Player state; the same World
  runs server-side) by adding the first trade command (`item.sell`) and its
  `shop.sold` event, giving the **0008**-era Gold currency its first sink/source.
  It defers buying to a future Gear ADR and supersedes the "Jim's Gym first"
  framing in `creative/design-ideas.md` (selling lands at the Black Market first).

## Adding an ADR

Copy the shape of a recent ADR, take the next number, and set Status/Date. Capture
the Context (the forces), the Decision (what and how), and the Consequences
(including what is deliberately given up or deferred). If it changes an earlier
decision, say so in both ADRs and update the table above.
