import { create } from 'zustand';
import {
  BASE_AUTO_MOVE_SPEED,
  DEFAULT_COMBAT_CONFIG,
  DEFAULT_CURSOR_SKIN_ID,
  emptySkills,
  getItemDefinition,
  getToolDefinition,
  type CursorStats,
  type EntityRuntimeState,
  type CollectionEntryProgress,
  type CombatConfig,
  type QuestState,
  type Rarity,
  type SimTransport,
  type SkillId,
  type SkillState,
  type SkillStats,
  type SkillTreeState,
  type ToolId,
  type ToolType,
  type TreeId,
} from '@tot/shared';
import {
  hasUnacknowledgedDiscoveries,
  isCollectibleItem,
  markDiscovered,
} from '../ui/discoveredCollectibles';
import { REGISTER_SLOT_POP_MS } from '../ui/collectionJuice';

let toastIdSeq = 0;
const nextToastId = (): number => ++toastIdSeq;

/** Loot Reel tuning: identical gains within this window merge into one tile. */
const LOOT_FEED_COALESCE_MS = 900;
/** Max queued+visible entries retained for reel playback bursts. */
const LOOT_FEED_MAX = 8;
/**
 * How long a tile lingers as the hero when there is NO backlog — a calm,
 * readable dwell so a single drop gets the time it deserves. Rarer = longer.
 */
const LOOT_HOLD_BASE_MS: Record<Rarity, number> = {
  common: 2200,
  uncommon: 2500,
  rare: 3000,
  epic: 3500,
  legendary: 4200,
};
/**
 * The floor a tile compresses toward during a heavy burst — fast rapid-fire so
 * a flood of drops cycles quickly without ever feeling instant. Rarer = longer.
 */
const LOOT_HOLD_MIN_MS: Record<Rarity, number> = {
  common: 240,
  uncommon: 280,
  rare: 340,
  epic: 380,
  legendary: 460,
};
/** Each queued (waiting) item shortens the active tile's hold by this much. */
const LOOT_BACKLOG_FALLOFF_MS = 520;
const LOOT_RARITY_ORDER: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

/**
 * Adaptive hold: a lone drop lingers for its full rarity dwell; the more loot is
 * backed up behind it, the sooner it retires so bursts rapid-fire. This is the
 * "your power is growing" speed-up signal (see creative/design-ideas.md).
 */
export function lootHoldMs(rarity: Rarity, backlog: number): number {
  const base = LOOT_HOLD_BASE_MS[rarity];
  const min = LOOT_HOLD_MIN_MS[rarity];
  return Math.max(min, base - Math.max(0, backlog) * LOOT_BACKLOG_FALLOFF_MS);
}

export interface TargetInfo {
  name: string;
  hp: number;
  maxHp: number;
}

/**
 * Live preview projection for the last-hovered world entity (presentation-only,
 * see ADR-0028). Drives the persistent bottom-right Hover Preview Bar; sticky by
 * design (kept until a different entity is hovered), so no anchor math is needed.
 */
export interface HoverPreviewInfo {
  instanceId: string;
  definitionId: string;
  hp: number;
  maxHp: number;
  state: EntityRuntimeState;
  respawnRemaining: number;
}

/** A queued discovery toast for a first-acquired collectible (presentation). */
export interface DiscoveryToastItem {
  id: number;
  itemId: string;
}

export type LootFeedStage = 'entering' | 'active' | 'exiting';

/** One active/animating entry in the Loot Reel feed. */
export interface LootFeedEntry {
  id: number;
  itemId: string;
  rarity: Rarity;
  /** Coalesced count: rapid identical gains merge into one rising tile. */
  quantity: number;
  /** Current animation/playback stage for this tile. */
  stage: LootFeedStage;
  /** performance.now() when the current stage began. */
  stageTs: number;
  /** performance.now() of the latest coalesced gain (merge window anchor). */
  ts: number;
}

/** Pending Loot Reel entry waiting to be promoted into the animated feed. */
export interface LootQueuedEntry {
  id: number;
  itemId: string;
  rarity: Rarity;
  quantity: number;
  /** performance.now() of the latest coalesced gain (merge window anchor). */
  ts: number;
}

/**
 * A one-shot signal that a Collection registration just happened, used to drive
 * client-only registration juice (slot slam + rarity flash + Rare+ modal shake).
 * Derived by diffing `collection.registered` against the prior counts; carries
 * the item whose count jumped most (the tapped slot, or the biggest jump on a
 * register-all) plus its rarity. Presentation-only (see ADR-0028 sibling work).
 */
export interface RegisterFeedback {
  key: number;
  entryId: string;
  itemId: string;
  delta: number;
  rarity: Rarity;
}

/** The active Collection completion celebration, if any (presentation). */
export interface CompletionInfo {
  key: number;
  entryId: string;
  skillId: SkillId;
  /** Skill XP granted by completing the entry (see ADR-0022). */
  xpAwarded: number;
}

/** Client-side view of the player's in-flight refine run (see CONTEXT.md: Refine job). */
export interface RefineJobView {
  recipeId: string;
  stationInstanceId: string;
  totalSeconds: number;
  outputItemId: string;
  outputQuantity: number;
  /** performance.now() when the run started, for animating progress. */
  startedAt: number;
  /** True once the timer elapsed and the output is waiting to be claimed. */
  ready: boolean;
}

