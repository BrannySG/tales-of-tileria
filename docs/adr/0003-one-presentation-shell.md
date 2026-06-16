# ADR 0003 — One presentation shell across all modes

- Status: Accepted
- Date: 2026-06-16

## Context

The client has three surfaces — Game, Content Zoo, and Level Editor (plus the
new Entity Editor) — that historically diverged visually. The React HUD was a
full-viewport overlay (`.hud { inset: 0 }`) layered over a letterboxed Pixi
canvas, so game UI spilled into the black letterbox bars instead of staying
inside the world. Zoo and Game shared one HUD (including dev tuning), while the
Editor had a wholly separate panel layout and used the native OS cursor. The
goal for the cleanup pass was that everything "feels like part of the game":
consistent framing, panel skin, font, cursor, and entity rendering.

## Decision

Adopt a single presentation shell shared by every mode:

- All modes render the same letterboxed **1920×1080 world frame**. A
  `world-frame` element is sized to the displayed canvas rect and clips the HUD
  (`overflow: hidden`), so game UI can never escape the world view. The HUD is
  authored once at the virtual resolution and CSS-`transform: scale()`d to match
  (see `useStageScale`), keeping it pixel-faithful to the mockup at any size.
- One visual language everywhere: shared panel skin, the DERRICK font (DOM +
  Pixi), one custom cursor, and identical entity rendering (outline strokes +
  contact shadows) in Game, Zoo, Editor, and Entity Editor.
- Modes differ only in **which panels appear**: Game shows the clean HUD; Zoo
  adds the dev tuning panel; the Editor and Entity Editor add authoring panels.
- The custom cursor is two-tier (ADR-adjacent decision): the full in-world
  embodiment (arrow + tool ring + nameplate) is drawn by Pixi over the world,
  while the same arrow art is applied as a CSS cursor over DOM panels. The OS
  cursor is never shown.
- Editor authoring panels remain **reskinned side rails** outside the world
  frame rather than floating inside it.

## Consequences

- Game-mode UI is structurally guaranteed to stay within the world view, fixing
  the original "UI escapes the frame" problem without per-element bookkeeping.
- The mockup is matched proportionally at any window size, since UI and world
  share one virtual resolution and scale factor.
- Reskinned side rails (over in-frame floating panels) keep the editors usable
  — placement isn't obscured — at the cost of the editor not being fully
  immersive. This is the deliberate trade-off; promoting to in-frame floating
  panels later is possible but not planned.
- Any new mode is expected to mount the same frame + cursor + font conventions,
  which is more upfront structure than ad-hoc per-mode layout.
