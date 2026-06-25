# AGENTS.md — working in this repo

Operational guide for agents and contributors. For *vocabulary* read
[`CONTEXT.md`](CONTEXT.md) (canonical glossary, wins on any conflict); for *why a
thing is the way it is* read the [ADRs](docs/adr/README.md); for *how to run it*
read the [`README.md`](README.md). This file is the short "how we work here".

## What this is

A browser-based idle "god cursor" game (see `CONTEXT.md`: Player, Cursor). A
headless, deterministic simulation runs the rules; a PixiJS + React client renders
it; a Cloudflare Worker + Durable Objects run that *same* sim server-side for
shared multiplayer.

## Repo map

```
packages/shared   Types + data-driven content + the command/event/net protocol.
                  No runtime deps. The source of truth for content and contracts.
packages/sim      Headless, deterministic game logic (multi-tenant World, systems,
                  LocalTransport). Depends only on `shared`. DOM-free, no timers/IO.
apps/client       Vite + React + PixiJS. React owns DOM UI; Pixi owns the world
                  canvas. Modes: /zoo, /editor, /game. Presentation only.
apps/server       Cloudflare Worker + Durable Objects. InstanceDO (one per Level
                  instance) + RouterDO (per Level) + LeaderboardDO (global SQLite).
                  Runs the same @tot/sim World server-side.
tools/spritegen   Local-only CLI that generates game-ready sprites (not shipped).
```

## Load-bearing invariants (do not break these)

1. **Commands in, events out.** The sim is reached only through `SimTransport`:
   send a `SimCommand`, react to `SimEvent`s + an initial snapshot. The client/HUD
   **never mutate game state directly** — they project authoritative events. The
   same boundary lets `LocalTransport` (single-player, in-process) and
   `WebSocketTransport` (multiplayer, server) be swapped behind one interface.
   (ADR-0002.)
2. **The `World` is the single authority** for world *and* player state — entities,
   damage, respawn, loot, inventory, tools, skills, quests, divine powers, cosmetics.
   This is the server-authoritative direction: the client predicts/animates, the
   sim/server decides outcomes. (ADR-0006.)
3. **`packages/sim` stays headless and DOM-free.** No browser APIs, no `setTimeout`,
   no rendering imports; it depends only on `packages/shared`. It must port into a
   Durable Object unchanged. Anything presentational lives in the client.
4. **No one-off tutorial/cutscene logic in the sim.** Scripted beats (onboarding,
   the Council) run in client-side Directors that drive the world only through the
   same public commands any player action uses. The sim only gains *generic,
   reusable* features. (ADR-0005, ADR-0009, ADR-0013.)
5. **Content is data-driven TypeScript** in `packages/shared/src/content`. Adding or
   tuning content should not touch system logic. (See the content map below.)
6. **The client is presentation.** Camera, loot bursts, the armed-item cursor, void
   props, remote cursors — none of these are authoritative; removing them changes no
   sim state. (ADR-0007, ADR-0015, ADR-0018.)

## Where content lives (`packages/shared/src/content`)

| File | What |
|------|------|
| `entities.ts` | Entity definitions (behavior, HP, loot ref, XP, requirements, tags) |
| `entityArt.ts` + `content/entity-art.json` | Visual transform overlay (`resolveArt`) — ADR-0004 |
| `items.ts` | Item definitions (name, rarity, category, description, `worldTextureId`) |
| `tools.ts` | Tool definitions (type, tier, wield req — tier/wield gating retired by ADR-0022) — ADR-0008 |
| `lootTables.ts` | Loot rolls |
| `recipes.ts` | Crafting recipes — ADR-0010 |
| `quests.ts` | The quest chain (prereqs + `enableEntityTag` unlocks) — ADR-0009 |
| `skills.ts` | Skill XP curve / definitions |
| `skillTrees.ts` | Per-Skill Skill Trees: nodes, Tier-unlock + Stat effects, ranks — ADR-0022 |
| `collections.ts` | Collections + entries (Skill **XP** rewards) — ADR-0020/0022 |
| `economy.ts` | Sell values by rarity + source-Skill XP routing (Vendor trade) — ADR-0027 |
| `achievements.ts` | Passive milestones → cursor-skin unlocks — ADR-0017 |
| `cursorSkins.ts` | Cursor skin registry — ADR-0017 |
| `itemInteractions.ts` | Data-driven "use item on entity" table — ADR-0018 |
| `registry.ts` | Aggregated lookups over the above |
| `content/levels/*.json` | Authored Levels (bundled via `levels.ts`); Travel destinations + Arrival Anchors are placement data — ADR-0023/0026 |

Levels are **bundled into `@tot/shared`** so the server and production client read
identical content without dev middleware (ADR-0016).

## Commands

```bash
pnpm dev            # client dev server (http://localhost:5173)
pnpm dev:server     # multiplayer game server (wrangler/Miniflare on :8787)
pnpm test           # sim unit tests (Vitest)
pnpm typecheck      # typecheck every package
pnpm lint           # ESLint
pnpm format         # Prettier
pnpm deploy:server  # build client + deploy the Worker (needs wrangler login)
```

After substantive changes run `pnpm typecheck` and `pnpm test`. Multiplayer
(`#/game`, end of onboarding) needs both `pnpm dev` and `pnpm dev:server`;
single-player modes (Zoo, Editor, tutorial/Council) need only `pnpm dev`.
(`README.md` has the fuller script list — production build, deploy, and the live-wipe runbook.)

## Conventions

- **Bump the version** on meaningful code/content changes: edit only `GAME_VERSION`
  in `apps/client/src/version.ts` (PATCH only). See `.cursor/rules/versioning.mdc`.
- **Use the canonical vocabulary** from `CONTEXT.md`. If a term drifts, fix the docs
  to match `CONTEXT.md`, not the other way around.
- **Record meaningful decisions as an ADR** in `docs/adr/` (next number; keep the
  Context / Decision / Consequences shape; note supersessions). ADRs are
  point-in-time records: prefer adding an **Update** section over editing the
  original reasoning. When a body makes a present-tense claim that is now false
  (e.g. a number, a flow, or a system that was later replaced), you may reconcile
  it during a deliberate documentation pass — mark the stale claim inline with a
  `[superseded/parked by ADR-XXXX]` note rather than silently deleting it, and
  preserve the original rationale so the record still reads as "why we decided
  this then".
- **Generate art via the Sprite Pipeline**, never by hand. See
  `.cursor/rules/sprite-generation.mdc`.
- **Trust model:** client-seeded snapshots are spoofable today (friends prototype),
  but never *architect* as if the client is trusted — the sim validates everything
  (ADR-0016). Server-side persistence/auth is the known deferred seam.
