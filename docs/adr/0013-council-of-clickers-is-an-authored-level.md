# ADR 0013 — The Council of Clickers is an authored Level of Cursor-being entities

- Status: Accepted
- Date: 2026-06-17

## Context

After the player strikes the Ancient Tree, the arc cuts to the **Council of
Clickers**: a court of celestial cursors who judge the player and enact the
Banishment. ADR-0005 established the Onboarding Director and a precedent for
scripted moments shown over a void (the opening cinematic) as pure presentation.
We could have built the Council the same way — render-only props over blackness.

But the Council needs scriptable speakers the camera can frame, addressable by id,
that the Banishment command operates within, and it needed to sit naturally inside
the existing tutorial → swap → next-Level machinery. The void-cutscene approach
would have meant inventing a parallel "fake entity" system for the council members
and crowd just for this beat.

## Decision

Author the Council as a **real Level** (`council_01.json`) populated with a new
**Cursor-being** entity kind. A Cursor-being is non-damageable and non-reactive — a
scriptable speaker a Director addresses by instance id — used for both the five high
council members and the ambient murmuring crowd. They are authored `locked` so a new
`CouncilDirector` can reveal them on cue (via `entity.enable`), speak through `sayAt`
using the persisted divine name, deliver the verdict, and issue
`player.setDivinePower smite:false` (the real Banishment).

`OnboardingMode` becomes a three-phase machine — **tutorial → council → mortal
realm** — each phase a `WorldScene` carrying the Player snapshot. Smite is still
unlocked entering the Council and revoked leaving it, so the snapshot carried into
the mortal realm has the power already stripped. The Ancient Tree blink (a white
flash + `onAscend`) drives the tutorial→council transition; the Council's verdict
drives council→mortal realm, where the out-of-world developer welcome shows and
`markOnboarded()` runs.

## Consequences

- The Council reuses the Level loader, renderer, snapshot carry, and command/event
  flow instead of a bespoke cutscene system; the divine name and Smite-revoke are
  authoritative sim state, not render tricks.
- This **diverges** from ADR-0005's void-cutscene precedent: a heavily scripted
  cinematic now runs on an authored Level rather than over blackness. The trade-off
  is accepted because the council needs addressable, camera-framable speakers and a
  real sim context for the Banishment command. Lightweight void cinematics remain
  valid for non-interactive flourishes.
- Cursor-beings double as the prototype's **faked social presence** (ambient cursors
  in the mortal realm), forward-compatible with real multiplayer later but with no
  networking now.
- This **supersedes** ADR-0011's detail that the tutorial→shared-zone swap fires on
  the `first_offering` claim and carries a `better_wood` oak quest: the transition is
  now the Council/Banishment, and that oak quest is dropped from the intro chain.

## Update (2026-06-23)

ADR-0021 parks the Council/Banishment route behind a typed onboarding variant and
makes a minimal flow the active default. `council_01` and `CouncilDirector` stay
authored and testable (dev forced arc), but no longer run on the default
first-time path.
