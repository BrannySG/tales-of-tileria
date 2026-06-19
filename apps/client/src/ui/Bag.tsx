import { useEffect, useState } from 'react';
import {
  RARITIES,
  bestUsableTool,
  getItemDefinition,
  getToolDefinition,
  type ItemCategory,
  type ItemDefinition,
  type Rarity,
  type SkillId,
  type ToolDefinition,
  type ToolId,
  type ToolType,
} from '@tot/shared';
import { ASSET_URL } from '../assets/manifest';
import { useHud } from '../state/store';

type BagTab = 'items' | 'equipment';

const BAG_OPEN_KEY = 'tot.bagOpen';
/** Minimum number of slots rendered (padded with empties) for a comfortable grid. */
const MIN_SLOTS = 24;
/** Stable display order for owned tools in the Equipment tab. */
const TYPE_ORDER: ToolType[] = ['sword', 'axe', 'pickaxe'];

/** Signature color per rarity (mirrors the loot-rarity CSS palette). */
const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9aa3ad',
  uncommon: '#5cc861',
  rare: '#4aa3ff',
  epic: '#b05cff',
  legendary: '#ffb02e',
};

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  resource: 'Resource',
  consumable: 'Consumable',
  quest: 'Quest Item',
  currency: 'Currency',
};

/** Reads the persisted open/closed preference (defaults to open). */
function loadBagOpen(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    const raw = localStorage.getItem(BAG_OPEN_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

function persistBagOpen(open: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(BAG_OPEN_KEY, open ? '1' : '0');
  } catch {
    // Storage unavailable: preference simply won't persist.
  }
}

interface BagItem {
  def: ItemDefinition;
  count: number;
}

/** Bag items = inventory stacks with art, excluding Currency (Gold shows in the profile). */
function bagItems(inventory: Record<string, number>): BagItem[] {
  const items: BagItem[] = [];
  for (const [id, count] of Object.entries(inventory)) {
    if (count <= 0) continue;
    const def = getItemDefinition(id);
    if (!def || def.category === 'currency') continue;
    items.push({ def, count });
  }
  const catIndex = (c: ItemCategory) => ['resource', 'consumable', 'quest', 'currency'].indexOf(c);
  return items.sort((a, b) => {
    const c = catIndex(a.def.category) - catIndex(b.def.category);
    if (c !== 0) return c;
    const r = RARITIES.indexOf(a.def.rarity) - RARITIES.indexOf(b.def.rarity);
    if (r !== 0) return r;
    return a.def.displayName.localeCompare(b.def.displayName);
  });
}

/** Best wieldable tool per type (falls back to best owned), one slot per type. */
function equipmentSlots(ownedToolIds: readonly ToolId[], skillLevel: (s: SkillId) => number): ToolDefinition[] {
  const slots: ToolDefinition[] = [];
  for (const type of TYPE_ORDER) {
    const usable = bestUsableTool(ownedToolIds, type, skillLevel);
    if (usable) {
      slots.push(usable);
      continue;
    }
    const best = ownedToolIds
      .map((id) => getToolDefinition(id))
      .filter((d): d is ToolDefinition => Boolean(d) && d!.toolType === type)
      .reduce<ToolDefinition | undefined>((acc, d) => (!acc || d.tier > acc.tier ? d : acc), undefined);
    if (best) slots.push(best);
  }
  return slots;
}

function BackpackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M9 2a3 3 0 0 0-3 3v1.2A5 5 0 0 0 3 11v7a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-7a5 5 0 0 0-3-4.8V5a3 3 0 0 0-3-3H9Zm0 2h6a1 1 0 0 1 1 1v.5A5.2 5.2 0 0 0 15 5H9q-.5 0-1 .07V5a1 1 0 0 1 1-1Zm-1 9h8a1 1 0 0 1 1 1v1H7v-1a1 1 0 0 1 1-1Zm-1 4h10v1H7v-1Z"
      />
    </svg>
  );
}