/** Client-side view of the player's in-flight craft (for menu progress). */
export interface CraftingJobView {
  recipeId: string;
  totalSeconds: number;
  /** performance.now() when the job started, for animating progress. */
  startedAt: number;
}

/** Player-tunable audio settings, persisted across sessions and reloads. */
export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  soundEnabled: boolean;
  /** HUD-only UI scale multiplier (1 = 100%). */
  uiScale: number;
}

const AUDIO_SETTINGS_KEY = 'tot.audioSettings';
const DEFAULT_AUDIO_SETTINGS: AudioSettings = { musicVolume: 0.5, sfxVolume: 1, soundEnabled: true, uiScale: 1 };

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const clampUiScale = (n: number): number => Math.max(0.75, Math.min(1.75, n));

/** Cursor/Idle stats before the first snapshot hydrates (see CONTEXT.md: Cursor stat). */
const DEFAULT_CURSOR_STATS: CursorStats = {
  idleUnlocked: false,
  autoMoveSpeed: BASE_AUTO_MOVE_SPEED,
  idleYieldMultiplier: 1,
  maxIdleSkills: 1,
  idleSkills: [],
};

/** One accumulated loot stack in an Idle session (item id + total quantity). */
export interface IdleLootEntry {
  itemId: string;
  quantity: number;
}

/** Reads persisted audio settings, falling back to defaults on any error. */
function loadAudioSettings(): AudioSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      musicVolume: clamp01(parsed.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume),
      sfxVolume: clamp01(parsed.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume),
      soundEnabled: parsed.soundEnabled ?? DEFAULT_AUDIO_SETTINGS.soundEnabled,
      uiScale: clampUiScale(parsed.uiScale ?? DEFAULT_AUDIO_SETTINGS.uiScale),
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

function persistAudioSettings(settings: AudioSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode / quota): settings simply won't persist.
  }
}

/**
 * Per-device "seen" read-receipts for the red New indicators (see CONTEXT.md:
 * New indicator). NOT authoritative Player state — purely which unlocked skins /
 * completed achievements this browser has already shown the player.
 */
const SEEN_KEY = 'tot.seenCosmetics';
interface SeenState {
  skins: string[];
  achievements: string[];
}

function loadSeen(): SeenState {
  if (typeof localStorage === 'undefined') return { skins: [], achievements: [] };
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return { skins: [], achievements: [] };
    const parsed = JSON.parse(raw) as Partial<SeenState>;
    return { skins: parsed.skins ?? [], achievements: parsed.achievements ?? [] };
  } catch {
    return { skins: [], achievements: [] };
  }
}

function persistSeen(seen: SeenState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Storage unavailable: dots will simply reappear next session.
  }
}

