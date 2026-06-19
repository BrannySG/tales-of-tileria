# ADR 0015 — Player-driven pan camera coexists with the cinematic camera

- Status: Accepted
- Date: 2026-06-18

## Context

The world was authored and rendered at a fixed virtual resolution (1920x1080):
the Pixi `Application`, the background sprite, and the camera all assumed
viewport == world. We want Levels whose World is larger than the viewport (the
first is `bigworld_01` at 3840x2160) that the player navigates by panning
(WASD/Arrows, desktop edge-push, touch drag).

A `worldCamera` container already exists and is driven by the `CinematicController`
for Director-scripted focus/reset (ADR-0005), gated by `CINEMATIC_CAMERA`. A
player-driven pan camera must drive the *same* container without fighting the
cinematic one, and the cinematic `cameraReset` previously returned to the
identity transform `(0,0)` — which in a larger World snaps the view to the
top-left corner instead of a sensible resting view.

## Decision

Split the two fused concepts and add a dedicated owner:

- Treat the virtual resolution as the **Viewport** (fixed, screen space: the
  canvas, `hitArea`, blackout, fit math) and read **World bounds** from
  `LevelDefinition.width/height`. The background sprite stretches to the World.
- Add a `CameraController` (`apps/client/src/render/CameraController.ts`) that
  owns the *player* (resting) transform of `worldCamera`: position-only (no
  zoom), clamped to the World bounds so the Viewport never reveals past the
  edge. A World equal to the Viewport is pinned at the origin and never pans, so
  existing 1920x1080 Levels behave exactly as before.
- The `CinematicController` stays the sole camera *tween* owner. While a
  cinematic owns the view it **suspends** player input (`setCameraInputEnabled(false)`
  on `cameraFocus`), and `cameraReset` now returns to the `CameraController`'s
  last clamped resting position (world-centre on a fresh load) before handing
  control back (`setCameraInputEnabled(true)`).
- The Cursor stays in screen space and is unaffected; the sim only stores
  `cursor.x/y` and never uses them spatially, so no world-coordinate conversion
  is needed.

## Consequences

- World size is data-driven per Level; opting a Level into panning is just
  setting `width/height`, with no renderer changes.
- There is a single, clear ownership rule: the player owns the resting view, the
  Director temporarily borrows the camera and returns it. The two never write
  the transform at the same time, so they cannot visibly fight.
- A future reader must know the camera has two drivers and that `cameraReset` is
  no longer an identity reset — it returns to the player's clamped resting view.
- The player-camera is pure presentation (consistent with the Camera glossary
  term and ADR-0005); it sends no commands and never touches sim state, so it
  ports unchanged when the World becomes multi-tenant (ADR-0014).
- Touch drag uses a small movement threshold so taps below it still fall through
  as tap-to-damage; edge-push is a mouse-only affordance.
