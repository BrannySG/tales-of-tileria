# UI Frame Lab — research spike findings

A throwaway-grade exploration of a textured, RuneScape-style inventory panel for
the wider UI overhaul. Goal: find out how capable we are of building reusable,
modular textured UI frames, and whether the GenAI image pipeline can produce
usable frame art.

Open it in dev at **`#/ui-lab`** (dev-only route). It renders the target
inventory mockup twice from one renderer, skinned two ways, side by side.

## TL;DR verdict

**GenAI frames are viable — and were the better-looking of the two.** A single
`gpt-image-2` pass produced a warm wooden panel with iron corner brackets and a
recessed interior that 9-slices cleanly with CSS `border-image` and holds up at
every size with no seams or broken corners. It closely matches the mockup.

Recommendation: **formalise a `ui-frame` Sprite Pipeline preset** (spec below) as
a sprint item, and adopt the `Frame` 9-slice primitive as the basis of the UI
overhaul.

| Result @360px | Result @460px |
|---|---|
| ![360](./lab-360.png) | ![460](./lab-460.png) |

Left = Synty mask tinted via `mask-border`. Right = GenAI `border-image` 9-slice.

## What was built

- `apps/client/src/ui/lab/Frame.tsx` — the reusable 9-slice primitive. One
  component, two modes:
  - `border-image` — the PNG bakes its own colour/texture (the GenAI frame).
  - `mask-border` — a white silhouette mask recoloured with a CSS gradient (the
    Synty HUD sprites ship as white masks; this tints them to our palette).
  - Art is painted on absolutely-positioned layers *behind* the content, so
    masking never clips slots/tabs/labels.
- `apps/client/src/ui/lab/skins.ts` — `PanelSkin` data (frame spec + tokens).
  Swapping the whole look is pure data — the modularity proof.
- `apps/client/src/ui/lab/LabPanel.tsx` — the interactive multi-tab previewer
  host (frame + detached tab bar + per-tab body switch). _(Iteration 5 split the
  original single `InventoryMock.tsx` into this host + per-tab body components;
  the Bag body keeps the original slot grid + gold/weight footer.)_
- `apps/client/src/modes/UiLabMode.tsx` + `#/ui-lab` route in `App.tsx`.
- `tools/spritegen/scripts/gen-ui-frame.mjs` — ad-hoc frame generator (NOT the
  formal pipeline; see below).
- `tools/spritegen/scripts/key-frame.mjs` — flood-fill background knockout.

## GenAI generation notes (how the frame was made)

The existing Sprite Pipeline can't make frames as-is: its post-processing trims
and re-centres an isolated subject and mattes the background, and the style bible
explicitly forbids borders/frames. So this spike bypassed it:

1. `gpt-image-2` `images.edit`, anchored to our own painterly wood references
   (`T_Item_WoodLogs`, `T_Item_OakWood`, `T_Entity_WoodShack_Built`).
2. Prompt asked for a **full-bleed** panel (wood border edge-to-edge + dark
   recessed interior), since gpt-image-2 can't emit transparency. `n=3`,
   1024×1024, opaque, high quality. All three candidates were usable;
   `frame_1` was chosen (`genai-frame-raw.png`).
3. Background knockout: gpt-image paints on a dark background, and a naive
   luminance key also eats the dark interior + inner-shadow groove. Solution:
   **flood-fill from the image edges** at a per-channel threshold of 40, so only
   the background-connected dark region clears and the enclosed interior is
   always preserved (`genai-frame-keyed.png`).
4. The transparent inner groove the key leaves behind is **harmless**: the frame
   is used as a `border-image` border (no `fill`) over a CSS-painted dark
   interior `body`, so the body shows through the groove seamlessly.

## Rendering technique: CSS 9-slice (`border-image` / `mask-border`)

- `border-image-slice: <inset> fill` + `border-image-width` is all it takes;
  wrapped in `<Frame>` so callers never touch raw `border-image`.
