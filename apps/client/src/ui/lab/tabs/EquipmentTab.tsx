import type { CSSProperties } from 'react';
import { ASSET_URL } from '../../../assets/manifest';
import type { PanelSkin } from '../skins';
import type { PanelEquipSlotVM, PanelSlotVM } from '../../panel/panelTypes';

/**
 * The Equipment tab body: a paper-doll row of equip slots (the live Tool slots
 * Sword/Axe/Pickaxe plus a few locked future-gear slots) over the grid of owned
 * Tools you equip from. Clicking an equipped Tool slot unequips it; clicking an
 * owned Tool in the grid equips it. Equipping is sim-authoritative (ADR-0030) —
 * the tab only calls back; the echoed event updates the store.
 */
export function EquipmentTab({
  skin,
  equipSlots,
  slots,
  slotCount,
  onUnequipSlot,
  onEquipTool,
}: {
  skin: PanelSkin;
  equipSlots: PanelEquipSlotVM[];
  slots: PanelSlotVM[];
  slotCount: number;
  /** Click an occupied (non-locked) equip slot to empty it. */
  onUnequipSlot?: (slotId: string) => void;
  /** Click an owned Tool in the grid to equip it. */
  onEquipTool?: (toolId: string) => void;
}) {
  const t = skin.tokens;
  const empties = Math.max(0, slotCount - slots.length);
  const slotStyle = { background: t.slotBg, borderColor: t.slotBorder } as CSSProperties;

  return (
    <>
      <div className="lab-section-label" style={{ color: t.textMuted }}>
        Equipped
      </div>
      <div className="lab-equip-grid">
        {equipSlots.map((slot) => {
          const interactive = !slot.locked && slot.equipped && Boolean(onUnequipSlot);
          return (
            <button
              key={slot.id}
              type="button"
              className={`lab-equip-slot${slot.locked ? ' is-locked' : ''}${slot.equipped ? ' is-selected' : ''}`}
              style={slotStyle}
              disabled={!interactive}
              onClick={() => interactive && onUnequipSlot?.(slot.id)}
              title={
                slot.locked
                  ? `${slot.label} (locked)`
                  : slot.equipped
                    ? `${slot.label} (equipped — click to unequip)`
                    : slot.label
              }
            >
              {slot.iconTextureId ? (
                <img src={ASSET_URL[slot.iconTextureId]} alt="" className="lab-slot-icon" />
              ) : (
                <span className="lab-equip-lock" aria-hidden>
                  {slot.locked ? '\uD83D\uDD12' : ''}
                </span>
              )}
              <span className="lab-equip-label" style={{ color: t.textMuted }}>
                {slot.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="lab-section-label" style={{ color: t.textMuted }}>
        Inventory
      </div>
      <div className="lab-grid">
        {slots.map((slot) => (
          <button
            key={slot.key}
            type="button"
            className={`lab-slot${slot.active ? ' is-active' : ''}`}
            style={slotStyle}
            disabled={!onEquipTool}
            onClick={() => onEquipTool?.(slot.key)}
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
          </button>
        ))}
        {Array.from({ length: empties }, (_, i) => (
          <span key={`empty-${i}`} className="lab-slot" style={slotStyle} />
        ))}
      </div>
    </>
  );
}
