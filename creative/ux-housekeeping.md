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
> Last reviewed: 2026-06-25 *(added the **Item Card** visual language from the loot mockup — shared component + token set, with a now-vs-deferred surface-adoption plan; grilled + locked the hover-rail interactivity model (passive + wheel + fade/peek) and the cursor-affordance DECISION-FIRST gate (glow-only, `locked > armed > interactable`); current build v0.1.47)*

---

## Active backlog

Live UX/polish items not yet shipped. (Shipped items are collapsed to pointers near
the bottom of this doc.)

### Item Card visual language (how an Item looks, everywhere)

> **Priority: HIGH — defines the look; adopt incrementally**
> Impact: Every surface that shows an Item — the loot reel, hover-preview drops,
> "new item" toasts, and later the Bag, Vendor, and Collection Book.

A reference mockup ([`mockups/item-card-loot.png`](mockups/item-card-loot.png), locked
2026-06-25) sets the visual language for **how an Item is presented anywhere it
appears**. Treat it as one shared component + token set — the **Item Card** — not
per-surface bespoke styling.

#### Tokens (the language)
- **Rarity gradient fill** keyed off `RARITY_COLOR` (light→deep diagonal). Rarity
  reads from the *fill*, not just a border.
- **Soft white rim + drop shadow** — the card reads as a raised, physical chip.
- **Icon-forward** — the item icon leads (left for wide cards, centred for grid
  slots), large, sitting directly on the gradient (no inner box).
- **Outlined display-font name** (white fill + dark stroke) with a small uppercase
  **rarity label** above it.
- **Quantity badge** (`×N`) large, white-outlined, **overhanging the top-right
  corner** — the signature flourish; built to absorb coalesced stacks.
- **Reduced motion:** any animated variant degrades to a static card.

#### Shape variants (same tokens, different footprint)
- **Loot tile** — wide capsule; the loot reel's hero/trail tiles (see design-ideas.md).
- **Compact chip** — hover-preview drop rail entries (icon + rarity + chance + `×N`).
- **Grid slot** — Bag / Collection / Vendor square cells (rarity-tinted slot + badge).

#### Single choke point
Build one `ItemCard` component (or a shared CSS token layer) so rarity colour, badge,
and font live in **one place**. Per [`architecture.mdc`](../.cursor/rules/architecture.mdc),
derived display must not be copy-pasted across JSX/Pixi — this is the choke point for
"what an Item looks like".

#### Surface adoption — now vs deferred

**Now (this initiative / current sprints):**
- **Loot reel** — canonical home of the language (design-ideas.md → loot reel).
- **Hover-preview drop rail** — chips adopt the gradient + badge (folds into the
  hover-rail pass below; the two were always meant to share a pattern).
- **"New item" discovery toast** (`CollectionFeedback`) — restyle the first-acquire
  toast into a hero Item Card. Cheap (same component) and a high-emotion moment.

**Deferred (future sprints — documented now, built later):**
- **Bag** grid — rarity-tinted slots + overhanging `×N` badge. Larger surface; its
  own polish pass once the component exists.
- **Vendor** sell list — items as Item Cards. Whole-scene restyle; defer to a Vendor
  visual pass.
- **Collection Book** full gradient fills — **careful**: registration juice +
  icon-first detail just shipped (v0.1.44). Adopt in a dedicated Collection visual
  pass so we don't fight recent work.
- **Idle session panel** grid — restyle to match. Low priority now that the reel runs
  in idle too.
- **World floating loot text / completion celebration** — optional rarity-colour echo
  on the Pixi `+N` text. Different medium (canvas), lowest priority.

**Review**

Pros:
- One component → consistent "an Item" look across the whole game; rarity becomes a
  glanceable, learned language rather than five bespoke treatments.
- The defer list keeps the first build small (reel + rail + toast) while guaranteeing
  later surfaces converge instead of drifting.
- Reuses `RARITY_COLOR` and the existing icon assets — pure presentation, no sim
  changes.

Cons / risks:
- A shared component must flex across capsule / chip / grid-slot footprints without
  becoming a config soup. Keep variants explicit, not a pile of boolean props.
- Heavy gradients + badges everywhere could over-saturate dense grids (Bag/Collection);
  tune intensity down for grid slots vs the hero loot tile.
- Touch/dense layouts: the overhanging badge must not clip neighbours in tight grids.

Notes:
- Build the component while building the loot reel; the reel proves the language, then
  the rail and toast adopt it in the same sprint.
- **ADR candidate (not yet):** once the language is proven on reel + rail, a short ADR
  ("Items render through one shared Item Card") may be worth it to lock the choke
  point — defer until it's real.

---

### Hover preview interaction pass — horizontal loot rail + cursor visibility

> **Priority: HIGH**
> Impact: Every active gather loop where the player hovers entities and checks
> drop details.

### Problem

The current hover preview can feel awkward to interact with:

- The drop chips stack/scale in a way that feels visually unstable.
- If the player moves from world hover to the preview details area, interaction
  feedback is unclear and the Cursor can feel "lost"/hidden.
- Dense drop lists need clearer navigation than a compressed, always-fit row.

### Direction

- Convert the drops strip into a **horizontal loot rail** inside the preview.
  Keep one row, allow overflow, and enable clear left/right drag-wheel-scroll.
- **Adopt the Item Card language** (above): each drop is a **compact chip** variant —
  rarity gradient + icon + chance + `×N` badge — so the hover rail and the loot reel
  speak the same visual language.
- Keep drop cards at a **stable size** while scrolling (avoid per-card scale jumps
  during normal hover traversal).
- Ensure the player's Cursor remains **visible and readable** over the preview so
  moving from world to HUD does not feel like crossing into a non-interactive
  dead zone.
