import { create } from 'zustand';
import {
  DEFAULT_COMBAT_CONFIG,
  emptySkills,
  getToolDefinition,
  type CombatConfig,
  type QuestState,
  type SimTransport,
  type SkillId,
  type SkillState,
  type ToolId,
  type ToolType,
} from '@tot/shared';

export interface TargetInfo {
  name: string;
  hp: number;
  maxHp: number;
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

interface HudState {
  inventory: Record<string, number>;
  quests: QuestState[];
  ownedToolIds: ToolId[];
  ownedTools: ToolType[];
  equippedTool: ToolType | undefined;
  skills: Record<SkillId, SkillState>;
  craftingUnlocked: boolean;
  craftingJob: CraftingJobView | undefined;
  /** Pending shrine offerings keyed by shrine instanceId -> granted tool id. */
  offerings: Record<string, ToolId>;
  displayName: string;
  target: TargetInfo | undefined;
  locked: boolean;
  combat: CombatConfig;
  /** Player-owned passive damage per tick (mirrors `Player.passiveDamage`). */
  passiveDamage: number;
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
  setCraftingUnlocked: (unlocked: boolean) => void;
  setCraftingJob: (job: CraftingJobView | undefined) => void;
  setOffering: (instanceId: string, toolId: ToolId | undefined) => void;
  setDisplayName: (name: string) => void;
  setTarget: (target: TargetInfo | undefined) => void;
  setLocked: (locked: boolean) => void;
  setCombat: (partial: Partial<CombatConfig>) => void;
  setPassiveDamage: (amount: number) => void;
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

export const useHud = create<HudState>((set) => ({
  inventory: {},
  quests: [],
  ownedToolIds: [],
  ownedTools: [],
  equippedTool: undefined,
  skills: emptySkills(),
  craftingUnlocked: false,
  craftingJob: undefined,
  offerings: {},
  displayName: '',
  target: undefined,
  locked: false,
  combat: { ...DEFAULT_COMBAT_CONFIG },
  passiveDamage: 0,
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
  setLocked: (locked) => set({ locked }),
  setCombat: (partial) => set((state) => ({ combat: { ...state.combat, ...partial } })),
  setPassiveDamage: (passiveDamage) => set({ passiveDamage }),
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
    set({
      inventory: {},
      quests: [],
      ownedToolIds: [],
      ownedTools: [],
      equippedTool: undefined,
      skills: emptySkills(),
      craftingUnlocked: false,
      craftingJob: undefined,
      offerings: {},
      displayName: '',
      target: undefined,
      locked: false,
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

  // Hydrate player-scoped state from the snapshot.
  const hud = useHud.getState();
  hud.setInventory(snapshot.player.inventory);
  hud.setOwnedToolIds(snapshot.player.ownedTools);
  hud.setEquippedTool(snapshot.player.equippedToolType);
  hud.setSkills(snapshot.player.skills);
  hud.setCraftingUnlocked(snapshot.player.craftingUnlocked);
  hud.setPassiveDamage(snapshot.player.passiveDamage);
  hud.setDisplayName(snapshot.player.displayName);
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
        useHud.getState().setCraftingUnlocked(true);
        break;
      }
      case 'passiveDamageChanged': {
        useHud.getState().setPassiveDamage(event.amount);
        break;
      }
    }
  });
}
