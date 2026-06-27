import type { CSSProperties } from 'react';
import { ASSET_URL } from '../../../assets/manifest';
import { NotificationDot } from '../NotificationDot';
import type { PanelSkin } from '../skins';
import type { PanelSlotVM } from '../../panel/panelTypes';

/**
 * The Bag tab body: the held-items slot grid. A freshly-acquired slot gets a red
 * dot; the armed slot is highlighted. Clicking a slot arms that Item for use on
 * the world (see CONTEXT.md: Armed item). Gold lives in the panel footer, so it
 * stays visible even when the body is collapsed.
 */
export function BagTab({
  skin,
  slots,
  slotCount,
  onSelect,
}: {
  skin: PanelSkin;
  slots: PanelSlotVM[];
  slotCount: number;
  onSelect?: (key: string) => void;
}) {
  const t = skin.tokens;
  const empties = Math.max(0, slotCount - slots.length);
  const slotStyle = { background: t.slotBg, borderColor: t.slotBorder } as CSSProperties;

  return (
    <div className="lab-grid">
      {slots.map((slot) => (
        <button
          key={slot.key}
          type="button"
          className={`lab-slot${slot.active ? ' is-active' : ''}`}
          style={slotStyle}
          onClick={() => onSelect?.(slot.key)}
          disabled={!onSelect}
          title={slot.title}
        >
          {slot.textureId && ASSET_URL[slot.textureId] && (
            <img src={ASSET_URL[slot.textureId]} alt="" className="lab-slot-icon" />
          )}
          {slot.qty != null && (
            <span className="lab-slot-qty" style={{ color: t.text }}>
              {slot.qty.toLocaleString()}
            </span>
          )}
          {slot.isNew && <NotificationDot title="New item" />}
        </button>
      ))}
      {Array.from({ length: empties }, (_, i) => (
        <span key={`empty-${i}`} className="lab-slot" style={slotStyle} />
      ))}
    </div>
  );
}
