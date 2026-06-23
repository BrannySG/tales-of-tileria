import { readFile, writeFile } from 'node:fs/promises';
import { ENTITIES_PATH, MANIFEST_PATH } from '../config.ts';
import type { EntityMeta, Preset, WiringSnippet } from '../types.ts';
import { toCamelCase, toPascalCase, toSnakeCase, toTitleCase } from './naming.ts';

/** Builds the starter EntityDefinition source for a generated entity sprite. */
function entitySkeleton(
  camel: string,
  snake: string,
  textureId: string,
  meta: EntityMeta,
): string {
  const displayName = meta.displayName ?? toTitleCase(snake);
  const kind = meta.kind ?? 'prop';
  const tags = (meta.tags ?? []).map((t) => `'${t}'`).join(', ');
  return [
    `export const ${camel}: EntityDefinition = {`,
    `  id: '${snake}',`,
    `  displayName: '${displayName}',`,
    `  kind: '${kind}',`,
    `  art: {`,
    `    textureId: '${textureId}',`,
    `    scale: 1,`,
    `    anchorX: 0.5,`,
    `    anchorY: 0.9,`,
    `  },`,
    `  interactionRule: 'personal',`,
    `  tags: [${tags}],`,
    `};`,
  ].join('\n');
}

/**
 * Builds the exact lines needed to register a sprite in the game. The asset is
 * referenced by its primary (unsuffixed) filename, e.g. `T_Item_SwordSteel.png`.
 * The content snippet depends on the preset: an Item gets a `worldTextureId`
 * field; an Entity gets a starter EntityDefinition.
 */
export function buildWiring(preset: Preset, id: string, meta: EntityMeta = {}): WiringSnippet {
  const pascal = toPascalCase(id);
  const camel = toCamelCase(id);
  const snake = toSnakeCase(id);
  const textureId = `${preset.textureIdPrefix}${snake}`;
  const fileName = `${preset.assetPrefix}${pascal}.png`;

  const isEntity = preset.wiringKind === 'entity';
  const contentSnippet = isEntity
    ? entitySkeleton(camel, snake, textureId, meta)
    : `worldTextureId: '${textureId}',`;
  const contentTarget = isEntity
    ? 'entities.ts (refine gameplay fields, then it appears in both editors)'
    : 'items.ts (add to the matching ItemDefinition)';

  return {
    textureId,
    import: `import ${camel} from '@assets/${fileName}';`,
    manifestKey: `  ${textureId}: ${camel},`,
    contentSnippet,
    contentTarget,
    manifestApplied: false,
    contentApplied: false,
  };
}

/**
 * Inserts the texture import after the last existing import and the manifest key
 * just before the `TEXTURE_MANIFEST` close brace. Idempotent: a no-op if present.
 */
export async function applyManifest(
  snippet: WiringSnippet,
  manifestPath: string = MANIFEST_PATH,
): Promise<boolean> {
  const source = await readFile(manifestPath, 'utf8');
  if (source.includes(snippet.import) && source.includes(snippet.manifestKey.trim())) {
    return false;
  }

  const lines = source.split('\n');

  const lastImport = lines.reduce((idx, line, i) => (line.startsWith('import ') ? i : idx), -1);
  if (lastImport === -1) throw new Error('Could not find an import block in manifest.ts.');
  lines.splice(lastImport + 1, 0, snippet.import);

  const manifestStart = lines.findIndex((l) => l.includes('export const TEXTURE_MANIFEST'));
  if (manifestStart === -1) throw new Error('Could not find TEXTURE_MANIFEST in manifest.ts.');
  const closeIdx = lines.findIndex((l, i) => i > manifestStart && l.startsWith('};'));
  if (closeIdx === -1) throw new Error('Could not find the end of TEXTURE_MANIFEST.');
  lines.splice(closeIdx, 0, snippet.manifestKey);

  await writeFile(manifestPath, lines.join('\n'));
  return true;
}

/**
 * Scaffolds a starter EntityDefinition into entities.ts: inserts the definition
 * before the `ENTITY_DEFINITIONS` array and adds it to that array, so it appears
 * in both editors. The skeleton is minimal by design — gameplay fields are then
 * refined by hand. Idempotent: a no-op if the definition already exists.
 */
export async function applyEntityContent(
  snippet: WiringSnippet,
  id: string,
  entitiesPath: string = ENTITIES_PATH,
): Promise<boolean> {
  const camel = toCamelCase(id);
  const source = await readFile(entitiesPath, 'utf8');
  if (new RegExp(`\\bexport const ${camel}\\b`).test(source)) return false;

  const lines = source.split('\n');

  const arrayStart = lines.findIndex((l) => l.includes('export const ENTITY_DEFINITIONS'));
  if (arrayStart === -1) throw new Error('Could not find ENTITY_DEFINITIONS in entities.ts.');

  // Insert the definition (with a trailing blank line) before the array export.
  lines.splice(arrayStart, 0, snippet.contentSnippet, '');

  // Add the new const into the array, before its closing `];`.
  const closeIdx = lines.findIndex((l, i) => i > arrayStart && l.startsWith('];'));
  if (closeIdx === -1) throw new Error('Could not find the end of ENTITY_DEFINITIONS.');
  lines.splice(closeIdx, 0, `  ${camel},`);

  await writeFile(entitiesPath, lines.join('\n'));
  return true;
}

/**
 * Applies wiring under --wire: always the manifest; for entities, also the
 * EntityDefinition scaffold. Returns which files were edited.
 */
export async function applyWiring(
  preset: Preset,
  snippet: WiringSnippet,
  id: string,
): Promise<{ manifestApplied: boolean; contentApplied: boolean }> {
  const manifestApplied = await applyManifest(snippet);
  const contentApplied =
    preset.wiringKind === 'entity' ? await applyEntityContent(snippet, id) : false;
  return { manifestApplied, contentApplied };
}