- DOM-native, GPU-cheap, no extra runtime — fits the existing React + global
  `styles.css` architecture (no new dependency).
- Corner brackets sit in the slice corners (fixed), wood edges stretch. Slot
  bevels and the active-tab glow are pure CSS (`inset box-shadow`,
  `color-mix`).

## Synty vs GenAI

| | Synty (`mask-border` tint) | GenAI (`border-image`) |
|---|---|---|
| Look vs mockup | Clean tinted wooden octagon; flatter, no brackets/grain | Carved wood + iron brackets + grain; matches mockup |
| Source | Pre-made white mask, instant, zero spend | One image-model pass (~seconds, small cost) |
| File size | ~14 KB | ~1.7 MB raw PNG (needs optimisation — see below) |
| Recolour | Trivial (change the gradient) | Re-generate or hand-edit |
| Risk | None | Background knockout + slice tuning needed |

Both are legitimate. Synty is the fast, recolourable path; GenAI gives the
characterful, on-brand look. They can coexist — same `Frame` primitive.

## Proposed `ui-frame` Sprite Pipeline preset (formalisation sprint)

If we adopt this, turn the ad-hoc scripts into a real preset:

1. **New preset `ui-frame`** in `tools/spritegen/src/presets/` with a frame-
   specific prompt (full-bleed, uniform border, recessed interior, transparent-
   outside intent) and wood/UI references.
2. **Post-processing branch**: skip the trim/recentre/matte path; instead run the
   edge flood-fill knockout (port `key-frame.mjs`) and **leave the frame at full
   canvas** (no margin reframing).
3. **Relaxed QA**: the 3–85% fill check assumes a compact subject; a frame is
   mostly border + interior. Add a frame-aware check (border present on all four
   sides, interior enclosed, corners transparent).
4. **Asset routing**: add a `T_UI_` prefix → `AvailableAssets/UI/` mapping in
   `assetPaths.ts`, and (optionally) auto-wire into the manifest.
5. **Optimise output**: 1.7 MB is too heavy for UI. Quantise/compress the PNG
   (palette PNG or downscale the master to ~512), or emit a slimmer 9-slice
   atlas. Target < 100 KB per frame.
6. **Slice metadata**: emit the recommended `border-image-slice` inset alongside
   the PNG so `Frame` specs aren't hand-measured.

## Other notes / improvements for later

- **Promote `Frame` to a real primitive** (out of `ui/lab/`) and migrate the
  actual `Bag` + modals to it during the overhaul. Consider an ADR for the UI
  frame system + a `CONTEXT.md` term (e.g. "Frame"/"Panel skin") at that point.
- **Token-drive the whole HUD**: skins here are local; the overhaul should hang
  panel skins off the existing `:root` CSS variables so one switch reskins
  everything.
- **`mask-border` browser support** is Chromium-prefixed (`-webkit-mask-box-image`)
  + the standard `mask-border`; fine for our target, but note it for Firefox.
- **Generate a matching slot + tab sprite** via the same preset so slots aren't
  pure CSS bevels — would close the last gap to the mockup.
- **Decorative overlays** (Synty `Tracery_*`, emblems) can be layered as absolute
  corner pieces on top of `Frame` for flourish without touching the 9-slice.

## Tab redesign — folder-on-border (follow-up)

The first mockup's tabs reused the slot's recess look (`--tab-slot` bg +
inset shadow), so they read as part of the grid rather than the hosting panel.
Reworked them in the lab as **folder-style tabs mounted on the frame's wooden top
border**. `#/ui-lab` now compares the old embedded row (left, `tabVariant="baseline"`)
against the new folder strip (right, `tabVariant="folder"`), with width (320 / 400
/ 520) and **Touch / PC density** toggles to stress ergonomics without a device.

What landed:

- **`Frame.topChrome`** — an optional node rendered in normal flow at the top of
  the content, lifted up by ~`border − 12px` so it paints *on* the top rail while
  a sliver of the frame's top ornament still shows above it (reads as mounted on
  the border, not replacing it). The grid/footer flow naturally beneath; existing
  skins are unaffected (default `undefined`).
