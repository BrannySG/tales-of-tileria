# ADR 0005 — Scripted onboarding runs in a client Director, not the sim

- Status: Accepted
- Date: 2026-06-17

## Context

The first-time experience is a heavily scripted cinematic: fade to black, a rock
unveils and breaks after three taps, a tree, then a house whose final tap reveals
the live Level with the shack destroyed and an NPC reacting. This is a one-off
authored sequence, not normal HP-based gameplay.

ADR-0002 keeps the simulation (`packages/sim`) a portable, server-authoritative
core of game *rules* — no scripting, no timers, no presentation. The design docs
(TECHNICAL_REQUIREMENTS §10.3) also warn against one-off tutorial logic baked into
core systems. Putting a cutscene state machine inside `World` would bloat the
portable core with non-reusable, presentation-coupled logic that would have to ride
along into the Durable Object later.

## Decision

Implement the onboarding cinematic as a **client-side Onboarding Director** that
lives in the presentation layer. The Director:

- Owns the void cinematic entirely: the black overlay, Wisps, the decorative
  props (rock/tree/house), tap-counting, fades, and the reveal. The cinematic
  props are presentation-only and never touch real entity HP.
- Drives the live world only through the **same commands any player action uses**
  (`entity.spawn`, `quest.grant`, taps), and reacts to the same domain events. It
  has no privileged path into world state.
- Scripts NPC dialogue and the pacing of quest grants, then hands full control to
  the player.

The sim only gains *generic, reusable* features that real gameplay also needs
(tool-requirement gating, pickups, runtime spawn, a data-driven quest engine) —
never tutorial-specific branches.

## Consequences

- The portable sim stays free of cutscene/scripting concerns; it ports to a
  Durable Object unchanged.
- The cinematic can be re-timed, re-skinned, or replaced without touching game
  rules. Skipping or re-running onboarding is a client concern.
- A future reader must know the void props are *not* world entities — they are
  Director-owned sprites. The reveal is a hand-off, not a continuation of the same
  objects (see ADR for the "decorative props then reveal" approach in the plan).
- Because the Director uses only public commands/events, the same scripting
  approach works for later authored story beats over a live (even multiplayer)
  Level.
