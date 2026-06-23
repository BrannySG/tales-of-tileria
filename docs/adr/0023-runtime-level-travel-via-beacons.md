# ADR 0023 — Runtime Level Travel is client-orchestrated via Beacons

- Status: Accepted
- Date: 2026-06-23

## Context

The game now has more than one place worth being: the shared open world
(`bigworld_01`) and the authored Black Market (`blackmarket_01`). Players need a
way to Travel between Levels in-world, and the Black Market needs to become a real
multiplayer destination rather than a dev-only preview.

Two facts constrain the design:

1. **The sim cannot move a player between Level instances.** Multiplayer authority
   lives in one `InstanceDO` per Level instance (ADR-0016); an `InstanceDO` is
   bound to a single `levelId`, and there is no server API to migrate a connection
   to a different instance. Changing Levels is therefore fundamentally a WebSocket
   disconnect + reconnect to `/play?level=<new>`, re-seeded from the carried
   Player snapshot.
2. **Scripted, presentational beats belong in the client, not the sim** (ADR-0005,
   AGENTS invariant #4; "commands in, events out", invariant #1). Onboarding
   already performs a Level swap entirely client-side: snapshot the Player, fade,
   tear down the `WorldScene`, and mount a new one keyed by `level.id` seeded with
   that snapshot. ADR-0011 explicitly notes this "generalizes to any future
   Level-to-Level travel."

We considered adding a sim-authoritative `level.travel` command/event so the sim
could gate or validate travel. But there is nothing for the sim to authorize today
(no cost, cooldown, or prerequisite), and the actual instance change still has to
happen client-side regardless — a sim command would be an empty ceremony that adds
a non-reusable hook to the headless core.

## Decision

**Runtime Level Travel is client-orchestrated; there is no Travel sim command.**

- A **Beacon** is the in-world Travel point. It stays a single `beacon` Entity
  definition; each *placement* declares its destination as authored data on the
  `PlacedEntity` (a new optional `travelTargetLevelId`). The Beacon in
  `bigworld_01` points at `blackmarket_01` and a new Beacon in `blackmarket_01`
  points back at `bigworld_01`. Destinations are data, not client constants
  (invariant #5).
- **Tapping a Beacon is a presentation interaction.** The client wires a plain tap
  on a `beacon`-tagged Entity to open a centered confirmation modal
  ("Travel to The Black Market? Travel / Cancel"). The sim never sees the tap.
- **On confirm the client orchestrates the swap**, reusing the onboarding
  mechanism: snapshot the live Player from the transport, fade to black
  (`.arc-fade`), tear down the current `WorldScene` / transport, and mount a new
  `WorldScene` keyed by the destination `level.id`, seeded with the carried
  snapshot, then fade in. For multiplayer destinations the new
  `WebSocketTransport` reconnects through `/play?level=<dest>`, where the
  `RouterDO` assigns an instance **density-first** (ADR-0016).
- **Game mode becomes a small Level router.** `GameMode` holds the current
  `levelId` + carried Player and swaps `WorldScene` on a travel request — the same
  shape `OnboardingMode` already uses for its phase swaps.
- **The Black Market becomes multiplayer** by gaining a `multiplayer` block
  (`maxPlayers: 6`); `bigworld_01` is also raised to 6 for consistency. No other
  server change is required — the existing bundled-level + router + instance
  pipeline already handles any multiplayer Level.

## Consequences

- All future inter-Level travel follows one pattern (Beacon placement data +
  client carry/reconnect); adding a link is authoring two Beacon placements, not
  writing code. The Black Market is reachable in normal play and shared by up to
  six players.
- The headless sim stays free of travel logic, preserving "the client is
  presentation" and "commands in, events out". The Player snapshot remains the
  single carried unit of progress (ADR-0011).
- **Given up / deferred:** no sim-side gating of travel (cost, cooldown,
  prerequisite) — if that becomes needed it can be added later as a real sim
  command without changing the client orchestration. No guaranteed
  travel-as-a-group: each traveler is routed density-first, so co-located friends
  usually but not always land in the same instance; the reserved `instanceHint`
  seam (ADR-0016) is the future hook for party travel. Instances stay ephemeral
  and there are no authored spawn points (arrivals start at the cursor), unchanged
  from ADR-0016.
