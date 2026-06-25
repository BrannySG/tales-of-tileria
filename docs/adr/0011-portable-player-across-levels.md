# ADR 0011 — Player state is portable across Level instances; the divine name is sim-authoritative

- Status: Accepted
- Date: 2026-06-17
- Superseded in part by: [ADR-0013](0013-council-of-clickers-is-an-authored-level.md) (transition trigger), [ADR-0021](0021-minimal-onboarding-arc-parked.md) (naming/crafting decoupled); carry mechanism generalised by [ADR-0023](0023-runtime-level-travel-via-beacons.md)

## Context

Onboarding ends with an "arrival": the player names themselves at the shrine, and
the tutorial gives way to Zone 1 — a shared clearing authored in its final state
(shack and furnace built, shrine active, tool pickups gone). Mechanically that's a
**Level swap**: the tutorial `World`/Level instance is torn down and a Zone 1 one
is built. The player must not be reset by the swap — their name, tools, skills,
inventory, and quest progress have to come with them. We also needed the divine
name to be authoritative (the shrine label, cursor nameplate, NPC lines, and
welcome message all read it), not a loose client string.

We have no persistence backend yet (ADR scope), so this is about carrying state
*in memory* across the swap, plus a thin client persistence for the name.

## Decision

Make the **Player portable across Level instances**. `WorldOptions` gains an
optional `player` snapshot: a new `World` can start from an existing Player
(deep-cloned so the two worlds never share references) instead of `createPlayer`.
On claiming `first_offering`, the client snapshots the live Player, fades out,
shows an out-of-world dev welcome, tears down the tutorial session, and builds a
Zone 1 session seeded with that snapshot — so name/tools/skills/inventory/quests
survive intact (the `better_wood` oak quest is carried and finished in Zone 1).
*(The `first_offering` trigger and `better_wood` oak quest were superseded by
ADR-0013's Council/Banishment transition and then parked by ADR-0021; "Zone 1" is
the shared open world, today `bigworld_01`. The carry mechanism itself is
unchanged and is what ADR-0023 generalises to all Level Travel.)*

Make the **divine name sim-authoritative**: a `player.setName` command trims/caps
the input, sets `Player.displayName`, and emits `player.nameChanged`. *(Originally
`setName` also set `craftingUnlocked = true` for the shrine Dedication beat;
**superseded by ADR-0021** — crafting unlock is now the separate
`player.setCraftingUnlocked`, see the Update below.)* The client persists the name to `localStorage`
(`tot.playerName`) and rehydrates it via the existing `playerName` WorldOption on
return.

## Consequences

- The onboarding→Zone 1 arrival is a real Level swap with no progress loss, and
  the same carry mechanism generalizes to any future Level-to-Level travel.
- Deep-cloning the snapshot keeps the two `World` instances isolated, preserving
  the "sim owns state" invariant (no shared mutable Player across worlds).
- The name is one authoritative value the whole game reads, and the
  unlock-crafting side effect lives with it, keeping the Dedication beat in the sim
  rather than as a quest reward (see ADR-0009's noted exception).
- **Known limitation:** sim state is not persisted to a backend. A returning,
  already-onboarded player loads directly into the shared open world with their
  persisted name and a sensible default kit (crafting unlocked, skills at L1) so
  the world stays playable. *(The exact starter kit is authored in
  `starterPlayer.ts` — currently `axe_rusty` + `pickaxe_rusty`, not the
  `axe_basic` / `pickaxe_stone` ids named when this ADR was written.)* Real
  save/load is a future pass.

## Update (2026-06-23)

ADR-0021 changes the active onboarding shape and decouples naming from crafting
unlock. `player.setName` remains authoritative for display name, but crafting
unlock is now explicit (`player.setCraftingUnlocked`) so the parked shrine
Dedication beat can opt in without baking unlock side-effects into naming.
