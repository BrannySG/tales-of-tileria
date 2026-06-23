# ADR 0021 — Minimal onboarding is active; full arc is parked behind a typed flag

- Status: Accepted
- Date: 2026-06-23

## Context

The first-run onboarding had grown into a multi-phase narrative arc (void
cinematic, quested tutorial, Council of Clickers, banishment, then bigworld).
That arc is valuable for worldbuilding, but while core mechanics are still
changing rapidly it creates iteration drag: every systems tweak risks additional
tutorial/cutscene maintenance, and onboarding changes become high-friction.

We need a low-bloat path that keeps first-run fluid and technically clean, while
preserving the fuller arc so it can be re-enabled later without rebuilding it.

## Decision

Make a **minimal onboarding** the active flow:

- Title Screen remains the entry.
- Opening beats stay as Director-owned void props: tap rock, tap tree.
- Prompt for the divine name immediately after the opening beats.
- Enter `bigworld_01` directly and show the intro welcome notice.

Park the full narrative arc (tutorial quest chain + Council/Banishment) behind a
single typed client config switch:

- `ONBOARDING_VARIANT: 'minimal' | 'arc' = 'minimal'`
- Dev `#/onboarding` forces the parked `'arc'` flow for testing.

Also decouple naming from crafting unlock:

- `player.setName` only sets display name.
- Crafting unlock moves to a generic command (`player.setCraftingUnlocked`) so
  the parked Dedication beat can still unlock crafting explicitly when arc mode
  is enabled.

## Consequences

- First-run is shorter and less brittle while systems are in heavy iteration.
- The active path avoids dead duplicate logic by reusing a shared starter-player
  helper for both new-player completion and returning-no-save fallback.
- The full arc remains available for future reactivation, but is no longer on
  the critical path for every gameplay change.
- Docs must clearly distinguish active flow vs parked flow to avoid term drift
  and onboarding confusion.
