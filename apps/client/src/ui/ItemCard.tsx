import type { CSSProperties } from 'react';
import { ItemIcon } from './ItemIcon';
import { RARITY_COLOR } from './rarityColor';
import { itemLabel } from './discoveredCollectibles';

/**
 * The shared "Item Card" visual language (see creative/ux-housekeeping.md): one
 * component for how an Item is presented anywhere it appears, so rarity colour,
 * the outlined name, and the overhanging ×N badge live in a single place rather
 * than being copy-pasted per surface (architecture rule: one choke point for
 * derived display). Everything is derived from the `itemId`.
 *
 * Footprints (`variant`):
 *  - `tile` — wide capsule; the loot reel's hero/trail tiles + the "new item" toast.
 *  - `chip` — compact column; the hover-preview drop rail entries.
 *  - `slot` — square cell; Bag/Collection/Vendor grids (deferred adopters).
 */
export type ItemCardVariant = 'tile' | 'chip' | 'slot';

const ICON_SIZE: Record<ItemCardVariant, number> = {
  tile: 46,
  chip: 34,
  slot: 40,
};

interface ItemCardProps {
  itemId: string;
  /** Numeric count (tile/slot). The ×N badge renders when > 1. */
  quantity?: number;
  /** Explicit badge text (chip drops use the model's quantity range, e.g. "1–3"). */
  quantityText?: string;
  variant: ItemCardVariant;
  /** Undiscovered drop: mask the icon/name and show a mystery glyph. */
  hidden?: boolean;
  /** Drop chance label (chip variant only). */
  chanceText?: string;
  /** Small label above the name (tile variant); defaults to the rarity word. */
  kicker?: string;
  className?: string;
  title?: string;
}

/** A single Item rendered in the shared Item Card language. */
export function ItemCard({
  itemId,
  quantity,
  quantityText,
  variant,
  hidden = false,
  chanceText,
  kicker,
  className,
  title,
}: ItemCardProps) {
  const { name, rarity } = itemLabel(itemId);
  const color = RARITY_COLOR[rarity as keyof typeof RARITY_COLOR] ?? RARITY_COLOR.common;

  const badgeText =
    quantityText ?? (quantity !== undefined && quantity > 1 ? String(quantity) : undefined);
  const showBadge = !hidden && badgeText !== undefined;

  const style = { '--rarity': color } as CSSProperties;

  return (
    <div
      className={`item-card item-card-${variant} rarity-${rarity}${hidden ? ' is-hidden' : ''}${
        className ? ` ${className}` : ''
      }`}
      style={style}
      title={title ?? (hidden ? 'Undiscovered drop' : name)}
    >
      <span className="item-card-icon">
        {hidden ? (
          <span className="item-card-mystery" aria-hidden>
            ?
          </span>
        ) : (
          <ItemIcon itemId={itemId} size={ICON_SIZE[variant]} />
        )}
      </span>

      {variant === 'chip' ? (
        <span className="item-card-meta">
          <span className="item-card-chance">{hidden ? '???' : chanceText}</span>
        </span>
      ) : (
        <span className="item-card-body">
          <span className="item-card-kicker">{kicker ?? rarity}</span>
          <span className="item-card-name">{hidden ? '???' : name}</span>
        </span>
      )}

      {showBadge && <span className="item-card-badge">×{badgeText}</span>}
    </div>
  );
}
