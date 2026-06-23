/** Splits a sprite id like `sword_steel` / `swordSteel` into lowercase words. */
function words(id: string): string[] {
  return id
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

/** `sword_steel` -> `SwordSteel` (for `T_Item_SwordSteel.png`). */
export function toPascalCase(id: string): string {
  return words(id)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join('');
}

/** `sword_steel` -> `swordSteel` (for the manifest import variable). */
export function toCamelCase(id: string): string {
  const p = toPascalCase(id);
  return p[0]!.toLowerCase() + p.slice(1);
}

/** `sword_steel` -> `sword_steel` (normalized snake_case). */
export function toSnakeCase(id: string): string {
  return words(id).join('_');
}

/** `crystal_node` -> `Crystal Node` (a sensible default display name). */
export function toTitleCase(id: string): string {
  return words(id)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}
