# UX & Housekeeping — Scratchpad

> **Status: exploratory / tactical backlog — NOT canonical.**
> Near-term UX fixes, polish, and housekeeping that don't belong in
> [`design-ideas.md`](design-ideas.md) (game-design features) or
> [`story-arc.md`](story-arc.md) (narrative).
>
> **Priority ratings and reviews are maintained per the
> [creative docs protocol](../.cursor/rules/creative-docs.mdc).
> Re-review every item when this doc is updated.**
>
> Last reviewed: 2026-06-25 *(Collection juice + hover preview bar shipped — v0.1.44)*

---

## Collection Book — registration juice and icon-first layout

> **Priority: HIGH — shipped 2026-06-25 (v0.1.44)**
> Impact: Every Collection registration — a core progression action that used to
> feel flat and forgettable.

### Problem *(premise corrected on build)*

Adding an item to a Collection **didn't feel good**. The felt gap was **no moment
of reward** on the tap — only a tiny slot pulse + a `loot` SFX fired. (The earlier
note that "the panel instantly disappears" was inaccurate: the modal never closed
on register; it only closes on overlay/×/Esc. The real problem was missing reward
feedback, not auto-close.) The book should feel awesome; it used to feel like
ticking a box.

### Resolution (shipped)

- **Registration juice (rarity-tiered, restrained).** Every register now plays a
  slot **slam** (scale punch) + a **rarity-coloured flash ring**; Rare+ adds a
  bigger punch and a **whole-panel shake**. Common/Uncommon stay subtle (no shake)
  so frequent gather registrations don't rattle the screen. Driven entirely
  client-side: `bindHud` diffs the `collection.registered` totals to find the slot
  whose count jumped + its rarity (a transient `lastRegister` signal) — **no sim
  change** (the sim still owns `collection.register`).
- **Two reward tiers.** Per-slot register = the new slam/flash; **entry-complete**
  keeps the existing `CompletionCelebration` toast as the louder second tier.
- **Icon-first detail.** The detail panel's spreadsheet text (rarity label,
  registered/owned counts, source line) collapses behind a single compact
  "Need N more" status line and reveals on hover/focus; a rarity-bordered icon
  leads each row. The centre list was already icon-first, so it was left as is.
- `prefers-reduced-motion` disables the slam/flash/shake.

**Review**

Pros:
- Fixed a felt gap on a loop players hit repeatedly — high touch frequency, zero
  sim changes (client diff of the authoritative event).
- Reuses rarity colours + the slot-pulse pattern — consistent arcade feel.
- Icon-first detail improves scanability; the hover-reveal keeps requirement
  context one hover away.
- Slam + rarity flash gives an emotional peak on commitment (vs the drop peak the
  loot carousel idea targets).

Cons / risks:
- Modal shake is gated to Rare+ to avoid Common-registration annoyance — watch in
  playtest that the threshold feels right.
- Hover-reveal of detail text is mouse-friendly; touch users rely on the compact
  status line + the existing `title` tooltip. Fine for now.

Notes:
- **Done.** Sequence simplified from the original "throb → vanish → slam" (there is
  no distinct source element in the modal) to slot slam + rarity flash + Rare+
  panel shake — same reward peak, fewer moving parts.
- Pair with the loot carousel (design-ideas) for consistent "items feel earned"
  language across Bag, Collection, and Vendor.

---

## HUD UI scale slider (Settings)

> **Priority: MEDIUM**
> Impact: Readability and accessibility for players who need larger HUD text,
> icons, and controls — without changing world/canvas scale.

### Intent

Add a **UI scale** option in Settings: a **nice slider** so players can adjust
the **HUD overlay's scale**. Primary goal is **readability** for those who need
it (small screens, vision preferences, high-DPI laptops zoomed out). Secondary:
it should **feel good** to use — not a buried dev toggle.

### Direction

- **Settings → Display** (or Accessibility) section with a labelled slider,
  matching the existing audio slider pattern (`VolumeRow` in `SettingsMenu`).
