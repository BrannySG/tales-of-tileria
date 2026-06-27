/**
 * UI LAB (research spike) — static mock data + the mock notification model that
 * drives the multi-tab previewer. Nothing here is wired to the sim/store; it
 * provides the same view-model shapes the shipped panel builds from `useHud`
 * (see `ui/panel/viewModels.ts`), so the lab and the game share one set of tab
 * components.
 */
import {
  skillsTabDot,
  type DotState,
  type PanelEquipSlotVM,
  type PanelLevelVM,
  type PanelSkillVM,
  type PanelSlotVM,
  type PanelTabId,
} from '../panel/panelTypes';

/** The five previewed sections (canonical IA; Collections replaced Travel). */
export type LabTabId = PanelTabId;

// --- Skills ----------------------------------------------------------------

/** Mirrors the canonical trainable Skills plus the Clicker meta-track. */
export const MOCK_SKILLS: PanelSkillVM[] = [
  { id: 'woodcutting', label: 'Woodcutting', level: 54, progress: 0.62, points: 0 },
  { id: 'mining', label: 'Mining', level: 54, progress: 0.62, points: 2 },
  { id: 'combat', label: 'Combat', level: 12, progress: 0.3, points: 0 },
  { id: 'crafting', label: 'Crafting', level: 8, progress: 0.18, points: 0 },
  { id: 'clicker', label: 'Clicks', level: 54, progress: 0.62, points: 0 },
];

export const MOCK_SKILL_TOTAL = MOCK_SKILLS.reduce((sum, s) => sum + s.level, 0);

// --- Bag -------------------------------------------------------------------

/** Mirrors the target mockup: crystals, wood stack, pickaxe, stone (a new drop). */
export const MOCK_INVENTORY: PanelSlotVM[] = [
  { key: 'item_aether_shard', textureId: 'item_aether_shard', qty: 21 },
  { key: 'item_wood', textureId: 'item_wood', qty: 420 },
  { key: 'icon_pickaxe', textureId: 'icon_pickaxe' },
  { key: 'item_stone', textureId: 'item_stone', qty: 8, isNew: true },
];

/** Total slots shown in the Bag grid (filled + padded empties). */
export const BAG_SLOT_COUNT = 16;

// --- Equipment -------------------------------------------------------------

/**
 * Tool slots (Sword/Axe/Pickaxe — the live equip surface today) plus a few
 * locked future-gear slots to sketch the paper-doll direction (future iteration).
 */
export const MOCK_EQUIPMENT_SLOTS: PanelEquipSlotVM[] = [
  { id: 'sword', label: 'Sword', iconTextureId: 'icon_sword', equipped: true },
  { id: 'axe', label: 'Axe', iconTextureId: 'item_axe_iron', equipped: true },
  { id: 'pickaxe', label: 'Pickaxe', iconTextureId: 'icon_pickaxe', equipped: true },
  { id: 'head', label: 'Head', locked: true },
  { id: 'body', label: 'Body', locked: true },
  { id: 'trinket', label: 'Trinket', locked: true },
];

// --- Collections (by Level) ------------------------------------------------

/**
 * One Level for now ("The Clearing"). True per-Level grouping later needs a
 * Level -> Collection-Entry mapping (a content-model change); this list is the
 * World-Map-style shell that will consume it.
 */
export const MOCK_LEVELS: PanelLevelVM[] = [
  { id: 'the_clearing', name: 'The Clearing', completed: 7, total: 41, available: true },
  {
    id: 'deepwood_01_teaser',
    name: 'The Deepwood',
    completed: 0,
    total: 0,
    available: false,
    comingSoon: true,
    subtitle: 'Coming soon',
    iconTextureId: 'entity_ancient_tree',
  },
];

// --- Notification model ----------------------------------------------------

/**
 * The toggleable mock notification state. Tab-level booleans cover the surfaces
 * with no derivable mock signal (Bag/Equipment/Collections/Settings); Skill dots
 * derive from unspent points (always-on for Mining here) plus any unseen
 * level-ups listed in `skillLevelUps`.
 */
export interface LabNotifications {
  bag: boolean;
  equipment: boolean;
  collections: boolean;
  settings: boolean;
  /** Skill ids with an unseen level-up (adds a dot on top of the points dot). */
  skillLevelUps: string[];
}

export const DEFAULT_NOTIFICATIONS: LabNotifications = {
  bag: true,
  equipment: false,
  collections: false,
  settings: false,
  skillLevelUps: ['woodcutting'],
};

/** Per-tab dot map consumed by the TabStrip (lab mock signals). */
export function labTabDots(notifications: LabNotifications): Partial<Record<LabTabId, DotState>> {
  return {
    bag: { show: notifications.bag },
    equipment: { show: notifications.equipment },
    skills: skillsTabDot(MOCK_SKILLS, notifications.skillLevelUps),
    collections: { show: notifications.collections },
    settings: { show: notifications.settings },
  };
}
