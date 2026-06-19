import entityArt from '../../content/entity-art.json';

/**
 * Editable, global visual-transform overrides for an Entity definition, keyed by
 * definition id (see CONTEXT.md: Entity Editor). Only the visual transform lives
 * here; behavior/loot stay in the typed TS definitions.
 */
export interface ArtOverride {
  scale?: number;
  rotation?: number;
  anchorX?: number;
  anchorY?: number;
}

/**
 * The authored art overlay bundled into the shipped build. The Entity Editor
 * writes `packages/shared/content/entity-art.json` via dev middleware; bundling it
 * means the production client renders entities with their authored transforms
 * without needing the dev server (mirrors the bundled Levels, see ADR-0016).
 */
export function getBundledEntityArt(): Record<string, ArtOverride> {
  return entityArt as Record<string, ArtOverride>;
}
