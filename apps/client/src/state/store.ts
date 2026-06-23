import { create } from 'zustand';
import {
  DEFAULT_COMBAT_CONFIG,
  DEFAULT_CURSOR_SKIN_ID,
  emptySkills,
  getToolDefinition,
  type EntityRuntimeState,
  type CollectionEntryProgress,
  type CombatConfig,
  type QuestState,
  type SimTransport,
  type SkillId,
  type SkillState,
  type SkillUpgradeState,
  type ToolId,
  type ToolType,
} from '@tot/shared';
import {
  hasUnacknowledgedDiscoveries,
  isCollectibleItem,
  markDiscovered,
} from '../ui/discoveredCollectibles';

let toastIdSeq = 0;
const nextToastId = (): number => ++toastIdSeq;

export interface TargetInfo {
  name: string;
  hp: number;
  maxHp: number;
}

/** Live inspect projection for a world entity (presentation-only). */
export interface InspectInfo {
  instanceId: string;
  definitionId: string;
  anchorX: number;
  anchorY: number;
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

/** The active Collection completion celebration, if any (presentation). */
export interface CompletionInfo {
  key: number;
  entryId: string;
  skillId: SkillId;
  pointsAwarded: number;
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
}

const AUDIO_SETTINGS_KEY = 'tot.audioSettings';
const DEFAULT_AUDIO_SETTINGS: AudioSettings = { musicVolume: 0.5, sfxVolume: 1, soundEnabled: true };

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

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
  equippedTool: ToolType | undefined;
  skills: Record<SkillId, SkillState>;
  /** Collection Entry progress keyed by entry id (mirrors `Player.collections`). */
  collections: Record<string, CollectionEntryProgress>;
  /** Unspent Skill Points per skill (mirrors `Player.skillPoints`). */
  skillPoints: Partial<Record<SkillId, number>>;
  /** Purchased per-skill upgrades (mirrors `Player.skillUpgrades`). */
  skillUpgrades: Partial<Record<SkillId, SkillUpgradeState>>;
  craftingUnlocked: boolean;
  craftingJob: CraftingJobView | undefined;
  /** Pending shrine offerings keyed by shrine instanceId -> granted tool id. */
  offerings: Record<string, ToolId>;
  displayName: string;
  target: TargetInfo | undefined;
  inspect: InspectInfo | undefined;
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
  /** The active Collection completion celebration, if any. */
  completion: CompletionInfo | undefined;
  soundEnabled: boolean;
  /** Music channel volume (0–1), persisted across sessions. */
  musicVolume: number;
  /** One-shot SFX volume (0–1), persisted across sessions. */
  sfxVolume: number;
  setInventory: (inventory: Record<string, number>) => void;
  upsertQuest: (quest: QuestState) => void;
  setOwnedToolIds: (ids: ToolId[]) => void;
  addOwnedToolId: (id: ToolId) => void;
  /** Grants `id` and drops any tools it supplanted, in one update. */
  replaceOwnedTool: (id: ToolId, replaced?: ToolId[]) => void;
  setEquippedTool: (tool: ToolType | undefined) => void;
  setSkill: (skillId: SkillId, skill: SkillState) => void;
  setSkills: (skills: Record<SkillId, SkillState>) => void;
  setCollections: (collections: Record<string, CollectionEntryProgress>) => void;
  setCollectionProgress: (entryId: string, progress: CollectionEntryProgress) => void;
  setSkillPoints: (skillPoints: Partial<Record<SkillId, number>>) => void;
  setSkillPointsFor: (skillId: SkillId, points: number) => void;
  setSkillUpgrades: (upgrades: Partial<Record<SkillId, SkillUpgradeState>>) => void;
  setSkillUpgrade: (skillId: SkillId, upgrade: SkillUpgradeState) => void;
  setCraftingUnlocked: (unlocked: boolean) => void;
  setCraftingJob: (job: CraftingJobView | undefined) => void;
  setOffering: (instanceId: string, toolId: ToolId | undefined) => void;
  setDisplayName: (name: string) => void;
  setTarget: (target: TargetInfo | undefined) => void;
  openInspect: (inspect: InspectInfo) => void;
  updateInspect: (partial: Partial<InspectInfo>) => void;
  closeInspect: () => void;
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
  /** Sets (or clears with undefined) the active completion celebration. */
  setCompletion: (info: CompletionInfo | undefined) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
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

const initialAudio = loadAudioSettings();
const initialSeen = loadSeen();

export const useHud = create<HudState>((set) => ({
  inventory: {},
  quests: [],
  ownedToolIds: [],
  ownedTools: [],
  equippedTool: undefined,
  skills: emptySkills(),
  collections: {},
  skillPoints: {},
  skillUpgrades: {},
  craftingUnlocked: false,
  craftingJob: undefined,
  offerings: {},
  displayName: '',
  target: undefined,
  inspect: undefined,
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
  completion: undefined,
  soundEnabled: initialAudio.soundEnabled,
  musicVolume: initialAudio.musicVolume,
  sfxVolume: initialAudio.sfxVolume,
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
  setEquippedTool: (equippedTool) => set({ equippedTool }),
  setSkill: (skillId, skill) => set((state) => ({ skills: { ...state.skills, [skillId]: skill } })),
  setSkills: (skills) => set({ skills: { ...skills } }),
  setCollections: (collections) => set({ collections: { ...collections } }),
  setCollectionProgress: (entryId, progress) =>
    set((state) => ({ collections: { ...state.collections, [entryId]: progress } })),
  setSkillPoints: (skillPoints) => set({ skillPoints: { ...skillPoints } }),
  setSkillPointsFor: (skillId, points) =>
    set((state) => ({ skillPoints: { ...state.skillPoints, [skillId]: points } })),
  setSkillUpgrades: (skillUpgrades) => set({ skillUpgrades: { ...skillUpgrades } }),
  setSkillUpgrade: (skillId, upgrade) =>
    set((state) => ({ skillUpgrades: { ...state.skillUpgrades, [skillId]: upgrade } })),
  setCraftingUnlocked: (craftingUnlocked) => set({ craftingUnlocked }),
  setCraftingJob: (craftingJob) => set({ craftingJob }),
  setOffering: (instanceId, toolId) =>
    set((state) => {
      const offerings = { ...state.offerings };
      if (toolId) offerings[instanceId] = toolId;
      else delete offerings[instanceId];
      return { offerings };
    }),
  setDisplayName: (displayName) => set({ displayName }),
  setTarget: (target) => set({ target }),
  openInspect: (inspect) => set({ inspect }),
  updateInspect: (partial) =>
    set((state) => (state.inspect ? { inspect: { ...state.inspect, ...partial } } : state)),
  closeInspect: () => set({ inspect: undefined }),
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
  setCompletion: (completion) => set({ completion }),
  setSoundEnabled: (soundEnabled) =>
    set((state) => {
      persistAudioSettings({ musicVolume: state.musicVolume, sfxVolume: state.sfxVolume, soundEnabled });
      return { soundEnabled };
    }),
  setMusicVolume: (musicVolume) =>
    set((state) => {
      const next = clamp01(musicVolume);
      persistAudioSettings({ musicVolume: next, sfxVolume: state.sfxVolume, soundEnabled: state.soundEnabled });
      return { musicVolume: next };
    }),
  setSfxVolume: (sfxVolume) =>
    set((state) => {
      const next = clamp01(sfxVolume);
      persistAudioSettings({ musicVolume: state.musicVolume, sfxVolume: next, soundEnabled: state.soundEnabled });
      return { sfxVolume: next };
    }),
  reset: () =>
    // Note: seen* read-receipts are intentionally NOT reset — they are a
    // per-device history that should survive session/level swaps.
    set({
      inventory: {},
      quests: [],
      ownedToolIds: [],
      ownedTools: [],
      equippedTool: undefined,
      skills: emptySkills(),
      collections: {},
      skillPoints: {},
      skillUpgrades: {},
      craftingUnlocked: false,
      craftingJob: undefined,
      offerings: {},
      displayName: '',
      target: undefined,
      inspect: undefined,
      locked: false,
      armedItemId: undefined,
      discoveryToasts: [],
      completion: undefined,
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
  hud.setEquippedTool(snapshot.player.equippedToolType);
  hud.setSkills(snapshot.player.skills);
  hud.setCollections(snapshot.player.collections ?? {});
  hud.setSkillPoints(snapshot.player.skillPoints ?? {});
  hud.setSkillUpgrades(snapshot.player.skillUpgrades ?? {});
  hud.setCraftingUnlocked(snapshot.player.craftingUnlocked);
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
      case 'target.changed': {
        currentTarget = event.instanceId;
        useHud.getState().setLocked(event.locked);
        refreshTarget();
        break;
      }
      case 'inventory.changed': {
        // First-time collectible acquisition is derived here (player-scoped, so it
        // never fires on other players' loot): mark + toast + raise the New badge.
        for (const [itemId, count] of Object.entries(event.inventory)) {
          if (count > 0 && markDiscovered(itemId)) {
            useHud.getState().pushDiscoveryToast(itemId);
            useHud.getState().setNewCollectibles(true);
          }
        }
        useHud.getState().setInventory(event.inventory);
        break;
      }
      case 'pickup.collected': {
        useHud.getState().replaceOwnedTool(event.toolId, event.replacedToolIds);
        break;
      }
      case 'tool.equipped': {
        useHud.getState().setEquippedTool(event.toolType);
        break;
      }
      case 'quest.updated': {
        useHud.getState().upsertQuest(event.quest);
        break;
      }
      case 'skill.xpGained': {
        useHud.getState().setSkill(event.skillId, { xp: event.totalXp, level: event.level });
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
        const prev = useHud.getState().collections[event.entryId];
        useHud.getState().setCollectionProgress(event.entryId, {
          registered: { ...event.registered },
          completed: prev?.completed ?? false,
        });
        break;
      }
      case 'collection.entryCompleted': {
        const prev = useHud.getState().collections[event.entryId];
        useHud.getState().setCollectionProgress(event.entryId, {
          registered: { ...(prev?.registered ?? {}) },
          completed: true,
        });
        useHud.getState().setCompletion({
          key: nextToastId(),
          entryId: event.entryId,
          skillId: event.skillId,
          pointsAwarded: event.pointsAwarded,
        });
        break;
      }
      case 'skill.pointsChanged': {
        useHud.getState().setSkillPointsFor(event.skillId, event.points);
        break;
      }
      case 'skill.upgradePurchased': {
        useHud.getState().setSkillUpgrade(event.skillId, { activeClickDamage: event.activeClickDamage });
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
    }
  });
}
