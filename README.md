# Tales of Tileria — Prototype

A browser-based idle "god cursor" game prototype. This repo currently contains
the foundation: a headless simulation core, a PixiJS + React client, a **Content
Zoo** for tuning game feel, and a **Level Editor** whose saved levels load
directly into the game.

See [`CONTEXT.md`](CONTEXT.md) for the canonical vocabulary (Player vs Cursor,
Active vs Passive damage, Lock, Level vs Level instance, etc.),
[`AGENTS.md`](AGENTS.md) for how to work in the repo (invariants, commands, where
content lives), and [`docs/adr`](docs/adr/README.md) for the key decisions.

## Architecture

```
packages/shared   Types + content definitions (entities, loot tables, bundled
                  levels) + the command/event/net protocol. No runtime deps.
packages/sim      Headless, deterministic game logic (multi-tenant World,
                  systems, LocalTransport). Depends only on `shared`. DOM-free.
apps/client       Vite + React + PixiJS. React owns all DOM UI; Pixi owns the
                  world canvas. Modes: /zoo, /editor, /game.
apps/server       Cloudflare Worker + Durable Objects: the authoritative
                  multiplayer runtime (one InstanceDO per Level instance, a
                  per-Level RouterDO, and a global LeaderboardDO). Runs the same
                  `@tot/sim` World server-side.
tools/spritegen   Local-only CLI that generates game-ready sprites (not shipped).
```

Logic and rendering are separated by a transport boundary (commands in, events
out): the same `World` runs in-process via `LocalTransport` (single-player) or
server-side in a Durable Object reached via `WebSocketTransport` (multiplayer).
See [`docs/adr`](docs/adr) for the key decisions (multiplayer is ADR-0014/0016).

## Requirements

- Node 22+
- pnpm 10+

## Getting started

```bash
pnpm install
pnpm dev        # start the client dev server (http://localhost:5173)
```

### Multiplayer (two processes)

The shared open world (`#/game`, and the end of onboarding) is server-authoritative.
Run the game server alongside the client in a second terminal:

```bash
pnpm dev:server   # wrangler dev (Miniflare) on http://localhost:8787
pnpm dev          # Vite client on http://localhost:5173
```

In local dev the client reads the server WebSocket URL from `VITE_TOT_SERVER_URL`
(`apps/client/.env.development` defaults it to `ws://localhost:8787`, since Vite and
the server run on different ports). Single-player modes (Content Zoo, Editor, the
tutorial/Council) need only `pnpm dev`.

In production the client and server are **co-hosted on one Worker**: `pnpm deploy:server`
builds the client and serves it as static assets from the same Worker that owns the
multiplayer endpoints (`/play`, `/health`); everything else falls back to the SPA. The
client derives its WebSocket URL from the page origin, so no env var is needed. It is
live at `https://tot-server.branny.workers.dev` (and the custom domain
`tileria.saucegames.io`). Deploying requires `wrangler login`.

Then open one of the modes (also reachable from the top nav):

- `#/zoo` — **Content Zoo**: hover an entity to deal passive damage, click to
  tap (active), and **Lock** to pin the Cursor to one target for hands-free
  passive damage. (Lock is not Idle Mode — Idle Mode, ADR-0024, detaches the
  Cursor and auto-roams the Level.) The dev panel live-tunes damage/respawn and
  toggles sound.
- `#/editor` — **Level Editor**: drag entities from the palette onto the canvas,
  drag to reposition, edit per-instance overrides (HP, respawn, loot table), and
  **Save** (writes `LevelDefinition` JSON into `packages/shared/content/levels/`).
- `#/game` — drops the player into the shared, server-authoritative open world
  (`bigworld_01`, "The Clearing") through the same sim + renderer; Beacons Travel
  to other Levels (e.g. the Black Market).

## Scripts

```bash
pnpm dev            # run the client
pnpm dev:server     # run the multiplayer game server (wrangler dev)
pnpm build          # production build of the client
pnpm deploy:server  # deploy the game server to Cloudflare (needs wrangler login)
pnpm live:wipe      # manually wipe live data only (prompted)
pnpm live:wipe:deploy # manually wipe live data, then deploy
pnpm live:wipe:smoke # validates admin guard + idempotent wipe behavior
pnpm test           # run sim unit tests (Vitest)
pnpm typecheck      # typecheck all packages
pnpm lint           # ESLint
pnpm format         # Prettier
```

## Manual live wipe runbook

Use this only during early iteration when you intentionally want a fresh live
state before shipping.

### One-time setup

1. Set the Worker secret:
   `pnpm --filter @tot/server exec wrangler secret put ADMIN_WIPE_TOKEN`
2. Export the same token in your shell before running wipe commands:
   `set ADMIN_WIPE_TOKEN=...` (PowerShell: `$env:ADMIN_WIPE_TOKEN="..."`).

### Wipe only

```bash
pnpm live:wipe -- --url https://tileria.saucegames.io --scope all
```

### Wipe + deploy

```bash
pnpm live:wipe:deploy -- --url https://tileria.saucegames.io --scope all
```

- Default scope is `leaderboard`; use `all` for leaderboard + router registry.
- The command prompts for `WIPE_LIVE_DATA` before doing anything destructive.
- Add `--fast` to skip typecheck/tests (not recommended for live pushes).
- If the wipe call fails, deploy does not run.
- Optional smoke check:
  `pnpm live:wipe:smoke -- --url https://tileria.saucegames.io --scope leaderboard`

### Full reset behavior for players

The client now applies a manual epoch gate in
`apps/client/src/persistence/liveReset.ts`. Bump `LIVE_RESET_EPOCH` when you
want a release to clear browser-local `tot.*` keys once (save, identity,
onboarding, and UI persistence) so players start fresh after your live wipe.

## Notes / deviations

- Audio uses Howler with procedurally-generated placeholder SFX (the repo ships
  no audio binaries). Swap in real files in `apps/client/src/audio`.
- Particles and tween "juice" are small in-house implementations on Pixi v8
  sprites rather than external libraries, for v8 compatibility and control.
- Level save/load uses a Vite dev-server middleware; it is a development tool and
  is not present in production builds.
