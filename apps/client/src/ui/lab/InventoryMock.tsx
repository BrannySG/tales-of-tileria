import type { CSSProperties, ReactNode } from 'react';
import { ASSET_URL } from '../../assets/manifest';
import { Frame } from './Frame';
import type { PanelSkin } from './skins';

/**
 * UI LAB (research spike) — a non-functional inventory panel recreating the
 * target mockup (tab strip, slot grid, gold/weight footer). It is rendered from
 * the shared `Frame` primitive + a `PanelSkin`; nothing here is wired to the sim.
 */

interface SlotData {
  textureId: string;
  qty?: number;
}

// Mirrors the mockup: crystals, wood stack, pickaxe, stone, then empties.
const SLOTS: (SlotData | null)[] = [
  { textureId: 'item_aether_shard', qty: 21 },
  { textureId: 'item_wood', qty: 420 },
  { textureId: 'icon_pickaxe' },
  { textureId: 'item_stone' },
  null, null, null, null,
  null, null, null, null,
];

function TabIcon({ name }: { name: string }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'bag':
      return (
        <svg {...common}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M8 8a4 4 0 0 1 8 0" /></svg>
      );
    case 'sword':
      return (
        <svg {...common}><path d="M14 4 20 4 20 10 9 21 6 18 14 4Z" /><path d="m5 16 3 3" /></svg>
      );
    case 'stats':
      return (
        <svg {...common}><path d="M5 19V11" /><path d="M12 19V5" /><path d="M19 19v-6" /></svg>
      );
    case 'compass':
      return (
        <svg {...common}><circle cx="12" cy="12" r="8" /><path d="m15 9-4 1-2 5 4-1 2-5Z" /></svg>
      );
    case 'gear':
    default:
      return (
        <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>
      );
  }
}

const TABS = [
  { id: 'bag', active: true },
  { id: 'sword', active: false },
  { id: 'stats', active: false },
  { id: 'compass', active: false },
  { id: 'gear', active: false },
];

function CoinIcon() {
  return <img className="lab-foot-icon" src={ASSET_URL.coin_gold_hud} alt="" aria-hidden />;
}

function WeightIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M12 3a3 3 0 0 0-2.83 4H7.2a1 1 0 0 0-.98.8l-2 10A1 1 0 0 0 5.2 19h13.6a1 1 0 0 0 .98-1.2l-2-10a1 1 0 0 0-.98-.8h-1.97A3 3 0 0 0 12 3Zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
    </svg>
  );
}

export function InventoryMock({ skin, width = 360 }: { skin: PanelSkin; width?: number }) {
  const t = skin.tokens;
  const railStyle: CSSProperties = { background: t.rail };

  return (
    <Frame spec={skin.frame} style={{ width }} contentStyle={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="lab-tabs" style={railStyle}>
        {TABS.map((tab) => (
          <span
            key={tab.id}
            className={`lab-tab${tab.active ? ' is-active' : ''}`}
            style={
              {
                color: tab.active ? t.accent : t.textMuted,
                '--tab-accent': t.accent,
                '--tab-slot': t.slotBg,
                '--tab-border': t.slotBorder,
              } as CSSProperties
            }
          >
            <TabIcon name={tab.id} />
          </span>
        ))}
      </div>

      <div className="lab-grid">
        {SLOTS.map((slot, i) => (
          <Slot key={i} skin={skin}>
            {slot && (
              <>
                <img src={ASSET_URL[slot.textureId]} alt="" className="lab-slot-icon" />
                {slot.qty != null && (
                  <span className="lab-slot-qty" style={{ color: t.text }}>
                    {slot.qty.toLocaleString()}
                  </span>
                )}
              </>
            )}
          </Slot>
        ))}
      </div>

      <div className="lab-footer" style={{ borderTopColor: t.rail }}>
        <span className="lab-foot" style={{ color: t.text }}>
          <CoinIcon /> 1,248
        </span>
        <span className="lab-foot" style={{ color: t.text }}>
          <WeightIcon color={t.textMuted} /> 32 / 80
        </span>
      </div>
    </Frame>
  );
}

function Slot({ skin, children }: { skin: PanelSkin; children?: ReactNode }) {
  const t = skin.tokens;
  return (
    <span
      className="lab-slot"
      style={{ background: t.slotBg, borderColor: t.slotBorder } as CSSProperties}
    >
      {children}
    </span>
  );
}