- **Live preview** as the player drags — HUD resizes immediately, no Apply button.
- **Persist** across sessions (same pattern as `AudioSettings` in the HUD store /
  `localStorage`).
- **Default 100%** at the centre of a sensible range (e.g. **80%–150%** or
  **75%–175%** — tune in playtest). Show a numeric label (`100%`) beside the
  slider.
- **HUD only** — scales the DOM overlay (`hud-layer`, modals: Bag, Collection Book,
  Skill Tree, Vendor, Settings). Does **not** scale the Pixi world canvas; the game
  view stays the same size.

### Feel-good details

- Slider thumb and track styled to match the game's UI chrome (not browser default
  where avoidable).
- Optional subtle **snap or emphasis at 100%** so reset-to-default is discoverable.
- At high scale, respect **safe-area insets** — panels shouldn't clip off-screen;
  prefer scaling from anchor corners already used in `styles.css` (`--hud-scale`).
- Consider a **Reset to default** text button next to the slider.

### Implementation hook

The HUD already uses a CSS variable `--hud-scale` on `.hud-layer` (today tied to
letterbox `stage.scale`). A player preference would compose as e.g.
`effectiveScale = stage.scale * uiScalePreference` — keep the fit-contain factor
and the user multiplier separate.

**Review**

Pros:
- Directly helps readability — the main stated goal — with minimal gameplay impact.
- Reuses Settings modal + slider row pattern; persistence seam mirrors audio.
- `--hud-scale` is already threaded through HUD CSS — one multiplier, wide reach.
- Presentation-only; no sim or protocol changes.

Cons / risks:
- Extreme scale + many open modals can overflow small viewports — needs min/max
  clamp and playtest on mobile.
- Composing two scale factors (`stage.scale` × user pref) must stay consistent
  on every HUD surface (including Vendor full-screen and Collection Book).
- Scaling text without reflow can make long labels clip — may need `max-width`
  or allow wrap at high scale.

Notes:
- Frame as **accessibility / readability**, not "zoom the whole game."
- Ship alongside or before Collection Book icon-first work — both target legibility.
- Do not conflate with browser zoom; this is an in-game preference players can
  find without OS settings.

---

## Bottom-right hover preview bar (replaces right-click Inspect)

> **Priority: HIGH — shipped 2026-06-25 (v0.1.44, ADR-0028)**
> Impact: Every hover over a gatherable entity — the most common non-click action.

### Problem

Inspect / "hover tooltips" used to open only on **right-click** (or Ctrl+primary
click / touch long-press). That was clunky and easy to miss. The floating
`InspectPanel` also fought hover collisions, weird anchor math, and screen-edge
clipping.

### Resolution (shipped)

A **persistent, sticky preview bar** (`HoverPreviewBar`) docked **bottom-right,
above the Skill Tracker**:

- **Reveals on entity hover** (same moment we send `entity.hoverStart`), and is
  **sticky/last-seen** — it keeps showing the last hovered entity instead of
  flickering with the fast click loop; it retires after a short idle
  (`PREVIEW_IDLE_HIDE_MS`).
- Shows the `buildInspectModel` data: name, HP, requirements, XP, respawn, drops —
  **now including the drop % (`chanceText`)** the old panel never rendered.
- Rarity-coloured borders + a gentle Rare+ aura. One fixed slot, no anchor math,
  zero edge-clipping.
- **The old path was deleted** (not just deprecated): `inspectGesture`, the touch
  long-press, `openInspect`/`syncInspectProjection`/`worldToHostPixel`, the
  `InspectInfo` store slice, the `onInspect` option, `InspectPanel.tsx`, and the
  `.inspect-*` CSS. `buildInspectModel` stays (it feeds the bar). See ADR-0028.

### Deferred

- **Smaller profile card** (top-left `hud-profile`) — intentionally left out to
  keep the diff focused; still a standalone polish task.
- The sim's lock / hover-damage mechanics are untouched (only presentation
  changed). Right-click now does nothing for inspect — free to repurpose later
  (e.g. an expanded detail view).

**Review**

Pros:
- Fixed a felt UX gap on every session (inspect is now on the action players
  already perform — hover).
