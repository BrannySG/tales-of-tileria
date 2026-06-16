# ADR 0002 — Headless TypeScript simulation core

- Status: Accepted
- Date: 2026-06-16

## Context

The game is designed to become server-authoritative multiplayer (Cloudflare
Workers + Durable Objects per the technical requirements). Even for the
single-player prototype, we want game rules (damage, depletion, respawn, loot,
targeting/lock) to live in one place that is testable in isolation and portable
to a server, with no dependency on the browser, the DOM, or PixiJS.

## Decision

Put all game logic in a **headless simulation package** (`packages/sim`) that
depends only on shared types/content (`packages/shared`). It exposes:

- `World` — holds `EntityInstance` state; `applyCommand(cmd)` and `tick(dt)`
  return domain events. No timers, no I/O, no rendering imports.
- Systems for damage (active + passive on the current Target), respawn, and loot.
- A transport-agnostic boundary: commands in, events out, defined by the
  `SimTransport` interface in `packages/shared`.
- `LocalTransport` — an in-process implementation of `SimTransport`, driven by
  the client's render loop via `tick(dt)`.

The renderer and HUD never mutate state directly; they send commands and react
to events + an initial snapshot (the same shape a server would send on join).

## Consequences

- The exact same `World`/systems can run inside a Durable Object later; only a
  `WebSocketTransport` (implementing `SimTransport`) needs to be added — no
  rewrite of game rules.
- Game logic is unit-testable without a browser (Vitest covers damage, respawn,
  passive/lock targeting, and deterministic seeded loot).
- A single authoritative clock: the client drives `tick(dt)` each frame, so the
  simulation and presentation never run on competing timers.
- Slightly more indirection than calling logic directly from the renderer, which
  is the intended cost for the server-portability and testability we want.
