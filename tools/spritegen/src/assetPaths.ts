import path from 'node:path';
import { ASSETS_DIR } from './config.ts';

/** Subfolder under `AvailableAssets/` for a given asset filename. */
export function assetSubfolder(fileName: string): string {
  if (fileName.startsWith('T_Area_')) return 'Areas';
  if (fileName.startsWith('T_Entity_')) return 'Entities';
  if (fileName.startsWith('T_Item_')) return 'Items';
  if (fileName.startsWith('T_Cursor_')) return 'Cursors';
  if (fileName.startsWith('T_FX_') || fileName.startsWith('SPR_FX_')) return 'FX';
  if (fileName.startsWith('T_UI_') || fileName.startsWith('Coin ')) return 'UI';
  if (fileName.endsWith('.woff') || fileName.endsWith('.woff2')) return 'Fonts';
  return '';
}

/** Relative path from `AvailableAssets/` root, e.g. `Items/T_Item_Stone.png`. */
export function assetRelPath(fileName: string): string {
  const sub = assetSubfolder(fileName);
  return sub ? path.posix.join(sub, fileName) : fileName;
}

/** Absolute filesystem path for an asset filename. */
export function assetAbsPath(fileName: string): string {
  return path.join(ASSETS_DIR, assetRelPath(fileName));
}
