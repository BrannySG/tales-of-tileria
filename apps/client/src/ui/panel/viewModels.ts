/**
 * The single choke point that derives the docked panel's presentation view-models
 * from authoritative HUD state + shared content (see architecture.mdc: derive
 * display models in one place). Pure builders — components stay dumb, the lab
 * feeds the same shapes from mock data.
 */
import {
  RARITIES,
  getItemDefinition,
  getToolDefinition,
  levelXpBounds,
  listCollectionEntries,
  listSkillTrees,
  skillTreePoints,
  type ItemCategory,
  type Player,
  type SkillId,
  type SkillState,
  type ToolId,
  type ToolType,
  type TreeId,
} from '@tot/shared';
import { skillLabel } from '../skillPresentation';
import type {
  DotState,
  PanelEquipSlotVM,
  PanelLevelVM,
  PanelSkillVM,
  PanelSlotVM,
} from './panelTypes';
import { unseenItemIds } from './bagUnseen';

/** Player-facing label per Tool slot. */
const SLOT_LABEL: Record<ToolType, string> = {
  sword: 'Sword',
  axe: 'Axe',
  pickaxe: 'Pickaxe',
};

/** Stable display order for owned tools / equip slots. */
const TYPE_ORDER: ToolType[] = ['sword', 'axe', 'pickaxe'];

/** Future gear slots, sketched as locked placeholders until gear exists. */
const LOCKED_GEAR_SLOTS: PanelEquipSlotVM[] = [
  { id: 'head', label: 'Head', locked: true },
  { id: 'body', label: 'Body', locked: true },
  { id: 'trinket', label: 'Trinket', locked: true },
];

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  resource: 'Resource',
  consumable: 'Consumable',
  quest: 'Quest Item',
  currency: 'Currency',
};

/** A rich-ish native tooltip for a Bag item (name, rarity/category, description). */
function itemTitle(id: string, count: number): string {
  const def = getItemDefinition(id);
  if (!def) return id;
  const head = count > 1 ? `${def.displayName} x${count}` : def.displayName;
  const meta = `${def.rarity} - ${CATEGORY_LABEL[def.category]}`;
  return [head, meta, def.description].filter(Boolean).join('\n');
}

/**
 * Bag slots = inventory stacks (Gold excluded — it is Currency, shown in the
 * footer), sorted by category then rarity then name (matches the old Bag). The
 * armed item is flagged active; freshly-acquired stacks carry the "new" dot.
 */
export function buildBagSlots(
  inventory: Record<string, number>,
  armedItemId: string | undefined,
  seen: readonly string[],
): PanelSlotVM[] {
  const ids = bagItemIds(inventory);
  const unseen = new Set(unseenItemIds(ids, seen));
  const catIndex = (c: ItemCategory) => ['resource', 'consumable', 'quest', 'currency'].indexOf(c);
  return ids
    .map((id) => ({ id, count: inventory[id]!, def: getItemDefinition(id)! }))
    .sort((a, b) => {
      const c = catIndex(a.def.category) - catIndex(b.def.category);
      if (c !== 0) return c;
      const r = RARITIES.indexOf(a.def.rarity) - RARITIES.indexOf(b.def.rarity);
      if (r !== 0) return r;
      return a.def.displayName.localeCompare(b.def.displayName);
    })
    .map(({ id, count, def }) => ({
      key: id,
      textureId: def.worldTextureId,
      qty: count > 1 ? count : undefined,
      isNew: unseen.has(id),
      active: armedItemId === id,
      title: itemTitle(id, count),
    }));
}

/** Non-currency inventory item ids with a positive count and a known definition. */
export function bagItemIds(inventory: Record<string, number>): string[] {
  const out: string[] = [];
  for (const [id, count] of Object.entries(inventory)) {
    if (count <= 0) continue;
    const def = getItemDefinition(id);
    if (!def || def.category === 'currency') continue;
    out.push(id);
  }
  return out;
}

/** The Bag tab dot: shows when any held item hasn't been acknowledged yet. */
export function buildBagDot(inventory: Record<string, number>, seen: readonly string[]): DotState {
  const count = unseenItemIds(bagItemIds(inventory), seen).length;
  return { show: count > 0 };
}

/** All owned Tools, grouped by slot order then ascending tier (the equip list). */
export function buildOwnedToolSlots(
  ownedToolIds: readonly ToolId[],
  equippedBySlot: Partial<Record<ToolType, ToolId>>,
): PanelSlotVM[] {
  return ownedToolIds
    .map((id) => getToolDefinition(id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .sort((a, b) => {
      const t = TYPE_ORDER.indexOf(a.toolType) - TYPE_ORDER.indexOf(b.toolType);
      if (t !== 0) return t;
      return a.tier - b.tier;
    })
    .map((tool) => {
      const equipped = equippedBySlot[tool.toolType] === tool.id;
      return {
        key: tool.id,
        textureId: tool.iconTextureId,
        active: equipped,
        title: `${tool.displayName} - ${SLOT_LABEL[tool.toolType]} slot${
          equipped ? ' (equipped)' : ' (click to equip)'
        }`,
      };
    });
}

/** The paper-doll: the three live Tool slots (equipped icon or empty) + locked gear. */
export function buildEquipSlots(
  equippedBySlot: Partial<Record<ToolType, ToolId>>,
): PanelEquipSlotVM[] {
  const toolSlots: PanelEquipSlotVM[] = TYPE_ORDER.map((toolType) => {
    const equippedId = equippedBySlot[toolType];
    const def = equippedId ? getToolDefinition(equippedId) : undefined;
    return {
      id: toolType,
      label: SLOT_LABEL[toolType],
      iconTextureId: def?.iconTextureId,
      equipped: Boolean(def),
    };
  });
  return [...toolSlots, ...LOCKED_GEAR_SLOTS];
}

/**
 * Per-Skill view-models (one row per Skill that has a Tree, matching the Skill
 * Tracker), plus the summed level. `points` is the unspent Skill Points in that
 * tree (the actionable dot). Reads the same registry as the live HUD.
 */
export function buildSkillVMs(
  skills: Record<SkillId, SkillState>,
  skillTrees: Player['skillTrees'],
): { skills: PanelSkillVM[]; total: number } {
  const player = { skills, skillTrees } as Player;
  const vms = listSkillTrees().map((tree) => {
    const treeId = tree.skillId as TreeId;
    const state = skills[treeId as SkillId] ?? { xp: 0, level: 1 };
    const bounds = levelXpBounds(state.xp);
    const span = Math.max(1, bounds.next - bounds.current);
    const into = Math.min(span, Math.max(0, state.xp - bounds.current));
    return {
      id: treeId,
      label: skillLabel(treeId),
      level: state.level,
      progress: into / span,
      points: skillTreePoints(player, treeId).available,
    };
  });
  const total = Object.values(skills).reduce((sum, s) => sum + s.level, 0);
  return { skills: vms, total };
}

/**
 * The placeholder Level row for the Collections tab (see CONTEXT.md: Level): the
 * current Level's name with aggregate Collection-Entry completion across every
 * Collection. Real per-Level grouping is deferred.
 */
export function buildLevelCollectionVM(
  levelName: string,
  collections: Record<string, { completed?: boolean } | undefined>,
): PanelLevelVM {
  const entries = listCollectionEntries();
  const completed = entries.filter((e) => collections[e.id]?.completed).length;
  return {
    id: 'current_level',
    name: levelName,
    completed,
    total: entries.length,
    available: true,
  };
}
