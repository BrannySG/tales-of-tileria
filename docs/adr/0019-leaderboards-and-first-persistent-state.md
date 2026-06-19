# ADR 0019 — Leaderboards: the first persistent server state, a global SQLite Durable Object written server-side

- Status: Accepted
- Date: 2026-06-19

## Context

The game had no persistent server state at all: `InstanceDO` is intentionally
ephemeral (resets when empty), the `RouterDO` only tracks live instance names,
and player progress lives client-side (`tot.playerSave`) seeded into the
authoritative `World` on join (see ADR-0016). We want a first, small,
cross-player feature that establishes a durable store on Cloudflare — a stepping
stone toward server-side player saving — without taking on accounts/auth yet.

The first feature is a set of simple leaderboards: **Woodcutting level**,
**Mining level**, and a **Total level** board (the player's combined level across
all skills), viewable from a HUD trophy icon. The open questions were where the
data lives, who is allowed to write it, and how the client reads it.

## Decision

### A single global LeaderboardDO backed by SQLite

A new `LeaderboardDO` (in `apps/server`) holds one row per player in its built-in
SQLite storage (`scores(player_id PRIMARY KEY, display_name, woodcutting_level,
woodcutting_xp, mining_level, mining_xp, total_level, total_xp, updated_at)`). It
is addressed by the fixed Durable Object name `global`, so every instance writes
to and reads from the same authoritative board. It exposes two internal routes:
`POST /submit` (upsert) and `GET /top?skill=&limit=&me=` (ranked rows + the
caller's own rank). Each board key (`woodcutting`, `mining`, `total`) maps to a
`<key>_level` / `<key>_xp` column pair, so adding a board is one column pair and
one schema line. New columns are added with idempotent `ALTER TABLE` guards so
existing DO tables migrate forward without a destructive reset.

Chosen over **D1**: it keeps everything in the Durable Object paradigm the
project already uses (same `new_sqlite_classes` migration style, single-threaded
so no locking), needs no new binding type, and gives trivial ranked queries
(`ORDER BY <skill>_level DESC, <skill>_xp DESC`). It is genuinely persistent, so
it doubles as the seam for future cloud saving. Rejected **KV** (poor at ranked
queries) and a per-instance board (we want one global ranking).

### Scores are written server-side from the authoritative instance

`InstanceDO` owns the authoritative `World`, so it is the writer. It upserts a
player's ranked levels into `LeaderboardDO` on `join` (seeding their current
levels) and whenever any `skill.xpGained`/`skill.leveledUp` event flows through
`applyCommandAddressed`. It listens for *any* skill (not just woodcutting/mining)
because the `total` board sums every skill, and recomputes the total from the
authoritative snapshot on each write. Writes are fire-and-forget and guarded: a
failed or slow leaderboard write must never block or break the game socket. The
client never writes the leaderboard — it only reads.

Eligibility: only players who have set a **divine name** (non-empty
`displayName`) appear; rows are keyed by the anonymous `tot.playerId`, so a
reconnect or level-up upserts the same row rather than duplicating.

### The client reads over HTTP

The Worker gains a `GET /leaderboard` route (added to `run_worker_first` so it
bypasses the co-hosted SPA assets) that forwards to the global `LeaderboardDO`,
with permissive CORS for split-origin dev. The client adds a `getServerHttpUrl()`
mirroring `getServerWsUrl()` (mapping `ws(s)://` → `http(s)://`) and a
`fetchLeaderboard()` helper. The HUD trophy opens a tabbed modal (Total,
Woodcutting, Mining; defaulting to Total) that fetches fresh on open / tab
switch, ranks by level (XP-tiebroken), shows the top 25, and highlights + pins
the current player's row when they fall outside it. Leaderboard traffic stays off
the WebSocket protocol.

## Consequences

- The project now has its first durable server store; future cloud saving can
  build on the same DO+SQLite pattern (and may reuse the per-player row).
- Like all current state, scores are client-seeded and therefore spoofable
  (consistent with ADR-0016); acceptable for a friends prototype and closed when
  accounts/auth land.
- Only progress made while connected to a multiplayer instance (`bigworld_01`
  today) is recorded — single-player onboarding/cutscenes have no server, which
  matches where real grinding and returning players already live.
- Adding a new board is a small change: a column pair, a board key, and a tab.
  Schema growth uses additive, guarded `ALTER TABLE` statements in the DO
  constructor (the `total` board was added this way).