- **`TabStrip.tsx`** — equal-width folder tabs in the frame's wood palette
  (raised faces: top sheen + cast shadow). Active tab is **gold-lit, taller,
  shows icon + stacked label, and drops a seam into the interior**; inactive tabs
  are **icon-only** with the label as a hover/focus tooltip (pointer-fine only).
  `role="tablist"`/`tab`, `aria-selected`, roving `tabindex`, and arrow / Home /
  End key nav.
- **Tokens** — `tabFace` / `tabFaceActive` / `tabEdge` / `tabSeam` added to
  `PanelSkin.tokens` (optional; `TabStrip` derives sensible defaults if absent),
  so the tab look re-skins with the panel.
- **Ergonomics** — ≥48px hit targets with ~8px visible gaps; **touch density
  grows the tabs** (56 / active 68) rather than shrinking them, **PC tightens**
  (44 / active 56) and reveals inactive labels on hover. One responsive component,
  no platform fork — touch baseline + PC enhancement via
  `@media (hover:hover) and (pointer:fine)` (the lab's `.is-touch`/`.is-pc`
  classes simulate the pointer media for previewing).

First pass mounted the tabs *on* the wooden top border. It read as host chrome
but still felt like part of the same panel.

### Iteration 2 — detached bar + vector icons

Reworked again so the tabs are a **separate bar that sits on top of the panel and
overlaps its top edge only slightly** (linked, not embedded): the strip is inset
from the frame corners, uses a darker material than the wood frame, and casts a
drop shadow onto it. Freeing the interior of tab chrome let the grid **reclaim a
row (now 4×4)**.

- Swapped the hand-drawn line SVGs for **clean colored vector icons** (Synty-style
  flat art from `AvailableAssets/Examples/VectorIcons`, copied to
  `AvailableAssets/UI/icons/`): Backpack / Sword / Stats / Compass / Gear.
- Active tab **grows upward** (bottom stays anchored on the panel so it keeps the
  link), lights to warm parchment with a gold rim, and reveals its label; inactive
  tabs are icon-only and slightly dimmed.
- `Frame.topChrome` (added in iteration 1) is retained as a reusable hook but the
  mock no longer uses it — the detached bar is a sibling above the `Frame`,
  z-ordered above it with a small negative margin for the overlap.

The detached bar worked, but a first dark-flat treatment clashed with the ornate
wooden frame (two art languages touching).

### Iteration 3 — material study → wood

Compared three tab materials in the lab side by side (`TabStrip material` prop:
`iron` / `wood` / `flat`):

- **Iron** — brushed-steel plates with rivets; cohesive *through contrast* (metal
  fittings on a wooden chest) and the icons popped best.
- **Wood** — carved faces in the frame's own timber; most unified.
- **Flat** — the original dark slab; clearly the weakest once compared.

Picked **wood**, then harmonised it so the bar reads as the *same timber* as the
frame rather than a bolted-on UI kit:

- Warmed the inactive tab faces to the frame's wood tone (was a darker, flatter
  brown that clashed).
- Active tab is now **lit golden timber** (gold rim + label) instead of a cream
  parchment chip — it pops as selected while staying in the wood family.
- Shifted the bar **up** slightly so it sits on top of the panel, and the active
  tab drops a short connector onto the body so it visibly owns the grid.
- Lab converged to a **before/after** (embedded slot tabs vs the detached wood
  bar with the 4×4 grid). `iron`/`flat` remain selectable in `TabStrip` for future
  reuse but are no longer the default.

### Iteration 4 — grain match (grayscale, tintable)