interface HudState {
  inventory: Record<string, number>;
  quests: QuestState[];
  ownedToolIds: ToolId[];
  ownedTools: ToolType[];
  /** Equipment equipped per slot (mirrors `Player.equippedBySlot`, ADR-0030). */
  equippedBySlot: Partial<Record<ToolType, ToolId>>;
  /** Derived primary tool type for the cursor ring's default icon (first occupied slot). */
  equippedTool: ToolType | undefined;
  skills: Record<SkillId, SkillState>;
  /** Collection Entry progress keyed by entry id (mirrors `Player.collections`). */
  collections: Record<string, CollectionEntryProgress>;
  /** Instance ids of Personal Breakables broken by this player (mirrors `Player.brokenEntities`, ADR-0025). */
  brokenEntities: string[];
  /** Tree allocations keyed by tree id incl. `'clicker'` (mirrors `Player.skillTrees`). */
  skillTrees: Partial<Record<TreeId, SkillTreeState>>;
  /** Sim-derived per-skill Stat blocks (mirrors the snapshot `stats`). */
  stats: Partial<Record<SkillId, SkillStats>>;
  /** Sim-derived Cursor/Idle stat block (mirrors the snapshot `cursorStats`). */
  cursorStats: CursorStats;
  /** True while the local player is in Idle Mode (see CONTEXT.md: Idle Mode). */
  idleActive: boolean;
  /** The Skills currently being idled (the active idle set). */
  idleSkillIds: SkillId[];
  /** Total XP gained during the current Idle session (client-only ephemeral tally). */
  idleSessionXp: number;
  /** Loot gained during the current Idle session, keyed by item id (ephemeral). */
  idleSessionLoot: Record<string, number>;
  /** performance.now() when the current Idle session started (for elapsed time). */
  idleSessionStartedAt: number | undefined;
  craftingUnlocked: boolean;
  craftingJob: CraftingJobView | undefined;
  /** The player's in-flight refine run, if any (see CONTEXT.md: Refine job). */
  refineJob: RefineJobView | undefined;
  /** Pending shrine offerings keyed by shrine instanceId -> granted tool id. */
  offerings: Record<string, ToolId>;
  displayName: string;
  target: TargetInfo | undefined;
  /** Last-hovered Entity preview for the Hover Preview Bar (ADR-0028). */
  hoverPreview: HoverPreviewInfo | undefined;
  locked: boolean;
  /**
   * The Bag item the player has "armed" to use on the world (see CONTEXT.md:
   * Armed item). Client-only transient intent: the cursor carries it and the
   * next Entity click sends `item.useOn`. Undefined = nothing armed.
   */
  armedItemId: string | undefined;
  combat: CombatConfig;
  /** Player-owned passive damage per tick (mirrors `Player.passiveDamage`). */
  passiveDamage: number;
  /** Equipped Cursor skin id (mirrors `Player.cursorSkinId`). */
  cursorSkinId: string;
  /** Cursor skins the player has unlocked (mirrors `Player.unlockedCursorSkins`). */
  unlockedCursorSkins: string[];
  /** Skin ids the New indicator has already shown (client-local read-receipts). */
  seenCursorSkins: string[];
  /** Achievement ids already acknowledged in the Profile (client-local). */
  seenAchievements: string[];
  /** True when unacknowledged collectibles have been discovered (New badge). */
  newCollectibles: boolean;
  /** Queue of discovery toasts for first-acquired collectibles. */
  discoveryToasts: DiscoveryToastItem[];
  /** Newest-first feed of active/animating Loot Reel entries. */
  lootFeed: LootFeedEntry[];
  /** Pending loot entries waiting for reel playback (burst queue). */
  lootQueue: LootQueuedEntry[];
  /** The active Collection completion celebration, if any. */
  completion: CompletionInfo | undefined;
  /** One-shot signal for the most recent Collection registration (juice). */
  lastRegister: RegisterFeedback | undefined;
  soundEnabled: boolean;
  /** Music channel volume (0–1), persisted across sessions. */
  musicVolume: number;
  /** One-shot SFX volume (0–1), persisted across sessions. */
  sfxVolume: number;
  /** HUD-only UI scale multiplier, persisted across sessions. */
  uiScale: number;
  /** Session-only HUD visibility toggle for screenshot mode. */
  hudVisible: boolean;
  setInventory: (inventory: Record<string, number>) => void;
  upsertQuest: (quest: QuestState) => void;
  setOwnedToolIds: (ids: ToolId[]) => void;
  addOwnedToolId: (id: ToolId) => void;
  /** Grants `id` and drops any tools it supplanted, in one update. */
  replaceOwnedTool: (id: ToolId, replaced?: ToolId[]) => void;
  setEquippedBySlot: (equippedBySlot: Partial<Record<ToolType, ToolId>>) => void;
  setSkill: (skillId: SkillId, skill: SkillState) => void;
  setSkills: (skills: Record<SkillId, SkillState>) => void;
  setCollections: (collections: Record<string, CollectionEntryProgress>) => void;
  setCollectionProgress: (entryId: string, progress: CollectionEntryProgress) => void;
  setBrokenEntities: (ids: string[]) => void;
  addBrokenEntity: (instanceId: string) => void;
  setSkillTrees: (skillTrees: Partial<Record<TreeId, SkillTreeState>>) => void;
  setSkillTreeAllocated: (treeId: TreeId, allocated: Record<string, number>) => void;
  setStats: (stats: Partial<Record<SkillId, SkillStats>>) => void;
  setStatsFor: (skillId: SkillId, stats: SkillStats) => void;
  setCursorStats: (stats: CursorStats) => void;
  /** Begins an Idle session: marks active + resets the ephemeral session tally. */
  startIdleSession: (skillIds: SkillId[]) => void;
  /** Ends the Idle session (keeps the tally visible until the next start/reset). */
  stopIdleSession: () => void;
  /** Adds XP to the current Idle session tally. */
  addIdleXp: (amount: number) => void;
  /** Adds positive inventory deltas to the current Idle session loot tally. */
  addIdleLoot: (deltas: Record<string, number>) => void;
  setCraftingUnlocked: (unlocked: boolean) => void;
  setCraftingJob: (job: CraftingJobView | undefined) => void;
  setRefineJob: (job: RefineJobView | undefined) => void;
  setOffering: (instanceId: string, toolId: ToolId | undefined) => void;
  setDisplayName: (name: string) => void;
  setTarget: (target: TargetInfo | undefined) => void;
  /** Sets the previewed Entity (on hover); replaces any prior preview. */
  setHoverPreview: (preview: HoverPreviewInfo) => void;
  /** Patches the current preview's live values (HP/state/respawn each frame). */
  updateHoverPreview: (partial: Partial<HoverPreviewInfo>) => void;
  /** Clears the preview (e.g. after a long idle with no hover). */
  clearHoverPreview: () => void;
  setLocked: (locked: boolean) => void;
  /** Arms (or with `undefined`, disarms) a Bag item for use-on-world. */
  setArmedItem: (itemId: string | undefined) => void;
  setCombat: (partial: Partial<CombatConfig>) => void;
  setPassiveDamage: (amount: number) => void;
  setCursorSkin: (cursorSkinId: string) => void;
  setUnlockedCursorSkins: (ids: string[]) => void;
  addUnlockedCursorSkin: (id: string) => void;
  /** Marks skin ids as seen (clears their New dot), persisted per-device. */
  markCursorSkinsSeen: (ids: string[]) => void;
  /** Marks achievement ids as seen (clears their New dot), persisted per-device. */
  markAchievementsSeen: (ids: string[]) => void;
  /** Sets the Collections New badge flag (client-derived discovery). */
  setNewCollectibles: (value: boolean) => void;
  /** Enqueues a discovery toast for `itemId`. */
  pushDiscoveryToast: (itemId: string) => void;
  /** Removes a discovery toast by id (after its timeout). */
  dismissDiscoveryToast: (id: number) => void;
  /** Pushes positive inventory deltas into the Loot Reel queue/feed (coalescing). */
  pushLootGains: (deltas: Record<string, number>) => void;
  /** Promotes the next queued entry into the feed as an entering tile. */
  promoteLootEntry: () => void;
  /** Moves a feed entry through entering -> active -> exiting. */
  setLootEntryStage: (id: number, stage: LootFeedStage) => void;
  /** Removes a Loot Reel entry by id (after exit animation completes). */
  removeLootEntry: (id: number) => void;
  /** Sets (or clears with undefined) the active completion celebration. */
  setCompletion: (info: CompletionInfo | undefined) => void;
  /** Sets (or clears) the one-shot registration feedback signal. */
  setLastRegister: (info: RegisterFeedback | undefined) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setUiScale: (scale: number) => void;
  setHudVisible: (visible: boolean) => void;
  toggleHudVisible: () => void;
  reset: () => void;
}

