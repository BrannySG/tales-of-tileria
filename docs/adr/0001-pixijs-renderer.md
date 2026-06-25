# ADR 0001 — Use PixiJS as the rendering engine

- Status: Accepted
- Date: 2026-06-16

## Context

The prototype needs a 2D renderer for a browser-based "god cursor" idle game:
sprites for entities (rocks, trees), a custom cursor, particle bursts, floating
damage numbers, and smooth procedural "juice" (flash / shake / squash). The
mockup is a hand-painted top-down scene. We expect many lightweight sprites and
frequent visual feedback, but no heavy physics or 3D.

We also want a hard separation between rendering and game logic so the same
simulation can later run on an authoritative server (see ADR 0002).

Options considered:

- **PixiJS** — mature, fast WebGL/WebGPU 2D renderer; pure rendering library
  (no opinion on game logic); great sprite/text/particle support.
- **Phaser** — full game framework (scenes, physics, input, loop). Powerful but
  bundles game-logic concerns we explicitly want to keep out of the renderer.
- **Plain Canvas 2D** — simplest, but we'd hand-roll batching, filters, and
  performance work that Pixi already does well.

## Decision

Use **PixiJS v8** strictly as a renderer. All game logic lives outside Pixi in
the headless simulation core. Pixi owns only the world canvas; all other UI
(HUD, editor panels) is React DOM layered over the canvas.

## Consequences

- Clean seam between presentation and simulation; the renderer consumes
  snapshots + domain events and emits commands, nothing more.
- We implement our own small particle system and tween/animation helper on top
  of Pixi sprites rather than adopting `@pixi/particle-emitter` (which predates
  Pixi v8's renderer rewrite and carries compatibility friction). This keeps the
  feel layer self-contained and version-stable.
- A fixed virtual resolution (1280×720 at the time of this ADR; **the canonical
  Viewport is now 1920×1080** — see ADR-0003/0015) is scaled-to-fit; world
  authoring and hit-testing happen in virtual coordinates, independent of the
  display size.
- If we ever need built-in physics/tilemaps, we revisit; for this game's needs
  Pixi is the lighter, better-separated choice.

## Update (2026-06-25)

The fixed virtual resolution settled at **1920×1080** (ADR-0003 letterboxed world
frame; ADR-0015 separates the fixed **Viewport** from data-driven **World bounds**
so Levels can be larger than the Viewport and pan). PixiJS-as-renderer-only is
otherwise unchanged.
