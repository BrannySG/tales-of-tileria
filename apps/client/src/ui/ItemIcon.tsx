import { getItemDefinition } from '@tot/shared';
import { ASSET_URL } from '../assets/manifest';
import { RARITY_COLOR } from './rarityColor';

/**
 * Renders an Item's icon: its authored texture when one exists, otherwise a
 * procedural rarity-colored placeholder tile (collectibles ship without art in
 * V1; real PNGs drop in later via the Item's `worldTextureId`). The tile shows
 * the item's initials so distinct collectibles read apart at a glance.
 */
export function ItemIcon({ itemId, size = 40 }: { itemId: string; size?: number }) {
  const def = getItemDefinition(itemId);
  const texture = def?.worldTextureId ? ASSET_URL[def.worldTextureId] : undefined;
  const rarity = def?.rarity ?? 'common';
  const color = RARITY_COLOR[rarity];
  // Scale the corner radius with the icon so large detail renders don't look boxy.
  const radius = Math.max(8, Math.round(size * 0.16));

  if (texture) {
    return (
      <span className="item-icon" style={{ width: size, height: size, borderRadius: radius }}>
        <img src={texture} alt={def?.displayName ?? itemId} />
      </span>
    );
  }

  const initials = (def?.displayName ?? itemId)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className={`item-icon item-icon-placeholder rarity-${rarity}`}
      style={{ width: size, height: size, color, borderColor: color, borderRadius: radius }}
      title={def?.displayName ?? itemId}
    >
      <span style={{ fontSize: Math.round(size * 0.34) }}>{initials}</span>
    </span>
  );
}