/** Maps a set of owned tool ids to the distinct tool *types* (for the hotbar). */
function toolTypesOf(ids: readonly ToolId[]): ToolType[] {
  const types: ToolType[] = [];
  for (const id of ids) {
    const def = getToolDefinition(id);
    if (def && !types.includes(def.toolType)) types.push(def.toolType);
  }
  return types;
}

/** Preference order for the cursor ring's default tool icon (first occupied slot). */
const TOOL_SLOT_ORDER: ToolType[] = ['axe', 'pickaxe', 'sword'];

/** The primary equipped tool type (first occupied slot), for the ring default. */
function primaryToolType(equippedBySlot: Partial<Record<ToolType, ToolId>>): ToolType | undefined {
  for (const slot of TOOL_SLOT_ORDER) {
    if (equippedBySlot[slot]) return slot;
  }
  return undefined;
}

const initialAudio = loadAudioSettings();
const initialSeen = loadSeen();

export const useHud = create<HudState>((set) => ({
  inventory: {},
  quests: [],
  ownedToolIds: [],
  ownedTools: [],
  equippedBySlot: {},
  equippedTool: undefined,
  skills: emptySkills(),
  collections: {},
  brokenEntities: [],
  skillTrees: {},
  stats: {},
  cursorStats: { ...DEFAULT_CURSOR_STATS },
  idleActive: false,
  idleSkillIds: [],
  idleSessionXp: 0,
  idleSessionLoot: {},
  idleSessionStartedAt: undefined,
  craftingUnlocked: false,
  craftingJob: undefined,
  refineJob: undefined,
  offerings: {},
  displayName: '',
  target: undefined,
  hoverPreview: undefined,
  locked: false,
  armedItemId: undefined,
  combat: { ...DEFAULT_COMBAT_CONFIG },
  passiveDamage: 0,
  cursorSkinId: DEFAULT_CURSOR_SKIN_ID,
  unlockedCursorSkins: [DEFAULT_CURSOR_SKIN_ID],
  seenCursorSkins: initialSeen.skins,
  seenAchievements: initialSeen.achievements,
  newCollectibles: false,
  discoveryToasts: [],
  lootFeed: [],
  lootQueue: [],
  completion: undefined,
  lastRegister: undefined,
  soundEnabled: initialAudio.soundEnabled,
  musicVolume: initialAudio.musicVolume,
  sfxVolume: initialAudio.sfxVolume,
  uiScale: initialAudio.uiScale,
  hudVisible: true,
  setInventory: (inventory) => set({ inventory: { ...inventory } }),
  upsertQuest: (quest) =>
    set((state) => {
      const i = state.quests.findIndex((q) => q.questId === quest.questId);
      if (i === -1) return { quests: [...state.quests, quest] };
      const quests = state.quests.slice();
      quests[i] = quest;
      return { quests };
    }),
  setOwnedToolIds: (ids) => set({ ownedToolIds: [...ids], ownedTools: toolTypesOf(ids) }),
  addOwnedToolId: (id) =>
    set((state) => {
      if (state.ownedToolIds.includes(id)) return state;
      const ownedToolIds = [...state.ownedToolIds, id];
      return { ownedToolIds, ownedTools: toolTypesOf(ownedToolIds) };
    }),
  replaceOwnedTool: (id, replaced) =>
    set((state) => {
      const drop = new Set(replaced ?? []);
      const ownedToolIds = state.ownedToolIds.filter((t) => !drop.has(t));
      if (!ownedToolIds.includes(id)) ownedToolIds.push(id);
      return { ownedToolIds, ownedTools: toolTypesOf(ownedToolIds) };
    }),
  setEquippedBySlot: (equippedBySlot) =>
    set({ equippedBySlot: { ...equippedBySlot }, equippedTool: primaryToolType(equippedBySlot) }),
  setSkill: (skillId, skill) => set((state) => ({ skills: { ...state.skills, [skillId]: skill } })),
  setSkills: (skills) => set({ skills: { ...skills } }),
  setCollections: (collections) => set({ collections: { ...collections } }),
  setBrokenEntities: (ids) => set({ brokenEntities: [...ids] }),
  addBrokenEntity: (instanceId) =>
    set((state) =>
      state.brokenEntities.includes(instanceId)
        ? state
        : { brokenEntities: [...state.brokenEntities, instanceId] },
    ),
  setCollectionProgress: (entryId, progress) =>
    set((state) => ({ collections: { ...state.collections, [entryId]: progress } })),
  setSkillTrees: (skillTrees) => set({ skillTrees: { ...skillTrees } }),
  setSkillTreeAllocated: (skillId, allocated) =>
    set((state) => ({ skillTrees: { ...state.skillTrees, [skillId]: { allocated: { ...allocated } } } })),
  setStats: (stats) => set({ stats: { ...stats } }),
  setStatsFor: (skillId, stats) =>
    set((state) => ({ stats: { ...state.stats, [skillId]: stats } })),
  setCursorStats: (cursorStats) => set({ cursorStats: { ...cursorStats } }),
  startIdleSession: (skillIds) =>
    set({
      idleActive: true,
      idleSkillIds: [...skillIds],
      idleSessionXp: 0,
      idleSessionLoot: {},
      idleSessionStartedAt: performance.now(),
    }),
  stopIdleSession: () => set({ idleActive: false, idleSkillIds: [] }),
  addIdleXp: (amount) =>
    set((state) => (amount > 0 ? { idleSessionXp: state.idleSessionXp + amount } : state)),
  addIdleLoot: (deltas) =>
    set((state) => {
      const loot = { ...state.idleSessionLoot };
      let changed = false;
      for (const [itemId, qty] of Object.entries(deltas)) {
        if (qty <= 0) continue;
        loot[itemId] = (loot[itemId] ?? 0) + qty;
        changed = true;
      }
      return changed ? { idleSessionLoot: loot } : state;
    }),
  setCraftingUnlocked: (craftingUnlocked) => set({ craftingUnlocked }),
  setCraftingJob: (craftingJob) => set({ craftingJob }),
  setRefineJob: (refineJob) => set({ refineJob }),
  setOffering: (instanceId, toolId) =>
    set((state) => {
      const offerings = { ...state.offerings };
      if (toolId) offerings[instanceId] = toolId;
      else delete offerings[instanceId];
      return { offerings };
    }),
  setDisplayName: (displayName) => set({ displayName }),
  setTarget: (target) => set({ target }),
  setHoverPreview: (hoverPreview) => set({ hoverPreview }),
  updateHoverPreview: (partial) =>
    set((state) => (state.hoverPreview ? { hoverPreview: { ...state.hoverPreview, ...partial } } : state)),
  clearHoverPreview: () => set({ hoverPreview: undefined }),
  setLocked: (locked) => set({ locked }),
  setArmedItem: (armedItemId) => set({ armedItemId }),
  setCombat: (partial) => set((state) => ({ combat: { ...state.combat, ...partial } })),
  setPassiveDamage: (passiveDamage) => set({ passiveDamage }),
  setCursorSkin: (cursorSkinId) => set({ cursorSkinId }),
  setUnlockedCursorSkins: (ids) => set({ unlockedCursorSkins: [...ids] }),
  addUnlockedCursorSkin: (id) =>
    set((state) =>
      state.unlockedCursorSkins.includes(id)
        ? state
        : { unlockedCursorSkins: [...state.unlockedCursorSkins, id] },
    ),
  markCursorSkinsSeen: (ids) =>
    set((state) => {
      const seenCursorSkins = [...new Set([...state.seenCursorSkins, ...ids])];
      persistSeen({ skins: seenCursorSkins, achievements: state.seenAchievements });
      return { seenCursorSkins };
    }),
  markAchievementsSeen: (ids) =>
    set((state) => {
      const seenAchievements = [...new Set([...state.seenAchievements, ...ids])];
      persistSeen({ skins: state.seenCursorSkins, achievements: seenAchievements });
      return { seenAchievements };
    }),
  setNewCollectibles: (newCollectibles) => set({ newCollectibles }),
  pushDiscoveryToast: (itemId) =>
    set((state) => ({
      discoveryToasts: [...state.discoveryToasts, { id: nextToastId(), itemId }],
    })),
  dismissDiscoveryToast: (id) =>
    set((state) => ({ discoveryToasts: state.discoveryToasts.filter((t) => t.id !== id) })),
  pushLootGains: (deltas) =>
    set((state) => {
      const now = performance.now();
      const feed = state.lootFeed.slice();
      const queue = state.lootQueue.slice();
      let changed = false;
      const burst = Object.entries(deltas)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const rarity = getItemDefinition(itemId)?.rarity ?? 'common';
          return { itemId, qty, rarity };
        })
        .sort(
          (a, b) =>
            LOOT_RARITY_ORDER[a.rarity] - LOOT_RARITY_ORDER[b.rarity] || a.itemId.localeCompare(b.itemId),
        );
      for (const { itemId, qty, rarity } of burst) {
        if (qty <= 0) continue;
        changed = true;
        // Coalesce into a still-living tile (not one already exiting) so repeated
        // gathering keeps a single rising ×N tile and re-lingers it if it's the hero.
        const feedHit = feed.find(
          (entry) => entry.itemId === itemId && entry.stage !== 'exiting' && now - entry.ts <= LOOT_FEED_COALESCE_MS,
        );
        if (feedHit) {
          feedHit.quantity += qty;
          feedHit.ts = now;
          // Refresh the dwell on an active hero so a steady drip stays on screen.
          if (feedHit.stage === 'active') feedHit.stageTs = now;
          continue;
        }
        let queueHit: LootQueuedEntry | undefined;
        for (let i = queue.length - 1; i >= 0; i--) {
          const candidate = queue[i];
          if (!candidate) continue;
          if (candidate.itemId === itemId && now - candidate.ts <= LOOT_FEED_COALESCE_MS) {
            queueHit = candidate;
            break;
          }
        }
        if (queueHit) {
          queueHit.quantity += qty;
          queueHit.ts = now;
          continue;
        }
        queue.push({ id: nextToastId(), itemId, rarity, quantity: qty, ts: now });
      }
      if (!changed) return state;
      const queueCap = Math.max(0, LOOT_FEED_MAX - feed.length);
      return {
        lootFeed: feed,
        // Keep the earliest queued entries to preserve playback order.
        lootQueue: queue.slice(0, queueCap),
      };
    }),
  promoteLootEntry: () =>
    set((state) => {
      const next = state.lootQueue[0];
      if (!next) return state;
      const now = performance.now();
      const nextFeed: LootFeedEntry[] = [
        { ...next, stage: 'entering', stageTs: now },
        ...state.lootFeed,
      ];
      return { lootFeed: nextFeed.slice(0, LOOT_FEED_MAX), lootQueue: state.lootQueue.slice(1) };
    }),
  setLootEntryStage: (id, stage) =>
    set((state) => {
      const idx = state.lootFeed.findIndex((entry) => entry.id === id);
      const current = state.lootFeed[idx];
      if (!current) return state;
      if (current.stage === stage) return state;
      const feed = state.lootFeed.slice();
      feed[idx] = { ...current, stage, stageTs: performance.now() };
      return { lootFeed: feed };
    }),
  removeLootEntry: (id) =>
    set((state) => ({ lootFeed: state.lootFeed.filter((entry) => entry.id !== id) })),
  setCompletion: (completion) => set({ completion }),
  setLastRegister: (lastRegister) => set({ lastRegister }),
  setSoundEnabled: (soundEnabled) =>
    set((state) => {
      persistAudioSettings({
        musicVolume: state.musicVolume,
        sfxVolume: state.sfxVolume,
        soundEnabled,
        uiScale: state.uiScale,
      });
      return { soundEnabled };
    }),
  setMusicVolume: (musicVolume) =>
    set((state) => {
      const next = clamp01(musicVolume);
      persistAudioSettings({
        musicVolume: next,
        sfxVolume: state.sfxVolume,
        soundEnabled: state.soundEnabled,
        uiScale: state.uiScale,
      });
      return { musicVolume: next };
    }),
  setSfxVolume: (sfxVolume) =>
    set((state) => {
      const next = clamp01(sfxVolume);
      persistAudioSettings({
        musicVolume: state.musicVolume,
        sfxVolume: next,
        soundEnabled: state.soundEnabled,
        uiScale: state.uiScale,
      });
      return { sfxVolume: next };
    }),
  setUiScale: (scale) =>
    set((state) => {
      const next = clampUiScale(scale);
      persistAudioSettings({
        musicVolume: state.musicVolume,
        sfxVolume: state.sfxVolume,
        soundEnabled: state.soundEnabled,
        uiScale: next,
      });
      return { uiScale: next };
    }),
  setHudVisible: (hudVisible) => set({ hudVisible }),
  toggleHudVisible: () => set((state) => ({ hudVisible: !state.hudVisible })),
  reset: () =>
    // Note: seen* read-receipts are intentionally NOT reset — they are a
    // per-device history that should survive session/level swaps.
    set({
      inventory: {},
      quests: [],
      ownedToolIds: [],
      ownedTools: [],
      equippedBySlot: {},
      equippedTool: undefined,
      skills: emptySkills(),
      collections: {},
      brokenEntities: [],
      skillTrees: {},
      stats: {},
      cursorStats: { ...DEFAULT_CURSOR_STATS },
      idleActive: false,
      idleSkillIds: [],
      idleSessionXp: 0,
      idleSessionLoot: {},
      idleSessionStartedAt: undefined,
      craftingUnlocked: false,
      craftingJob: undefined,
      refineJob: undefined,
      offerings: {},
      displayName: '',
      target: undefined,
      hoverPreview: undefined,
      locked: false,
      armedItemId: undefined,
      discoveryToasts: [],
      lootFeed: [],
      lootQueue: [],
      completion: undefined,
      lastRegister: undefined,
      cursorSkinId: DEFAULT_CURSOR_SKIN_ID,
      unlockedCursorSkins: [DEFAULT_CURSOR_SKIN_ID],
    }),
}));

