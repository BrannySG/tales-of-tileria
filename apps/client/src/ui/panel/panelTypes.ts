/**
 * Shared, presentation-only view-model types for the docked tab panel (Bag /
 * Equipment / Skills / Collections / Settings). The tab body components are dumb:
 * they render these shapes and call back on interaction. Real data is built from
 * the HUD store (see `viewModels.ts`); the UI Lab feeds the same shapes from mock
 * data, so one set of components serves both the shipped panel and the previewer.
 */

/** The five canonical panel sections. */
export type PanelTabId = 'bag' | 'equipment' | 'skills' | 'collections' | 'settings';

/** Red-dot / numbered-badge state for a single surface (tab, row, slot). */
export interface DotState {
  show: boolean;
  /** When > 1, renders as a numbered badge; otherwise a plain dot. */
  count?: number;
}

/** A single inventory / tool slot in a grid. */
export interface PanelSlotVM {
  /** Stable identity for the slot (item id / tool id). */
  key: string;
  /** Asset manifest texture id for the slot icon. */
  textureId?: string;
  /** Stack count (omitted for singletons). */
  qty?: number;
  /** Freshly acquired — shows a "new" dot. */
  isNew?: boolean;
  /** Armed for use-on-world (Bag) or equipped (Equipment) — highlighted. */
  active?: boolean;
  /** Native hover tooltip text. */
  title?: string;
}

/** One Skill row/cell: level + XP progress + unspent tree points. */
export interface PanelSkillVM {
  /** Tree/Skill id (drives the icon + drill-in). */
  id: string;
  label: string;
  level: number;
  /** 0..1 progress into the current level (drives the XP bar fill). */
  progress: number;
  /** Unspent Skill Points in this Skill's tree (the actionable badge). */
  points: number;
}

/** A paper-doll equip slot (a live Tool slot, or a locked future-gear slot). */
export interface PanelEquipSlotVM {
  id: string;
  label: string;
  /** Texture for the currently-equipped item, if any. */
  iconTextureId?: string;
  /** Future gear slot — shown as a locked placeholder. */
  locked?: boolean;
  /** Whether this slot currently holds an item (click to unequip). */
  equipped?: boolean;
}

/**
 * A Level's aggregate Collection progress (see CONTEXT.md: Level, Collection).
 * One row for now ("The Clearing"); real per-Level grouping is deferred.
 */
export interface PanelLevelVM {
  id: string;
  name: string;
  /** Completed Collection Entries counted toward this Level. */
  completed: number;
  total: number;
  /** Unlocked + reachable today. */
  available: boolean;
  /** Asset manifest texture id for the row icon. */
  iconTextureId?: string;
}

/** Live audio/display preferences mirrored from the HUD store. */
export interface PanelSettingsVM {
  soundEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  uiScale: number;
  screenshotMode: boolean;
}

/** Settings handlers (same callbacks the standalone SettingsMenu used). */
export interface PanelSettingsHandlers {
  onToggleSound: (enabled: boolean) => void;
  onMusicVolume: (volume: number) => void;
  onSfxVolume: (volume: number) => void;
  onUiScale: (scale: number) => void;
  onResetUiScale: () => void;
  onToggleScreenshotMode: (enabled: boolean) => void;
  onForceWipe: () => void;
}

/** Row-level dot for a single Skill (numbered when unspent points exist). */
export function skillRowDot(skill: PanelSkillVM, levelUps: readonly string[] = []): DotState {
  if (skill.points > 0) return { show: true, count: skill.points };
  if (levelUps.includes(skill.id)) return { show: true };
  return { show: false };
}

/** Tab-level dot for Skills: badge of total unspent points, else a plain dot. */
export function skillsTabDot(skills: readonly PanelSkillVM[], levelUps: readonly string[] = []): DotState {
  const totalPoints = skills.reduce((sum, s) => sum + s.points, 0);
  if (totalPoints > 0) return { show: true, count: totalPoints };
  const anyLevelUp = skills.some((s) => levelUps.includes(s.id));
  return { show: anyLevelUp };
}
