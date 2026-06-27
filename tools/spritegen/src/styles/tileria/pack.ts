import { readFileSync } from 'node:fs';
import { assetAbsPath } from '../../assetPaths.ts';
import type { StylePack } from '../../types.ts';

const styleCore = readFileSync(new URL('./style.md', import.meta.url), 'utf8').trim();

/** On-style references per preset (filenames resolved under AvailableAssets/). */
const REFERENCES: Record<string, string[]> = {
  'item-icon': ['T_Item_WoodLogs.png', 'T_Item_Stone.png', 'T_Item_IronChunk.png', 'T_Item_AetherShard.png'],
  entity: ['T_Entity_Tree01.png', 'T_Entity_Rock.png', 'T_Entity_MagicStone.png', 'T_Entity_Shrine.png'],
  cursor: ['T_Cursor_Cracked.png', 'T_Cursor_Wooden01.png', 'T_Cursor_Stone01.png', 'T_Cursor_Council.png'],
  // UI frames anchor to the locked canon frames (decorative variants, all square
  // sources since one frame 9-slices to any rectangle).
  'ui-frame': ['T_UI_WoodPanel.png', 'T_UI_WoodBox.png', 'T_UI_WoodOrnate.png'],
};

/**
 * The Tales of Tileria visual identity: warm hand-painted storybook fantasy.
 * This is the default Style Pack. To reuse spritegen in another project, add a
 * sibling pack folder with its own style.md + references and select it via
 * `--style`.
 */
export const tileriaPack: StylePack = {
  id: 'tileria',
  styleCore,
  references: Object.fromEntries(
    Object.entries(REFERENCES).map(([k, files]) => [k, files.map((f) => assetAbsPath(f))]),
  ),
  defaultReferences: REFERENCES['item-icon']!.map((f) => assetAbsPath(f)),
  palette: {
    name: 'Storybook Warmwood',
    hexes: ['#a9763e', '#8a5a2c', '#6f4622', '#2a231c', '#ffcf5a'],
  },
};
