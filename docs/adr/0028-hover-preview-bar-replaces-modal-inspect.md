# ADR 0028 — Hover preview bar supersedes the modal Inspect popover

- Status: Accepted
- Date: 2026-06-25

## Context

Entity details ("Inspect") were surfaced through a floating `InspectPanel`
opened only by a deliberate gesture: right-click, Ctrl/Cmd+primary-click, or a
touch long-press. This had two felt problems and one structural one:

- **Discoverability.** Hover already fires `entity.hoverStart`, but the panel
  needed a *separate, hidden* gesture. New players never found Inspect, so the
  drop %, requirements, and respawn data the sim already derives went unseen.
- **Layout fragility.** The panel was world-anchored: every frame
  `syncInspectProjection` converted the entity's world point to host CSS pixels
  (`worldToHostPixel`, `coverScale`, canvas offsets) and `InspectPanel` ran
  prefer-above/fallback-below + viewport-clamp anchor math. This was a recurring
  source of edge-clipping and hover-collision bugs.
- **Already-computed data unused.** `buildInspectModel` produces `chanceText`
  (drop %) and `quantityText`, but the popover only rendered the drop *icon*.

The fix wanted: reveal details on the gesture players already perform (hover),
in a place that can't clip.

## Decision

**Replace the world-anchored modal Inspect with a persistent, fixed-position
Hover Preview Bar, and delete the old gesture + anchor machinery.**

- **A sticky, last-seen preview (presentation-only).** A new `hoverPreview`
  slice on the HUD store holds the previewed entity's `definitionId` + live
  `hp/maxHp/state/respawnRemaining`. `SceneRenderer.wireEntity`'s `pointerover`
  seeds it (alongside the existing `entity.hoverStart` send); a per-frame
  `syncHoverPreview` keeps the live values fresh. The bar is **sticky**: it is
  *not* cleared on `pointerout`, only swapped when a different entity is hovered,
  and retired after `PREVIEW_IDLE_HIDE_MS` of no hover. This is deliberate — the
  click loop fires hover-in/out many times per second, so strict mirroring would
  flicker. No anchor math: `HoverPreviewBar` is docked bottom-right (above the
  Skill Tracker) and surfaces the `chanceText` / `quantityText` the model already
  computed, with rarity-coloured borders + a gentle Rare+ aura.
- **The sim boundary is untouched.** `entity.hoverStart` / `entity.hoverEnd` /
  `target.changed` and the Spacebar lock mechanic are unchanged (invariants #1,
  #2); only the *presentation* of inspect changed (invariant #6). The preview is
  a pure projection of `buildInspectModel` + authoritative HP — removing it
  changes no sim state.
- **The old path is deleted, not deprecated.** `inspectGesture`,
  `wireInspectGesture` (the touch long-press), `openInspect`,
  `syncInspectProjection`, `worldToHostPixel` + the `coverScale`/canvas-offset
  fields, the `InspectInfo` store slice and its `openInspect/updateInspect/
  closeInspect` actions, the `onInspect` renderer option, `InspectPanel.tsx`, and
  the `.inspect-*` CSS are all removed. `buildInspectModel` (+ its test) stays —
  it now feeds the bar. `contextmenu` is still prevented on the canvas.

## Consequences

- Details are now discoverable on the action players already perform, the
  long-standing class of anchor/clipping bugs is gone (the bar is a single fixed
  slot), and the drop % the sim derived is finally shown.
- The right-click / Ctrl+click / **touch long-press** affordance is **given up**.
  Touch users no longer have an explicit inspect gesture — they get the same
  sticky preview on tap-hover. Right-click is free to repurpose later (e.g. an
  expanded detail view) but does nothing for inspect today.
- The bottom-right corner is busier; the bar is positioned above the Skill
  Tracker. Levels with an unusually tall Skill Tracker (5+ gatherable Skills, of
  which there are none today) could crowd it — revisit placement if that arises.
- The "smaller profile card" idea (a sibling item in
  `creative/ux-housekeeping.md`) was intentionally left out of this change to
  keep the diff focused; it remains a standalone polish task.