/**
 * Subscribes the HUD store to sim events as a projection of authoritative state
 * (see ADR-0006): inventory, owned tools, skills, crafting, offerings, and quest
 * progress are mirrored from sim events, never owned by the client. Returns an
 * unsubscribe fn.
 */
export function bindHud(transport: SimTransport, nameOf: (instanceId: string) => string): () => void {
  const hp = new Map<string, { hp: number; maxHp: number }>();
  const snapshot = transport.getSnapshot();
  for (const e of snapshot.entities) hp.set(e.instanceId, { hp: e.hp, maxHp: e.maxHp });
  let currentTarget: string | undefined;
  // The local player owns this projection; cosmetic.equipped is world-scoped, so
  // only mirror our OWN equip into the HUD (others' equips re-skin remote cursors).
  const localPlayerId = snapshot.player.id;

  // Hydrate player-scoped state from the snapshot.
  const hud = useHud.getState();
  hud.setInventory(snapshot.player.inventory);
  hud.setOwnedToolIds(snapshot.player.ownedTools);
  hud.setEquippedBySlot(snapshot.player.equippedBySlot ?? {});
  hud.setSkills(snapshot.player.skills);
  hud.setCollections(snapshot.player.collections ?? {});
  hud.setBrokenEntities(snapshot.player.brokenEntities ?? []);
  hud.setSkillTrees(snapshot.player.skillTrees ?? {});
  hud.setStats(snapshot.stats ?? {});
  if (snapshot.cursorStats) hud.setCursorStats(snapshot.cursorStats);
  hud.setCraftingUnlocked(snapshot.player.craftingUnlocked);
  if (snapshot.player.refineJob) {
    const rj = snapshot.player.refineJob;
    hud.setRefineJob({
      recipeId: rj.recipeId,
      stationInstanceId: rj.stationInstanceId,
      totalSeconds: rj.totalSeconds,
      outputItemId: rj.outputItemId,
      outputQuantity: rj.outputQuantity,
      // Anchor progress so a mid-run reload shows the remaining time, not the full bar.
      startedAt: performance.now() - (rj.totalSeconds - rj.remainingSeconds) * 1000,
      ready: rj.ready,
    });
  }
  // Seed already-owned collectibles as discovered (silently, no toast flood),
  // then surface the New badge if any discovery is still unacknowledged.
  for (const [itemId, count] of Object.entries(snapshot.player.inventory)) {
    if (count > 0 && isCollectibleItem(itemId)) markDiscovered(itemId);
  }
  hud.setNewCollectibles(hasUnacknowledgedDiscoveries());
  hud.setPassiveDamage(snapshot.player.passiveDamage);
  hud.setDisplayName(snapshot.player.displayName);
  hud.setUnlockedCursorSkins(snapshot.player.unlockedCursorSkins ?? [DEFAULT_CURSOR_SKIN_ID]);
  hud.setCursorSkin(snapshot.player.cursorSkinId ?? DEFAULT_CURSOR_SKIN_ID);
  for (const e of snapshot.entities) if (e.pendingOffering) hud.setOffering(e.instanceId, e.pendingOffering.grantsToolId);
  for (const q of snapshot.player.quests) hud.upsertQuest(q);

  const refreshTarget = () => {
    if (!currentTarget) {
      useHud.getState().setTarget(undefined);
      return;
    }
    const entry = hp.get(currentTarget);
    useHud
      .getState()
      .setTarget(entry ? { name: nameOf(currentTarget), hp: entry.hp, maxHp: entry.maxHp } : undefined);
  };

  return transport.subscribe((event) => {
    switch (event.type) {
      case 'entity.damaged':
      case 'entity.personalDamaged':
      case 'entity.respawned': {
        hp.set(event.instanceId, { hp: event.hp, maxHp: event.maxHp });
        if (event.instanceId === currentTarget) refreshTarget();
        break;
      }
      case 'entity.depleted': {
        const entry = hp.get(event.instanceId);
        if (entry) entry.hp = 0;
        if (event.instanceId === currentTarget) refreshTarget();
        break;
      }
      case 'entity.brokenForPlayer': {
        // Track the per-player break so persistence captures it (the networked
        // base snapshot is frozen at join, see ADR-0025 / playerSave.ts).
        useHud.getState().addBrokenEntity(event.instanceId);
        const entry = hp.get(event.instanceId);
        if (entry) entry.hp = 0;
        if (event.instanceId === currentTarget) refreshTarget();
        break;
      }
      case 'target.changed': {
        currentTarget = event.instanceId;
        useHud.getState().setLocked(event.locked);
        refreshTarget();
        break;
      }
      case 'inventory.changed': {
        const state = useHud.getState();
        // First-time collectible acquisition is derived here (player-scoped, so it
        // never fires on other players' loot): mark + toast + raise the New badge.
        for (const [itemId, count] of Object.entries(event.inventory)) {
          if (count > 0 && markDiscovered(itemId)) {
            state.pushDiscoveryToast(itemId);
            state.setNewCollectibles(true);
          }
        }
        // Positive inventory deltas are the local player's genuine gains
        // (player-scoped event; initial inventory is hydrated via setInventory
        // before we subscribe, so this never floods on load). They feed the Loot
        // Reel in both modes, and the idle-session tally while idling.
        const prev = state.inventory;
        const deltas: Record<string, number> = {};
        for (const [itemId, count] of Object.entries(event.inventory)) {
          const gained = count - (prev[itemId] ?? 0);
          if (gained > 0) deltas[itemId] = gained;
        }
        if (Object.keys(deltas).length > 0) {
          state.pushLootGains(deltas);
          if (state.idleActive) state.addIdleLoot(deltas);
        }
        state.setInventory(event.inventory);
        break;
      }
      case 'pickup.collected': {
        useHud.getState().replaceOwnedTool(event.toolId, event.replacedToolIds);
        break;
      }
      case 'equipment.changed': {
        useHud.getState().setEquippedBySlot(event.equippedBySlot);
        break;
      }
      case 'shop.bought': {
        // Buying grants a Tool with no pickup event; mirror it into owned tools
        // so the Equipment tab can offer it to equip (Gold debit rides
        // inventory.changed).
        useHud.getState().addOwnedToolId(event.equipmentId);
        break;
      }
      case 'quest.updated': {
        useHud.getState().upsertQuest(event.quest);
        break;
      }
      case 'skill.xpGained': {
        const state = useHud.getState();
        state.setSkill(event.skillId, { xp: event.totalXp, level: event.level });
        if (state.idleActive) state.addIdleXp(event.amount);
        break;
      }
      case 'craftingJobStarted': {
        useHud
          .getState()
          .setCraftingJob({ recipeId: event.recipeId, totalSeconds: event.totalSeconds, startedAt: performance.now() });
        break;
      }
      case 'craftingJobCompleted': {
        useHud.getState().setCraftingJob(undefined);
        break;
      }
      case 'refineJobStarted': {
        useHud.getState().setRefineJob({
          recipeId: event.recipeId,
          stationInstanceId: event.stationInstanceId,
          totalSeconds: event.totalSeconds,
          outputItemId: event.outputItemId,
          outputQuantity: event.outputQuantity,
          startedAt: performance.now(),
          ready: false,
        });
        break;
      }
      case 'refineJobReady': {
        const current = useHud.getState().refineJob;
        if (current) useHud.getState().setRefineJob({ ...current, ready: true });
        break;
      }
      case 'refineJobClaimed': {
        useHud.getState().setRefineJob(undefined);
        break;
      }
      case 'craftedItemPlacedAtShrine': {
        useHud.getState().setOffering(event.instanceId, event.grantsToolId);
        break;
      }
      case 'craftedItemClaimed': {
        useHud.getState().setOffering(event.instanceId, undefined);
        useHud.getState().replaceOwnedTool(event.toolId, event.replacedToolIds);
        break;
      }
      case 'player.nameChanged': {
        useHud.getState().setDisplayName(event.name);
        break;
      }
      case 'player.craftingUnlockedChanged': {
        useHud.getState().setCraftingUnlocked(event.unlocked);
        break;
      }
      case 'passiveDamageChanged': {
        useHud.getState().setPassiveDamage(event.amount);
        break;
      }
      case 'collection.registered': {
        const state = useHud.getState();
        const prev = state.collections[event.entryId];
        const prevReg = prev?.registered ?? {};
        // The event carries per-item totals, not a delta. Diff against the prior
        // counts to find the item whose registered total jumped most — the tapped
        // slot, or the biggest jump on a register-all — to drive the slot juice.
        let bestItemId: string | undefined;
        let bestDelta = 0;
        for (const [itemId, count] of Object.entries(event.registered)) {
          const delta = count - (prevReg[itemId] ?? 0);
          if (delta > bestDelta) {
            bestDelta = delta;
            bestItemId = itemId;
          }
        }
        state.setCollectionProgress(event.entryId, {
          registered: { ...event.registered },
          completed: prev?.completed ?? false,
        });
        if (bestItemId) {
          state.setLastRegister({
            key: nextToastId(),
            entryId: event.entryId,
            itemId: bestItemId,
            delta: bestDelta,
            rarity: getItemDefinition(bestItemId)?.rarity ?? 'common',
          });
        }
        break;
      }
      case 'collection.entryCompleted': {
        const prev = useHud.getState().collections[event.entryId];
        const entryId = event.entryId;
        const completion = {
          key: nextToastId(),
          entryId,
          skillId: event.skillId,
          xpAwarded: event.xpAwarded,
        };
        // Hold the completed flag (and celebration toast) so the registering slot
        // can slam/pop before the entry vanishes from the default list filter.
        window.setTimeout(() => {
          const current = useHud.getState().collections[entryId];
          useHud.getState().setCollectionProgress(entryId, {
            registered: { ...(current?.registered ?? prev?.registered ?? {}) },
            completed: true,
          });
          useHud.getState().setCompletion(completion);
        }, REGISTER_SLOT_POP_MS);
        break;
      }
      case 'skill.nodeAllocated': {
        useHud.getState().setSkillTreeAllocated(event.skillId, event.allocated);
        break;
      }
      case 'skill.treeRespecced': {
        useHud.getState().setSkillTreeAllocated(event.skillId, event.allocated);
        break;
      }
      case 'player.statsChanged': {
        useHud.getState().setStatsFor(event.skillId, event.stats);
        break;
      }
      case 'player.cursorStatsChanged': {
        useHud.getState().setCursorStats(event.stats);
        break;
      }
      case 'idle.started': {
        useHud.getState().startIdleSession(event.skillIds);
        break;
      }
      case 'idle.stopped': {
        useHud.getState().stopIdleSession();
        break;
      }
      case 'cosmetic.unlocked': {
        useHud.getState().addUnlockedCursorSkin(event.cursorSkinId);
        break;
      }
      case 'cosmetic.equipped': {
        if (event.playerId === localPlayerId) useHud.getState().setCursorSkin(event.cursorSkinId);
        break;
      }
      case 'shop.sold': {
        // Trade feedback is owned by the Vendor scene, which subscribes to this
        // event directly for its running tally + reaction lines (see ADR-0027).
        // The authoritative state already rode the companion `inventory.changed`
        // (item removed / Gold credited) and, for XP sales, `skill.xpGained`, so
        // there is nothing further to project into the HUD store here.
        break;
      }
    }
  });
}
