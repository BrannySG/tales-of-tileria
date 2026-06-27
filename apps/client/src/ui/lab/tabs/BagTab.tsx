import { useMemo, useState, type CSSProperties } from 'react';
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
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const hoveredSlot = useMemo(
    () => (hoveredKey ? slots.find((slot) => slot.key === hoveredKey) : undefined),
    [hoveredKey, slots],
  );
  const hoveredTooltip = useMemo(() => parseSlotTooltip(hoveredSlot?.title), [hoveredSlot]);

  return (
    <div className="lab-grid lab-grid-with-tooltip">
      {slots.map((slot) => (
        <button
          key={slot.key}
          type="button"
          className={`lab-slot${slot.active ? ' is-active' : ''}`}
          style={slotStyle}
          onClick={() => onSelect?.(slot.key)}
          disabled={!onSelect}
          title={slot.title}
          onMouseEnter={() => setHoveredKey(slot.key)}
          onMouseLeave={() => setHoveredKey((current) => (current === slot.key ? null : current))}
          onFocus={() => setHoveredKey(slot.key)}
          onBlur={() => setHoveredKey((current) => (current === slot.key ? null : current))}
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
      {hoveredTooltip && (
        <div className="bag-tooltip bag-tooltip--slot" role="tooltip" aria-hidden>
          <div className="bag-tooltip-head">
            <span className="bag-tooltip-name" style={{ color: t.text }}>
              {hoveredTooltip.name}
            </span>
          </div>
          {hoveredTooltip.meta && <div className="bag-tooltip-meta">{hoveredTooltip.meta}</div>}
          {hoveredTooltip.description && (
            <p className="bag-tooltip-desc">{hoveredTooltip.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

function parseSlotTooltip(title: string | undefined): {
  name: string;
  meta?: string;
  description?: string;
} | null {
  if (!title) return null;
  const lines = title
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const [rawName, meta, ...description] = lines;
  const name = rawName ?? '';
  if (!name) return null;
  return {
    name,
    meta,
    description: description.length > 0 ? description.join(' ') : undefined,
  };
}
