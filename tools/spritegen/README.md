# @tot/spritegen

A local, agent-callable CLI that turns a prompt into a game-ready, transparent,
on-style sprite for Tales of Tileria. It generates with OpenAI's `gpt-image-2`
anchored to curated reference sprites, removes the background locally, frames and
downscales the result, runs QA, and reports a structured result.

It ships two presets:

- `item-icon` - small item art (defaults to 128 + 256), wired via an Item's `worldTextureId`.
- `entity` - world entities (defaults to 256), scaffolded as an `EntityDefinition`.

All presets embed one shared style core (`src/style-bible.md`) so the look stays
consistent; each preset adds only its own composition rules.

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
```

Common flags:

- `--n <count>` — candidates per attempt; agents use best-of-N, manual runs use 1.
- `--sizes <list>` — override the per-preset default sizes.
- `--vision-qa` — adds a vision-model critique on top of the free programmatic checks.
- `--wire` — applies wiring (see below). Off by default.
- `--json` — structured output for agents (final paths, chosen candidate, QA
  verdict, wiring snippet, reject paths).
- `--display-name` / `--kind` / `--tags` — entity preset only; shape the scaffolded
  `EntityDefinition` (default kind `prop`).

## Run it via a subagent

Generation blocks for ~1-3 min. Agents should run it in a background subagent
(Task tool, `subagent_type: shell`, `run_in_background: true`) so the main thread
stays free, then act on the reported JSON. See `.cursor/rules/sprite-generation.mdc`.

## What it produces

- `AvailableAssets/T_<...>.png` — the primary game-ready sprite (largest size),
  plus `_<size>` suffixed PNGs for any other requested sizes.
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

## Presets

`item-icon` and `entity` ship today. Add an `fx` preset in `src/presets/` and
register it in `src/presets/index.ts`; each pairs composition rules (on top of the
shared `src/style-bible.md` core) with a small set of reference sprites from
`AvailableAssets/`.