- Reuses `buildInspectModel` + HUD store — presentation-only, no sim changes.
- Drop % was already computed; this surfaced it.
- Fixed anchor eliminated an entire class of layout bugs (and deleted the code
  that caused them).

Cons / risks:
- Bottom-right is crowded; the bar sits above the Skill Tracker. A Level with an
  unusually tall tracker (5+ gatherable Skills — none today) could crowd it.
- Touch users lose the explicit long-press inspect; they get the sticky preview on
  tap-hover instead.

Notes:
- **Done.** Sticky last-seen behaviour + Rare+ aura reuse `RARITY_COLOR` and the
  loot border/glow patterns for consistency.

---

## Stop auto-wiping progression on join

> **Priority: HIGH — shipped 2026-06-25**
> Impact: Every returning player session.

### Problem

`WIPE_PROGRESSION_ON_JOIN` reset skills, inventory, tools, quests, etc. on every
game load. Felt bad in play; the Settings **Force wipe save** button is enough
for testing.

### Resolution

- `WIPE_PROGRESSION_ON_JOIN` set to `false` — normal `loadPlayerSave()` path
  restores progress.
- Manual wipe remains in Settings via `wipeProgressionSave()`.
- `WelcomeNotice` progression-wipe copy only appears if the toggle is ever turned
  back on for a dev pass.

**Review**

Pros:
- Progress now matches player expectation and the v0.2.0 patch-note promise.
- Testing still has an explicit, intentional wipe control.

Cons / risks:
- Stale saves during rapid schema churn may need a schema bump instead of a
  join-time wipe — already handled by `SCHEMA_VERSION`.

Notes:
- **Done.** Do not re-enable join-time wipe without an explicit decision.

---

## Hide entity lock button (keep mechanic)

> **Priority: MEDIUM — UI removed 2026-06-25**
> Impact: Cleaner entity chrome; lock still works via Spacebar.

### Problem

The in-world lock toggle on entities adds clutter without being discoverable
enough to justify the UI cost.

### Direction

- Remove the Pixi lock button from `EntityView`.
- **Keep** sim commands (`entity.lock` / `entity.unlock`), cursor locked visual,
  and **Spacebar toggle** on the current target — the mechanic stays, just not
  on-entity chrome.
- Can restore a HUD affordance later if lock becomes a taught mechanic again.

**Review**

Pros:
- Less visual noise over every hovered entity.
- Spacebar path already exists for keyboard players.

Cons / risks:
- Mobile / touch-only players lose lock entirely until we add another affordance.
- Lock is still a core hover-damage mechanic — if we hide all UI, we should
  teach it elsewhere or accept hover-only passive damage.

Notes:
- **UI removed.** Sim + Spacebar unchanged. Revisit if touch lock is needed.

---

## Architecture hygiene — system-driven, decoupled code

> **Priority: HIGH (ongoing discipline)**
> Impact: Every future tweak; not player-facing until violations cause bugs.

### Intent

Code review pass to ensure we stay **system-driven** so content tweaks stay easy.
No inter-mingling: sim authority, shared content, client presentation, and
directors each stay in their lane.

### Action

Cursor rule added: [`.cursor/rules/architecture.mdc`](../.cursor/rules/architecture.mdc).
Agents and contributors should follow it on every change; flag violations during
review rather than letting "quick hacks" accumulate.

**Review**

Pros:
- Codifies what `AGENTS.md` already says into checkable habits.
- Prevents inspect/HUD logic leaking into sim, or presentation mutating state.

Cons / risks:
- Rules only help if we actually re-read them; pair with PR self-review.
- Over-strict layering can slow one-off prototypes — use creative docs / ADRs
  when intentionally bending a boundary.

Notes:
- This is **ongoing**, not a one-shot ticket. Schedule a focused audit if gross
  coupling shows up in a specific subsystem. The inspect → hover preview bar
  migration (ADR-0028, shipped v0.1.44) was a first such pass — it deleted the
  world-anchored Inspect popover and its anchor math while keeping the sim
  boundary untouched (commands in, events out; presentation projects only).
