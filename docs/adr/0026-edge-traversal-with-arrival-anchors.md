# ADR 0026 — Edge-to-edge Level Travel via Arrival Anchors

- Status: Accepted
- Date: 2026-06-25

## Context

ADR-0023 made runtime Level Travel client-orchestrated via Beacons: tapping a
`beacon`-tagged Entity offers Travel, and on confirm the client snapshots the
Player, tears down the `WorldScene`, and mounts the destination Level seeded with
that snapshot. It explicitly deferred spatial continuity: "there are no authored
spawn points (arrivals start at the cursor)."

The Giant Stump (ADR-0025) introduces a new spatial relationship: the Deepwood
sits **north** of the Clearing. Breaking the stump reveals a signpost at the north
edge of `bigworld_01` that travels to `deepwood_01`, and a portal at the **south**
edge of the Deepwood travels back. With ADR-0023's "arrive at the cursor"
behaviour, a player stepping north would arrive at an arbitrary point in the
Deepwood, and stepping back through the south portal would not land near the
stump — the geography would feel disconnected.

## Decision

**A Beacon may name an Arrival Anchor in its destination; the destination camera
opens centred on that anchor.** This extends ADR-0023's placement-data model; it
does not change the carry/reconnect mechanism.

- `LevelDefinition.arrivalAnchors?: Record<string, ArrivalAnchor>` declares named
  world points where travelers may arrive (e.g. `bigworld_01` has a `north` anchor
  by the stump; `deepwood_01` has a `south` anchor by the portal).
- `PlacedEntity.travelArrivalAnchor?: string` on a Beacon selects which anchor in
  the destination to land at. The north signpost targets `deepwood_01`'s `south`
  anchor; the south portal targets `bigworld_01`'s `north` anchor — so exiting one
  edge arrives at the matching edge of the other.
- `GameMode` resolves the destination's anchor coordinates from the tapped Beacon
  placement and passes them through `WorldScene` → `useWorldScene` →
  `SceneRenderer`, which centres the pan camera on that world point at startup via
  a new `CameraController.centerOnWorldPoint`. A Beacon with no
  `travelArrivalAnchor` (or a destination with no matching anchor) keeps ADR-0023's
  behaviour — the world-centred default.
- Arrival is **presentation only** (camera framing). It does not move the cursor or
  any sim state; the sim has no notion of arrival points, preserving invariants #1
  and #6.

## Consequences

- Edge-to-edge Travel feels continuous: stepping north shows the Deepwood's south
  edge; returning shows the Clearing's north edge by the cleared stump. New linked
  Levels add anchors as authoring data, with no new code.
- The mechanism is generic and reusable for any future multi-edge or multi-exit
  Level layout; anchor names are author-chosen (`north`/`south`/`gate_a`…).
- **Given up / deferred:** arrival still only frames the camera — it does not place
  the player's cursor at the anchor (the cursor remains where the device reports
  it), since the cursor is screen-space and player-driven. Party/group travel and
  density-first instance routing are unchanged from ADR-0016/0023.
