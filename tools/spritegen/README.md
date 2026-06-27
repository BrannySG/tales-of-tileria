# @tot/spritegen

A local, agent-callable CLI that turns a prompt into a game-ready, on-style sprite.
It generates with OpenAI's `gpt-image-2` anchored to curated reference sprites,
post-processes the result, runs QA, and reports a structured result.

The engine is **theme-agnostic** (ADR-0031). A generation is
`Preset (what kind) × Style Pack (what look) → engine → output`:

- **Preset** = element TYPE. It owns a composition prompt, a `process()` strategy,
  a `qa()` strategy, and (for frames) a geometry contract. Shipped presets:
  - `item-icon` — small item art (128 + 256), wired via an Item's `worldTextureId`.
  - `entity` — world entities (256), scaffolded as an `EntityDefinition`.
  - `cursor` — cursor skins (256), wired like an item.
  - `ui-frame` — a 9-sliceable UI panel frame (512), emits CSS slice metadata + a
    `<Frame>` spec.
- **Style Pack** = visual identity (`src/styles/<id>/`): the style-core prompt text
  (`style.md`), the palette, and reference sprites keyed per preset. `tileria` is
  the default; select another with `--style`. To re-theme or reuse the tool in
  another project, add a sibling pack folder — the engine/presets don't change.

Two processing strategies ship: `subject` (matte + trim/reframe a centred subject)
and `frame` (flood-key the background, keep the full canvas, downscale + quantize).

## Setup

```bash
pnpm install
cp tools/spritegen/.env.example tools/spritegen/.env   # then add your OPENAI_API_KEY
```

## Usage

From the repo root:

```bash
# Item icon
pnpm --filter @tot/spritegen gen generate \
  --preset item-icon \
  --subject "a steel longsword with a leather-wrapped grip" \
  --id sword_steel \
  --n 3 --vision-qa --json

# World entity (defaults to 256; --wire scaffolds the EntityDefinition)
pnpm --filter @tot/spritegen gen generate \
  --preset entity \
  --subject "a mossy crystal-studded boulder" \
  --id crystal_node \
  --display-name "Crystal Node" --kind resource --tags rock,mineable \
  --n 3 --wire --json

# UI frame (defaults to 512; --wire adds the manifest entry + prints a <Frame> spec)
pnpm --filter @tot/spritegen gen generate \
  --preset ui-frame \
  --subject "ornate wooden inventory panel frame" \
  --id wood_panel \
  --n 2 --wire --json
```

Common flags:

- `--style <id>` — Style Pack / visual identity (default `tileria`).
- `--n <count>` — candidates per attempt; agents use best-of-N, manual runs use 1.
- `--sizes <list>` — override the per-preset default sizes.
- `--vision-qa` — adds a vision-model critique on top of the free programmatic checks.
- `--wire` — applies wiring (see below). Off by default.
- `--json` — structured output for agents (final paths, chosen candidate, QA
  verdict, wiring snippet, slice metadata for frames, reject paths).
- `--display-name` / `--kind` / `--tags` — entity preset only; shape the scaffolded
  `EntityDefinition` (default kind `prop`).

## Run it via a subagent

Generation blocks for ~1-3 min. Agents should run it in a background subagent
(Task tool, `subagent_type: shell`, `run_in_background: true`) so the main thread
stays free, then act on the reported JSON. See `.cursor/rules/sprite-generation.mdc`.

## What it produces

- `AvailableAssets/<Category>/T_<...>.png` — the primary game-ready sprite (largest size),
  plus `_<size>` suffixed PNGs for any other requested sizes.
- `ui-frame` only: a `T_UI_<Name>.frame.json` sidecar next to the PNG with the
  contract-driven CSS 9-slice metadata (`{ src, mode, slice, border, repeat }`),
  also echoed in `--json` as `sliceMeta`.
- `tools/spritegen/out/masters/*_master.png` — the hi-res (1024) transparent
  master, kept so future sizes need no new generation.
- `tools/spritegen/out/rejects/*.png` — candidates that lost best-of-N or failed QA.

## Wiring a sprite into the game

The result's `wiring` block prints the exact lines. `--wire` applies them:

- Items: `--wire` adds the `manifest.ts` import + `TEXTURE_MANIFEST` key. The
  `worldTextureId` field is left as a manual paste because it targets a specific
  (hand-ordered) `ItemDefinition` in `packages/shared/src/content/items.ts`.
- Entities: `--wire` adds the manifest entry AND scaffolds a minimal
  `EntityDefinition` into `packages/shared/src/content/entities.ts` (appended to
  `ENTITY_DEFINITIONS`, so it appears in both the Level and Entity editors). The
  skeleton is intentionally minimal — refine its gameplay fields afterward.
- UI frames: `--wire` adds the manifest entry; the content side prints a `<Frame>`
  spec (built from the slice metadata) to paste where you use the frame. It is not
  auto-applied (there is no single canonical target like `items.ts`).

## Adding a preset or a Style Pack

- **New element type** → add a `Preset` in `src/presets/` and register it in
  `src/presets/index.ts`. Give it a `process`/`qa` strategy (reuse `subject` or
  `frame` from `src/core/processors` + `src/core/qa`, or add a new one) and, for a
  frame, a `geometry` contract. The preset is theme-agnostic — it carries no
  references and its `buildPrompt(subject, styleCore)` receives the pack's style core.
- **New look / project** → add `src/styles/<id>/style.md` + `pack.ts`
  (`references` keyed per preset id, plus `defaultReferences` + an optional
  `palette`) and register it in `src/styles/index.ts`. Select it with `--style <id>`.
  References resolve against `AvailableAssets/` (sorted into `Areas/`, `Cursors/`,
  `Entities/`, `FX/`, `Items/`, `UI/`, `Fonts/`).