- Keep the quick-glance behaviour: important stats stay visible even when the
  loot rail overflows.

### Decisions (locked 2026-06-25)

- **The bar stays passive** (`pointer-events: none`, sticky/last-seen). Most entities
  have only 2–5 drops; overflow is the exception, so we don't make the rail a
  click/drag target — that would reintroduce the world-hover flicker risk below.
- **Stable-size auto-fit + fade-edge + peek.** Chips keep a constant size; when the
  list overflows, fade the rail edges and peek the next chip so overflow is obvious.
- **Wheel-scroll via a global listener** while the preview is visible — gives manual
  navigation of dense lists without needing pointer-events on the bar.
- **Cursor continuity** is handled by the new glow affordance (above): ensure the
  cursor stays clearly painted over the bar region and glows over interactable chips,
  so world→HUD never feels like a dead zone. No separate cursor-continuity hack.

### Constraints / fit

- Must remain presentation-only (no sim/protocol changes).
- Must work with both world-hover and DOM-hover interactions without special-case
  rules per panel.
- Should respect reduced-motion preferences if any motion is retained in the rail.

**Review**

Pros:
- Directly targets a felt friction in the most-used loop (hover -> decide -> click).
- Horizontal rail is a familiar pattern for variable-length drop lists.
- Stable card sizing improves readability and perceived polish.
- Cursor visibility continuity should reduce "UI broke" moments when crossing
  world/HUD boundaries.

Cons / risks:
- Horizontal scrolling can hide information if no affordance (fade edges, peek,
  or wheel support) is provided.
- Over-correcting motion could make rare drops feel less special; keep rarity
  emphasis without layout jitter.
- Needs careful hitbox handling so world hover exit/entry does not flicker the
  panel state while interacting with the rail.

Notes:
- This is a follow-up pass on the shipped hover-preview system, not a rollback to
  the old inspect popover.
- If the rail works well here, reuse as a pattern for other overflowing icon rows.

---

### Cursor affordance state for interactable targets (DOM + world)

> **Priority: HIGH**
> Impact: Global interaction clarity across HUD controls and world entities.

### Problem

Because the game uses a custom Cursor everywhere, players lose a standard browser
signal ("pointer cursor") that something is clickable/pressable. This weakens
affordance in both DOM UI and world interactions.

### Direction

Add an explicit **interactable Cursor state** whenever the current hover target
accepts an action:

- Applies to both **DOM controls** (buttons, rows, tabs, clickable cards) and
  **world targets** (entities, interactables, hover-preview chips).
- Uses a subtle but unmistakable visual cue that reads as "you can act here" without
  becoming noisy.
- Keeps existing semantic Cursor states (tool/armed/locked, etc.) and layers
  affordance predictably rather than replacing them.

### Decisions (locked 2026-06-25)

- **Visual language: glow-only.** A soft ring/halo around the cursor tip when the
  hover target is interactable — **no scale/pop** (avoids clashing with rarity juice
  and the existing tool/lock rings; calmest cross-surface signal). Tune intensity up
  only if playtests still miss interactables.
- **Precedence: `locked > armed > interactable`.** Committed/semantic states always
  beat the generic affordance hint — the glow is suppressed while locked or armed, so
  there's no flicker or stacked rings to debug.
- Applies on both **DOM controls** (buttons, rows, tabs, clickable cards) and
  **world targets** (entities, interactables, hover-preview chips), driven from the
  same hover handlers.

**Review**

Pros:
- Restores missing interaction feedback players expect from web UI conventions.
- Improves discoverability of clickable controls without extra tutorial text.
- One cross-surface rule (DOM + world) reduces UX inconsistency.
- Presentation-layer change with high perceived quality impact.

Cons / risks:
- Too much glow/scale could look busy given existing rarity effects and HUD juice.
- State-priority conflicts can produce flicker unless transition rules are explicit.
- Requires coverage auditing so all interactables opt into the same signal.

Notes:
- Treat this as a cursor-system polish pass, not a one-off fix for a single panel.
- Start subtle and tune upward only if playtests still miss interactables.

---

---

## Shipped — archived (pointers only)

These were full write-ups; the authoritative record now lives in the ADR / patch
notes. Kept as one-liners so the active backlog above stays the live list.

- **Collection Book registration juice + icon-first detail** — rarity-tiered slot
  slam/flash, Rare+ panel shake; client-side diff of `collection.registered`, no
  sim change. Shipped v0.1.44.
- **Bottom-right hover preview bar (replaces right-click Inspect)** — sticky
  `HoverPreviewBar` showing name/HP/reqs/XP/respawn/drops + drop %; old
  Inspect gesture + `InspectPanel` deleted. Shipped v0.1.44 — see **ADR-0028**.
  *(Deferred follow-up: smaller top-left profile card — still a standalone task.)*
- **HUD UI scale slider (Settings)** — accessibility/readability slider scaling the
  DOM HUD only (75%–175%, Reset), persisted via `uiScale` in the HUD store;
  composes with `stage.scale` via `--hud-scale`. Shipped (`SettingsMenu.tsx`).
- **Stop auto-wiping progression on join** — `WIPE_PROGRESSION_ON_JOIN = false`;
  normal `loadPlayerSave()` restores progress; manual wipe stays in Settings.
  Shipped v0.1.42. Do not re-enable without an explicit decision.
- **Hide entity lock button (keep mechanic)** — removed the in-world Pixi lock
  toggle; sim `entity.lock`/`unlock` + Spacebar toggle + locked cursor visual
  unchanged. Shipped v0.1.42. Revisit if touch lock is needed.

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