Tone alone still left a smooth-vs-carved texture gap. Closed it with a single
**grayscale, seamless wood-grain tile** generated procedurally
(`tools/spritegen/scripts/gen-wood-grain.mjs` → `AvailableAssets/UI/T_UI_WoodGrain.png`,
SVG `feTurbulence` with `stitchTiles`, sharp-quantised). It's blended over each
tab face with `background-blend-mode: soft-light`, so the **gradient supplies the
tint** and the one texture serves every state — dark inactive tabs, the lit golden
active tab, and its connector all share the same fibre. Tintable + one asset, as
intended. Subtle by design (low-contrast tile; strength tuned at the use-site).

Verdict: the bar reads as its own element seated on the panel, the wood matches
the frame in both tone *and* grain (no more clash), the colored icons are far more
legible/characterful, and the extra slot row is a free win. Still lab-only —
promote `Frame`/`TabStrip` out of `ui/lab/` and wire to real state during the
overhaul. The grain tile + `soft-light` tint trick should carry over.

## Tab previewer + per-tab content (iteration 5)

The lab graduated from "one inventory mockup, two skins side by side" into an
**interactive previewer for all five panel sections**. The detached `TabStrip`
now drives a single framed panel's body: click **Bag / Equipment / Skills /
Collections / Settings** and the content swaps. Width + Touch/PC density toggles
remain; a **Notifications** toggle group flips the mock red-dot state.

Still lab-only (mock data, no sim/store wiring), but each piece is a clean,
promotable component:

- **`LabPanel.tsx`** — the host: owns `activeTab`, renders the active body, feeds
  tab-level dots from the mock notification model.
- **`TabStrip.tsx`** — now *controlled* (`activeId` + `onSelect`, falls back to
  internal state) and renders a `NotificationDot` per tab. `travel` → `collections`
  (kept the compass icon for now).
- **`NotificationDot.tsx`** — the single reusable red-dot/badge primitive (plain
  dot, or numbered when a count > 1). Used by tabs, skill rows, region rows, and
  new bag slots so the "something's new/actionable" signal reads identically
  everywhere.
- **`mockData.ts`** — static mock skills/inventory/equipment/regions + the
  toggleable `LabNotifications` model and dot-derivation helpers. Shaped to mirror
  the eventual store selectors.
- **Tab bodies (`tabs/*.tsx`)**:
  - **BagTab** — the original slot grid + gold/weight footer; a new drop shows a
    slot dot while the Bag notification is on.
  - **EquipmentTab** *(taking the lead; will iterate)* — labeled equip slots
    (Sword/Axe/Pickaxe + locked future-gear slots, sketching a paper-doll) over a
    small inventory grid.
  - **SkillsTab** — `SkillList` with a **vertical** view (icon + name + level + XP
    bar, default) and a **RuneScape-style grid** (icon + level only); a row dot
    shows when a Skill has unspent points (numbered) or an unseen level-up. Tapping
    a Skill opens the real **`SkillTreeModal`** (fullscreen, same as the live HUD).
  - **CollectionsTab** — a World-Map-style vertical region list with completion %.
    One region today (**The Clearing**); tapping it opens the real
    **`CollectionBookModal`**.
  - **SettingsTab** — a static mirror of the real `SettingsMenu` (Audio / Display /
    Save) rows.

### Notes carried forward (for promotion / future content)

- **`NotificationDot`** earns a `CONTEXT.md` glossary term ("Notification Dot")
  when promoted out of `ui/lab/`.
- **Per-region Collections** is currently faked: real Collections are
  *skill-scoped* (`collections.ts` tags each by `skill`, not region) and there's
  only one Level. True per-region grouping needs a region/`Level` tag on
  `CollectionDefinition` — a content-model change for when there's >1 Level.
- Promote `Frame` / `TabStrip` / `NotificationDot` / `SkillList` out of `ui/lab/`
  and wire to `useHud` during the overhaul.
- **Iteration 5 follow-up:** removed the active-tab `::after` connector (the small
  tab "tongue" into the panel read as a stray chip); Clicker uses the handdrawn
  cursor icon; skill/collection rows open the real fullscreen modals in-lab.

_This folder is research scratch: `genai-frame-raw.png` (model output),
`genai-frame-keyed.png` (background knocked out), and the lab screenshots._
