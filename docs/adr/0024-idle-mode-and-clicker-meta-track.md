# ADR 0024 — Idle Mode is a sim-driven auto-gather loop, gated by a Clicker meta-track

- Status: Accepted
- Date: 2026-06-24
- Evolves: [ADR-0015](0015-player-driven-camera-coexists-with-cinematic.md) (the sim now writes `cursor.x/y`), [ADR-0022](0022-skill-trees-replace-flat-upgrades.md) (broadens the Skill Tree machinery to a non-Skill tree)

## Context

The game has only **active** play: the player taps Entities or holds a Hover to
passively damage them (ADR-0022's `hoverDamage`/`hoverRate`). We want an **Idle
Mode** where the Cursor detaches from the pointer, roams the Level on its own, and
gathers a chosen Skill hands-off — a key idle-game progression layer that also
rewards broad, cross-Skill levelling.

Three forces shaped the design:

- **Background play.** The owner wants a multiplayer tab left open to keep
  auto-playing. That is only possible if the loop is **sim/server-driven**: the
  `InstanceDO` keeps ticking when the tab is backgrounded, whereas a client-driven
  loop on `requestAnimationFrame` freezes. (True offline/closed-tab idle stays out
  of scope — there is no player persistence/auth yet, the known deferred seam in
  `AGENTS.md`.)
- **ADR-0015's premise no longer holds.** That ADR noted "the sim only stores
  `cursor.x/y` and never uses them spatially." Idle Mode requires the sim to *read*
  Entity coordinates (nearest-target selection) and *write* the Cursor's coordinates
  (auto-travel). The Cursor position becomes spatially meaningful and authoritative.
- **Progression should reward breadth.** Unlocking idle should pull from *all*
  Skills, not one — encouraging players to level across the board.

## Decision

**Add a sim-authoritative Idle Mode, gated by a new Clicker meta-track, with the
client owning all presentation.**

- **Authority (hybrid).** The sim owns the idle loop and all gating; the client
  owns feel. Because the loop ticks server-side, a backgrounded *multiplayer* tab
  keeps gathering; single-player still freezes when backgrounded (local clock).
- **Sim owns the idle Cursor's position.** While idle, the sim eases `cursor.x/y`
  toward the selected target at the player's **auto-move speed** and broadcasts
  throttled `cursor.moved` with `mode: 'idle'`, so remotes watch you roam even with
  your tab backgrounded. This is the deliberate evolution of ADR-0015.
- **Gather mechanic reuses the passive tick.** On arrival the sim runs the existing
  Hover tick (`hoverDamage`/`hoverRate`) on the target; idle effectiveness *is* the
  target Skill's Hover build. No new damage path. On depletion it reselects the
  nearest harvestable target; when nothing is harvestable it waits in place.
- **Clicker is a meta-track, not a Skill.** It has no XP. `clickerLevel = floor(Σ
  trainable-Skill levels / 10)`; tree points = `clickerLevel − Σ(cost × rank)` of
  allocated Clicker nodes. It is excluded from the Total-level/leaderboard economy
  and reuses ADR-0022's node/rank/allocation machinery via a broadened tree id
  (`TreeId = SkillId | 'clicker'`). `deriveStats` is untouched and skips it; a
  parallel `deriveCursorStats` resolves the Clicker tree into a `CursorStats` block.
- **Two unlock gates per idle.** A Skill can be idled only when **both** the Clicker
  tree's general **Idle Mode** capability node **and** that Skill tree's
  **"<Skill> Idle"** node are allocated. The Clicker tree then grows cursor stats:
  **auto-move speed**, **idle yield** (an XP % multiplier on idle gathers), and
  **multi-skill idle** (a high-gated stat raising how many Skills the single Cursor
  harvests among). *Auto-move radius* is designed-for but deferred.
- **Control & contracts.** Fully hands-off via `idle.start { skillIds }` /
  `idle.stop`; the sim validates against `deriveCursorStats` (capability + per-skill
  idle + `maxIdleSkills`). New events `idle.started`/`idle.stopped` and
  `player.cursorStatsChanged`; `cursorStats` ships in the `ZoneSnapshot`.
- **Client is presentation.** The camera enters a follow mode tracking the
  authoritative Cursor (zoomed in); a **moon** indicator floats above local and
  remote idle Cursors (the new `'idle'` `CursorMode`); a bottom **mode bar** lists
  the Level's gatherable Skills (Locked unless both gates are met); a **session
  HUD** shows total idle XP and a rarity/value-sorted loot grid. The session tally
  is **client-only ephemeral** — it accumulates `skill.xpGained`/inventory deltas
  while idle and resets on stop/leave; nothing about it is persisted or sim state.

## Consequences

- A second play mode shares one rules engine: idle reuses Hover Stats, the Skill
  Tree machinery, claims (`interactionRule`), and event addressing unchanged. New
  idle behaviour is *generic* sim features, not one-off scripts (AGENTS.md #4).
- The Cursor's coordinates are now authoritative and spatially meaningful in one
  mode. A future reader must know ADR-0015's "cursor is never used spatially" no
  longer holds while idle; active play is unchanged (pointer still drives it).
- Progression gains a breadth incentive: every 10 Skill levels buys a Clicker point,
  and Clicker unlocks/scales idle. Adding cursor stats or idle Skills is content —
  a new node effect or `idleSkill` node, no system changes.
- The Clicker track widens tree-keyed surfaces from `SkillId` to `TreeId`
  (`skillTrees`, allocate/respec commands, lookups) while keeping `SkillId` for
  XP/Stat/combat contexts, so the four real Skills stay strongly typed.
- Backgrounded single-player won't progress (local clock); only multiplayer tabs
  keep ticking. Closed-tab/offline idle remains future work pending persistence.
- Reversing is moderately costly — it adds persisted Clicker allocations and a new
  authoritative cursor-position path — but the sim/client split means the feel can
  be retuned freely (camera, bar, moon, session HUD) without touching the loop.
