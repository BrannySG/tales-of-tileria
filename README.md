# Tales of Tileria — Prototype

A browser-based idle "god cursor" game prototype. This repo currently contains
the foundation: a headless simulation core, a PixiJS + React client, a **Content
Zoo** for tuning game feel, and a **Level Editor** whose saved levels load
directly into the game.

See [`CONTEXT.md`](CONTEXT.md) for the canonical vocabulary (Player vs Cursor,
Active vs Passive damage, Lock, Level vs Level instance, etc.).

## Architecture

```
packages/shared   Types + content definitions (entities, loot tables) + the
                  command/event protocol. No runtime deps.
packages/sim      Headless, deterministic game logic (World, systems,
                  LocalTransport). Depends only on `shared`. Browser/DOM-free.
apps/client       Vite + React + PixiJS. React owns all DOM UI; Pixi owns the
                  world canvas. Modes: /zoo, /editor, /game.
```

Logic and rendering are separated by a transport boundary (commands in, events
out) so the same simulation can run on a server later. See
[`docs/adr`](docs/adr) for the key decisions.

## Requirements

- Node 22+
- pnpm 10+

## Getting started

```bash
pnpm install
pnpm dev        # start the client dev server (http://localhost:5173)
```

Then open one of the modes (also reachable from the top nav):

- `#/zoo` — **Content Zoo**: hover an entity to deal passive damage, click to
  tap (active), and Lock to idle-farm hands-free. The dev panel live-tunes
  damage/respawn and toggles sound.
- `#/editor` — **Level Editor**: drag entities from the palette onto the canvas,
  drag to reposition, edit per-instance overrides (HP, respawn, loot table), and
  **Save** (writes `LevelDefinition` JSON into `packages/shared/content/levels/`).
- `#/game` — loads a saved level and runs it through the same sim + renderer.

## Scripts

```bash
pnpm dev          # run the client
pnpm build        # production build of the client
pnpm test         # run sim unit tests (Vitest)
pnpm typecheck    # typecheck all packages
pnpm lint         # ESLint
pnpm format       # Prettier
```

## Notes / deviations

- Audio uses Howler with procedurally-generated placeholder SFX (the repo ships
  no audio binaries). Swap in real files in `apps/client/src/audio`.
- Particles and tween "juice" are small in-house implementations on Pixi v8
  sprites rather than external libraries, for v8 compatibility and control.
- Level save/load uses a Vite dev-server middleware; it is a development tool and
  is not present in production builds.
