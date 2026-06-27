import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import backpackIcon from '@assets/UI/icons/Backpack.png';
import swordIcon from '@assets/UI/icons/Sword.png';
import statsIcon from '@assets/UI/icons/Stats.png';
import compassIcon from '@assets/UI/icons/Compass.png';
import gearIcon from '@assets/UI/icons/Gear.png';
import woodGrain from '@assets/UI/T_UI_WoodGrain.png';
import type { PanelSkin } from './skins';
import { NotificationDot } from './NotificationDot';
import type { DotState } from '../panel/panelTypes';

/**
 * UI LAB (research spike) — the panel section tabs, rendered as a *separate* bar
 * that sits on top of the panel and only slightly overlaps its top edge, so the
 * tabs read as their own element linked to (not embedded in) the frame.
 *
 * Clean vector icons (Synty-style flat art) per tab; the active tab lifts, lights
 * up and reveals its label, inactive tabs are icon-only (label on hover/focus for
 * pointer-fine devices). Equal-width, >=48px targets, `tablist`/`tab` semantics
 * with roving arrow-key navigation.
 *
 * Controlled or uncontrolled: pass `activeId` + `onSelect` to drive the panel
 * body from the host (the previewer does this); omit them for self-contained
 * local active state. A `notifications` map renders a red dot over a tab.
 */

export interface TabDef {
  id: string;
  label: string;
  icon: string;
}

/** Default tab set (canonical IA; Collections replaced the old Travel tab). */
export const DEFAULT_TABS: TabDef[] = [
  { id: 'bag', label: 'Bag', icon: backpackIcon },
  { id: 'equipment', label: 'Equipment', icon: swordIcon },
  { id: 'skills', label: 'Skills', icon: statsIcon },
  { id: 'collections', label: 'Collections', icon: compassIcon },
  { id: 'settings', label: 'Settings', icon: gearIcon },
];

/** Tab-bar material treatment (lab comparison). */
export type TabMaterial = 'flat' | 'iron' | 'wood';

export function TabStrip({
  skin,
  tabs = DEFAULT_TABS,
  material = 'flat',
  activeId,
  onSelect,
  notifications,
}: {
  skin: PanelSkin;
  tabs?: TabDef[];
  material?: TabMaterial;
  /** Controlled active tab id. When provided, the host owns selection. */
  activeId?: string;
  onSelect?: (id: string) => void;
  /** Per-tab red-dot state, keyed by tab id. */
  notifications?: Partial<Record<string, DotState>>;
}) {
  const t = skin.tokens;
  const [internalActive, setInternalActive] = useState(tabs[0]?.id ?? '');
  const active = activeId ?? internalActive;
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (id: string) => {
    if (activeId === undefined) setInternalActive(id);
    onSelect?.(id);
  };

  const styleVars = {
    '--tab-accent': t.accent,
    '--tab-ink': t.textMuted,
    '--tab-face': t.tabFace ?? 'linear-gradient(180deg, #3b3128 0%, #241c15 100%)',
    '--tab-face-active': t.tabFaceActive ?? 'linear-gradient(180deg, #efe2c6 0%, #d6bf94 100%)',
    '--tab-edge': t.tabEdge ?? 'rgba(0,0,0,0.55)',
    '--tab-grain': `url(${woodGrain})`,
  } as CSSProperties;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = tabs.findIndex((tab) => tab.id === active);
    if (idx < 0) return;
    let next: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    const nextTab = tabs[next]!;
    select(nextTab.id);
    btnRefs.current[next]?.focus();
  }

  return (
    <div
      className={`lab-tabstrip mat-${material}`}
      role="tablist"
      aria-label="Panel sections"
      style={styleVars}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab, i) => {
        const isActive = tab.id === active;
        const dot = notifications?.[tab.id];
        return (
          <button
            key={tab.id}
            ref={(el) => { btnRefs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            tabIndex={isActive ? 0 : -1}
            className={`lab-tabbtn${isActive ? ' is-active' : ''}`}
            onClick={() => select(tab.id)}
          >
            <img className="lab-tab-ico" src={tab.icon} alt="" aria-hidden draggable={false} />
            <span className="lab-tab-label">{tab.label}</span>
            {dot?.show && <NotificationDot count={dot.count} title={`${tab.label}: new`} />}
          </button>
        );
      })}
    </div>
  );
}
