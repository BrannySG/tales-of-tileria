# ADR 0016 — Authoritative multiplayer runtime: Durable Object instances, router, and shared cursors

- Status: Accepted
- Date: 2026-06-19

## Context

ADR-0014 landed the seams for multiplayer (event scopes, command `playerId`, a
target multi-tenant `World` shape, and the `interactionRule` claim model) but
deferred the runtime. The game now needs a real shared world: after onboarding,
and for returning players in Game mode, players drop into one open world
(`bigworld_01`) where they see each other's cursors, break entities together, and
roll into a fresh instance once one fills. Onboarding (tutorial + Council) and
cutscenes must stay single-player.

We want an "MMO vibe" — players don't opt in, they just arrive together — without
building a heavyweight game server, and with the existing pure `World` sim reused
verbatim server-side.

## Decision

### Authority: one Durable Object per Level instance

A Cloudflare **Durable Object** (`InstanceDO`, in `apps/server`) owns the
authoritative `World` for a single Level instance. It is single-threaded, so the
sim needs no locking. It:

- builds the `World` from the **bundled** Level definition (`headless: true`, no
  phantom default player),
- accepts player WebSockets and applies their commands with the socket's
  `playerId` via `applyCommand(cmd, playerId)`,
- ticks at ~10 Hz and fans `tickAddressed`/`applyCommandAddressed` output out by
  `EVENT_SCOPE`: `world` events to everyone, `player` events to the owning socket,
- sends a `welcome` (authoritative snapshot + current presence) on join and
  broadcasts `presence.joined` / `presence.left`,
- is **ephemeral**: when the last player leaves it resets (no persistence yet).

It uses the standard (non-hibernating) WebSocket API deliberately: the
authoritative `World` lives in memory and an open socket keeps the DO resident, so
the simulation is never lost mid-session. Hibernation would require persisting the
`World` and is deferred with server-side saving.

### Assignment: a per-Level router DO, density-first

A `RouterDO` (named `router:<levelId>`) tracks the instance names for a Level and
assigns a joining player **density-first**: fill the least-occupied non-full
instance (reusing emptied ones), and only spin up a fresh instance when all are
full (`maxPlayers`, 5 in the open world). An optional `hint` reserves a seam for
future parties/invites. The router Worker validates the Level is multiplayer, asks
the `RouterDO` for an instance, then forwards the WebSocket upgrade to that
`InstanceDO`.

### Per-Level config drives everything

`LevelDefinition.multiplayer?: { maxPlayers; pvp?; interactionDefault? }` decides
whether a Level is networked. Present = shared/networked; absent = single-player.
Levels are **bundled into `@tot/shared`** (`getBundledLevel`) so the server and the
production client read identical content without the dev-only `/api/levels`
middleware.

### Client: a second transport behind the same interface

`WebSocketTransport implements SimTransport` (same contract as `LocalTransport`),
so the renderer and HUD bind to it unchanged. It mints/persists an anonymous
player UUID (`localStorage`), sends `join` with the **carried `Player` snapshot**
(client is the source of truth pre-persistence), hydrates from `welcome`, and
no-ops `tick` (the server ticks). `useWorldScene` selects the transport from
`level.multiplayer`.

Cursors travel as **world coordinates** (not screen space) so each client renders
remote cursors at the correct spot in the shared world regardless of camera pan.
`RemoteCursorManager` spawns a nametagged `RemoteCursorView` per other player,
eased toward its broadcast position, with rings and a hit pulse driven by
`cursor.moved` and actor-tagged `entity.damaged`.

### Feel: optimistic presentation only

On a local tap the client plays the swing spark + sound immediately; the server's
authoritative `entity.damaged` (tagged with the actor `by`) supplies the real
number/HP and is de-duped so it isn't played twice. No client-side prediction of
state — HP, depletion, and loot stay server-authoritative.

### Co-op rewards

The open world defaults to `lastHit` (whoever lands the depleting blow takes
loot/XP). Per-zone overrides via `interactionDefault` enable peaceful (`claimed`)
or competitive (`sharedContribution`, currently stubbed to last-hit) zones.

## Consequences

- The pure `World` runs unchanged on client (single-player) and server
  (multi-tenant); all 63 sim tests still pass.
- New workspace `apps/server` (Worker + two DO classes) builds via `wrangler`.
- Local dev is two processes: `pnpm dev:server` (wrangler/Miniflare on :8787) and
  `pnpm dev` (Vite), with the client WS URL from `VITE_TOT_SERVER_URL`.
- Instance world state is ephemeral (resets on a fresh/empty instance) and
  client-seeded snapshots are spoofable — both acceptable for a friends prototype,
  closed when server-side saving lands (the deferred seam).
- Deferred: server-side persistence/auth, `sharedContribution` credit, raids /
  shared cutscenes / PvP, and WebSocket hibernation.