/** The rich hover tooltip for a single Bag item. */
function ItemTooltip({ item }: { item: BagItem }) {
  const { def, count } = item;
  return (
    <div className="bag-tooltip">
      <div className="bag-tooltip-head">
        <span className="bag-tooltip-name" style={{ color: RARITY_COLOR[def.rarity] }}>
          {def.displayName}
        </span>
        {count > 1 && <span className="bag-tooltip-count">x{count}</span>}
      </div>
      <div className="bag-tooltip-meta">
        <span style={{ color: RARITY_COLOR[def.rarity], textTransform: 'capitalize' }}>{def.rarity}</span>
        <span className="bag-tooltip-dot">•</span>
        <span>{CATEGORY_LABEL[def.category]}</span>
      </div>
      <p className="bag-tooltip-desc">{def.description}</p>
    </div>
  );
}

/**
 * The Bag (see CONTEXT.md: Bag): the docked window onto the player's Inventory.
 * The Items tab shows held Items as a slot grid (Gold excluded — it is Currency,
 * shown in the profile); clicking an item arms it for use on the world (see
 * CONTEXT.md: Armed item). The Equipment tab shows owned Tools read-only (the
 * sim auto-equips, so there is nothing to click). Open by default, toggled by a
 * button or the I/B hotkey, with the preference persisted per device.
 */
export function Bag() {
  const inventory = useHud((s) => s.inventory);
  const ownedToolIds = useHud((s) => s.ownedToolIds);
  const equippedTool = useHud((s) => s.equippedTool);
  const skills = useHud((s) => s.skills);
  const armedItemId = useHud((s) => s.armedItemId);

  const [open, setOpen] = useState<boolean>(loadBagOpen);
  const [tab, setTab] = useState<BagTab>('items');
  const [hovered, setHovered] = useState<string | null>(null);

  // I / B toggle the Bag (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'i' && key !== 'b') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      setOpen((o) => {
        const next = !o;
        persistBagOpen(next);
        return next;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      persistBagOpen(next);
      return next;
    });
  };

  const items = bagItems(inventory);
  const skillLevel = (s: SkillId) => skills[s]?.level ?? 1;
  const tools = equipmentSlots(ownedToolIds, skillLevel);
  const emptyCount = Math.max(0, MIN_SLOTS - items.length);

  const armItem = (id: string) => {
    useHud.getState().setArmedItem(armedItemId === id ? undefined : id);
  };

  const hoveredItem = hovered ? items.find((i) => i.def.id === hovered) ?? null : null;

  return (
    <div className="bag">
      {open && (
        <div className="bag-panel">
          <div className="bag-tabs">
            <button
              className={`bag-tab ${tab === 'items' ? 'active' : ''}`}
              onClick={() => setTab('items')}
            >
              Items
            </button>
            <button
              className={`bag-tab ${tab === 'equipment' ? 'active' : ''}`}
              onClick={() => setTab('equipment')}
            >
              Equipment
            </button>
          </div>

          {hoveredItem && <ItemTooltip item={hoveredItem} />}

          {tab === 'items' ? (
            <div className="bag-grid">
              {items.map((item) => (
                <button
                  key={item.def.id}
                  className={`bag-slot ${armedItemId === item.def.id ? 'armed' : ''}`}
                  onClick={() => armItem(item.def.id)}
                  onMouseEnter={() => setHovered(item.def.id)}
                  onMouseLeave={() => setHovered((h) => (h === item.def.id ? null : h))}
                >
                  {item.def.worldTextureId && ASSET_URL[item.def.worldTextureId] && (
                    <img src={ASSET_URL[item.def.worldTextureId]} alt={item.def.displayName} />
                  )}
                  {item.count > 1 && <span className="bag-slot-count">{item.count}</span>}
                </button>
              ))}
              {Array.from({ length: emptyCount }, (_, i) => (
                <div key={`empty-${i}`} className="bag-slot empty" />
              ))}
            </div>
          ) : (
            <div className="bag-grid">
              {tools.map((tool) => (
                <div
                  key={tool.toolType}
                  className={`bag-slot ${equippedTool === tool.toolType ? 'equipped' : ''}`}
                  title={tool.displayName}
                >
                  <img src={ASSET_URL[tool.iconTextureId]} alt={tool.displayName} />
                </div>
              ))}
              {tools.length === 0 && <div className="bag-empty-note">No tools owned yet.</div>}
            </div>
          )}
        </div>
      )}

      <button
        className={`bag-toggle ${open ? 'open' : ''}`}
        onClick={toggle}
        aria-label={open ? 'Close bag' : 'Open bag'}
        title="Bag (I)"
      >
        <BackpackIcon />
      </button>
    </div>
  );
}
