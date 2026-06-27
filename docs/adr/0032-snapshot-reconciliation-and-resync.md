# ADR 0032 — Presentation reconciles against authoritative snapshots; the client requests a resync on visibility regain

- Status: Accepted
- Date: 2026-06-27

## Context

`creative/ux-housekeeping.md` logged three HIGH-severity trust bugs from
real play. They are independent, but all three live at the same seam — how
**presentation** keeps faith with the **authoritative World** (invariants #1/#2/#6):

1. **Save-state rollback on tab-out.** Progress could snap backward after
   backgrounding the tab or after a brief disconnect. Two independent causes:
   (a) the localStorage save is debounced (`SAVE_DEBOUNCE_MS`) and only flushed
   on scene unmount, but browsers throttle timers in hidden tabs — so a pending
   write was lost when the tab was backgrounded or closed; and (b) on a
   WebSocket **reconnect** the transport re-`join`ed with the carried Player
   snapshot **frozen at construction**, so the server re-seeded stale state over
   this session's gains (server-side persistence is still deferred, ADR-0016, so
   the client snapshot is the source of truth on join).
2. **Multiplayer desync on refocus.** A backgrounded tab buffers a burst of
   server events that flush all at once on refocus. The event-driven scene has no
   reconciliation against authoritative truth, so it could strand presentation:
   healthbars left floating over entities the server had already reaped, and —
   the sharpest symptom — an entity that hydrated from the join snapshot as
   `respawning` would **render on respawn but stay untappable for the rest of the
   session**, because `EntityView.onRespawned()` restored the art but never
   re-enabled pointer interactivity.
3. **Gated-tap "false success."** Networked play plays the hit spark + SFX
   **optimistically** on the local tap for zero-latency snappiness, then de-dupes
   the authoritative `entity.damaged`. But a tap that *can't land* (missing or
   unequipped Tool, locked Tier, skill too low) played that same success juice
   before the server's `entity.blocked` arrived — the client cheerfully signalled
   a hit that never happened.

The deeper issue behind #2/#3 is that the client was a pure *event projector*
with no way to (a) re-anchor to authoritative truth on demand, or (b) predict an
outcome the sim would reject. The `WebSocketTransport` snapshot is frozen at the
join `welcome`, so there was no fresh authoritative state to reconcile against.

## Decision

**Keep the sim authoritative and the client dumb, but give presentation two new
honesty tools: it can re-anchor to a fresh authoritative snapshot on demand, and
it can predict a block with the *same shared rule* the sim enforces. Plus the two
targeted save-state fixes.**

- **Flush-on-hide + reconnect re-seed (save-state).** The world scene registers
  `visibilitychange` (on `hidden`) and `pagehide` listeners that call the
  existing `flushSave()` synchronously (localStorage writes are sync, so this is
  reliable), cleaned up on teardown. Independently, `WebSocketTransport` takes a
  `getLivePlayer()` supplier and, on **reconnect only** (it has already had a
  `welcome`), re-`join`s with the live HUD projection instead of the frozen
  construction snapshot — so the server can never restore stale state over live
  progress. First join still uses the carried snapshot.
- **A `resync` request/response (protocol).** A new client message
  `{ type: 'resync', playerId }` asks the `InstanceDO` for the current
  authoritative state; the server replies `{ type: 'resync', snapshot, presence }`
  (read-only — no world mutation), distinct from `welcome` so it never re-runs
  join-time setup. `WebSocketTransport.requestResync()` sends it; arriving
  snapshots refresh the stored snapshot and fan out to `onResync` subscribers.
- **Snapshot reconciliation on visibility regain (presentation).** When a hidden
  tab becomes visible again, the scene calls `requestResync()` and feeds the
  reply to `SceneRenderer.reconcile(snapshot)`, which treats the snapshot as
  truth: it **adds** views for entities that appeared while away, **syncs** HP /
  availability / interactivity of the damageable kinds (`resource`, `enemy`,
  `questObject`) without playing hit juice, and **removes** views the server has
  reaped (the source of orphaned healthbars). Non-combat entities (NPCs, props,
  shrines, stations, vendors) keep their event/director-driven lifecycle and are
  reconciled for presence only. As a targeted backstop, `onRespawned()` now also
  re-enables interactivity, so a respawn is tappable even without a reconcile.
- **A shared block rule + client predictive gate (gated-tap).** The sim's
  `blockedReason()` logic is extracted into a pure shared helper
  `evaluateEntityBlock(player, entityDef): BlockInfo | undefined` (in
  `packages/shared/src/content/requirements.ts`), with the Tier read factored
  into `maxTierUnlocked()` so `deriveStats` and the block check share one source.
  The sim now calls the helper (single choke point per the architecture rule).
  The client runs the **same** helper, fed from the HUD projection, before the
  optimistic FX: if it predicts a block it plays the instant error cue
  (`wiggle` + `denied` + requirement float) instead of success juice, and de-dupes
  the authoritative `entity.blocked` echo within a short window. Valid taps keep
  their zero-latency optimistic FX. `entity.blocked` stays the authoritative
  backstop for any client/server divergence.

## Consequences

- The client gains a sanctioned way to re-anchor to authoritative truth without a
  hard reload: `resync` is a new, small, read-only protocol seam alongside
  `welcome`. Reconciliation is idempotent and projection-only — removing it
  changes no sim state (invariant #6) — and it makes the buffered die-off burst
  on refocus cosmetic, since the end-state is corrected regardless.
- Block logic now has a **single definition** shared by sim and client
  (`evaluateEntityBlock`), so the predictive gate can never drift from the
  authoritative rule. The trade-off is a new shared helper the client depends on,
  and a thin trust assumption: the predictive gate reflects the HUD projection,
  which can lag the authoritative state by one event right after equipping — hence
  `entity.blocked` is retained as the backstop and the optimistic cue is
  time-dedup'd rather than assumed correct.
- Save integrity no longer depends on a debounce timer surviving a hidden tab,
  and a reconnect can no longer roll the player back. Server-side authoritative
  persistence remains the known deferred seam (ADR-0016); this hardens the
  client-as-source-of-truth model in the meantime rather than replacing it.
- **Given up / deferred (designed-for):** smoothing the batched event flood on
  refocus (reconcile makes it cosmetic, so it stays parked); full per-entity event
  replay/versioning; and any server-driven push-resync (today the client always
  pulls on visibility regain). Reconciliation deliberately leaves non-combat
  entity lifecycles to their existing event/director paths rather than rebuilding
  them from the snapshot.
