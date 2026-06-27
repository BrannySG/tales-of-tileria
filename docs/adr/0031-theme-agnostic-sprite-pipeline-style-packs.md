# ADR 0031 — Theme-agnostic Sprite Pipeline: Style Packs + pluggable strategies

- Status: Accepted
- Date: 2026-06-26

## Context

A research spike (`creative/ui-frame-lab/`) proved we can generate RuneScape-style
textured UI frames with the image model and render them as CSS 9-slice frames. We
decided to formalize UI-frame generation as a first-class capability. But the
existing `tools/spritegen` engine had grown around a single assumption — *isolated
subject sprites for Tales of Tileria* — and that assumption was baked in three
places at once:

1. **Style was hardcoded into the engine.** Every `Preset` read one global
   `style-bible.md` and carried its own `referencePaths` (absolute paths into this
   repo's `AvailableAssets/`). There was no seam to swap the look or reuse the tool
   in another project.
2. **Processing + QA were a single fixed path.** `generate.ts` always ran the same
   matte (`@imgly` background removal) → trim/reframe → fill-ratio QA. A UI frame
   needs the *opposite* treatment: keep the full square, knock out only the
   background-connected corners, and judge it as a frame (border on all sides,
   enclosed interior), not as a centred subject. The style-core text even forbade
   "border, frame, or UI" outright.
3. **Output wiring assumed Item/Entity.** `assetPaths.ts` had no `T_UI_` route and
   `wire.ts` only knew how to scaffold an Item `worldTextureId` or an
   `EntityDefinition` — not a UI frame's `<Frame>` spec.

We wanted UI frames *and* a pipeline that could be re-themed or lifted into another
project, without forking the engine.

## Decision

**Split the Sprite Pipeline into a theme-agnostic engine, swappable Style Packs,
and pluggable per-Preset processing/QA strategies. Add a `ui-frame` Preset that
produces consistent, optimized, 9-sliceable frames with contract-driven slice
metadata.**

A generation is now `Preset (what kind) × Style Pack (what look) → engine →
output adapter (where)`.

- **Preset = element TYPE, theme-agnostic.** A `Preset` lost its `referencePaths`
  and its `buildPrompt` now takes the style-core text as an argument. It gained two
  strategy hooks — `process(raw, ctx)` and `qa(processed, ctx)` — and an optional
  `geometry` contract. The shipped subject presets (`item-icon`, `entity`,
  `cursor`) all point at a shared `subject` processor (imgly matte + trim/reframe)
  and `subject` QA (dimensions/alpha/fill-ratio + optional vision), so their output
  is unchanged.
- **Style Pack = visual identity.** `StylePack { id, styleCore, references[presetId],
  defaultReferences?, palette? }` owns the style-core prompt text (moved to
  `styles/<id>/style.md`), the reference Sprites keyed per Preset, and the palette.
  `getStylePack(id)` defaults to `tileria`; a new `--style` CLI flag selects others.
  Reusing the tool elsewhere is "add a sibling pack folder," not "fork the engine."
- **Pluggable strategies.** `generate.ts` stays a thin orchestrator: it resolves the
  pack + per-Preset references, builds the prompt, then calls `preset.process()` and
  `preset.qa()`. The subject behaviour is one strategy pair; the new **frame**
  strategy is another (flood-key knockout ported from the spike's `key-frame.mjs`
  into `core/floodKey.ts`; keep the full canvas; downscale to ~512 and
  palette-quantize/compress — frames land at ~40–50 KB vs the spike's 1.7 MB). Frame
  QA is frame-aware: opaque border on all four sides (sampled inset, past any rounded
  outer margin), an enclosed opaque interior, and corners the key actually cut.
- **`ui-frame` Preset + geometry contract.** `assetPrefix 'T_UI_'`,
  `textureIdPrefix 'ui_'`, `wiringKind 'ui'`, full-bleed wooden-panel prompt that
  *overrides* the subject output rules and enforces a uniform border at a known
  canvas fraction. That same `borderFraction` drives the emitted **slice metadata**
  — a `{ src, mode, slice, border, repeat }` sidecar JSON (and `--json` field) — so
  the client `<Frame>` spec is *generated, not hand-measured*.
- **UI output adapter.** `assetPaths.ts` routes `T_UI_` → `AvailableAssets/UI`; the
  `ui` `wiringKind` applies the manifest import/key (verified end-to-end with
  `--wire`) and prints a ready-to-paste `<Frame>` spec built from the geometry
  contract.

### Rejected alternatives

- **Extract spritegen to a standalone published package.** The portability win we
  need is *style swappability*, which Style Packs give us in-repo. A separate
  package adds versioning/release overhead with no benefit while the tool is
  local-only and pre-1.0. (Left as a future option; the Style Pack seam is the
  thing that makes it cheap later.)
- **A `mode: 'subject' | 'frame'` enum on the Preset (branch inside the engine).**
  Re-centralizes the if/else the refactor set out to remove and makes adding a third
  kind (`ui-slot`, `ui-bar`, `fx`) a core-engine edit. Function-valued `process`/`qa`
  strategies keep the engine closed for modification, open for extension.
- **Auto-detecting slice insets from the rendered image** (e.g. measuring the border
  thickness post-hoc). Brittle against decorative corners and texture noise. A
  *prompt-enforced* geometry contract is deterministic: one constant drives both the
  generation instruction and the emitted slice metadata.
- **Tinting the Synty FantasyHUD masks as the canonical frame source.** Viable (the
  lab keeps it as the `mask-border` comparison), but it ties our look to a third-party
  asset pack and one corner style. GenAI frames anchored to a locked canon reference
  set give us our own, extensible look — and exercise the very pipeline this ADR
  formalizes.

## Consequences

- The engine is now reusable: a new project (or a re-themed Tileria) adds a Style
  Pack and selects it with `--style`; Presets, processing, QA, and wiring are
  shared. The look is data, not code.
- Adding a new element TYPE is additive — a Preset that names a `process`/`qa`
  strategy pair (reuse `subject`/`frame` or add a new one) and, for frames, a
  geometry contract. `ui-slot` / `ui-button` / `ui-bar` and `fx` slot in without
  touching the orchestrator.
- Subject output (`item-icon` / `entity` / `cursor`) is unchanged: the same prompt
  text (style core moved verbatim to `styles/tileria/style.md`), the same reference
  Sprites, and the same matte+trim+fill-QA, now reached through the `subject`
  strategy pair.
- UI frames are a first-class, optimized, 9-sliceable asset with machine-emitted
  slice metadata; the dev `#/ui-lab` renders a pipeline frame straight from that
  sidecar, closing the generate → asset → spec → render loop.
- **Given up / deferred (designed-for):** additional UI presets (`ui-slot`,
  `ui-button`, `ui-bar`); promoting `<Frame>` out of `ui/lab/` and migrating the
  real `Bag`/modals (part of the wider UI overhaul, not this pipeline work);
  extracting spritegen to a standalone published package. Frame-tuned **vision** QA
  exists but is opt-in (`--vision-qa`); the default frame gate is the deterministic
  programmatic check.
