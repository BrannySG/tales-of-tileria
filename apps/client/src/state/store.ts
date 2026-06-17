import { create } from 'zustand';
import {
  DEFAULT_COMBAT_CONFIG,
  type CombatConfig,
  type QuestState,
  type SimTransport,
  type ToolType,
} from '@tot/shared';

export interface TargetInfo {
  name: string;
  hp: number;
  maxHp: number;
}

interface HudState {
  inventory: Record<string, number>;
  quests: QuestState[];
  ownedTools: ToolType[];
  equippedTool: ToolType | undefined;
  target: TargetInfo | undefined;
  locked: boolean;
  combat: CombatConfig;
  soundEnabled: boolean;
  setInventory: (inventory: Record<string, number>) => void;
  upsertQuest: (quest: QuestState) => void;
  setOwnedTools: (tools: ToolType[]) => void;
  addOwnedTool: (tool: ToolType) => void;
  setTarget: (target: TargetInfo | undefined) => void;
  setLocked: (locked: boolean) => void;
  setCombat: (partial: Partial<CombatConfig>) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setEquippedTool: (tool: ToolType | undefined) => void;
  reset: () => void;
}

export const useHud = create<HudState>((set) => ({
  inventory: {},
  quests: [],
  ownedTools: [],
  equippedTool: undefined,
  target: undefined,
  locked: false,
  combat: { ...DEFAULT_COMBAT_CONFIG },
  soundEnabled: true,
  setInventory: (inventory) => set({ inventory: { ...inventory } }),
  upsertQuest: (quest) =>
    set((state) => {
      const i = state.quests.findIndex((q) => q.questId === quest.questId);
      if (i === -1) return { quests: [...state.quests, quest] };
      const quests = state.quests.slice();
      quests[i] = quest;
      return { quests };
    }),
  setOwnedTools: (ownedTools) => set({ ownedTools: [...ownedTools] }),
  addOwnedTool: (tool) =>
    set((state) => (state.ownedTools.includes(tool) ? state : { ownedTools: [...state.ownedTools, tool] })),
  setTarget: (target) => set({ target }),
  setLocked: (locked) => set({ locked }),
  setCombat: (partial) => set((state) => ({ combat: { ...state.combat, ...partial } })),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setEquippedTool: (equippedTool) => set({ equippedTool }),
  reset: () =>
    set({ inventory: {}, quests: [], ownedTools: [], equippedTool: undefined, target: undefined, locked: false }),
}));

/**
 * Subscribes the HUD store to sim events as a projection of authoritative state
 * (see ADR-0006): inventory, owned/equipped tools, and quest progress are
 * mirrored from sim events, never owned by the client. Returns an unsubscribe fn.
 */
export function bindHud(transport: SimTransport, nameOf: (instanceId: string) => string): () => void {
  const hp = new Map<string, { hp: number; maxHp: number }>();
  const snapshot = transport.getSnapshot();
  for (const e of snapshot.entities) hp.set(e.instanceId, { hp: e.hp, maxHp: e.maxHp });
  let currentTarget: string | undefined;

  // Hydrate player-scoped state from the snapshot.
  const hud = useHud.getState();
  hud.setInventory(snapshot.player.inventory);
  hud.setOwnedTools(snapshot.player.ownedToolTypes);
  hud.setEquippedTool(snapshot.player.equippedToolType);
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
        useHud.getState().addOwnedTool(event.toolType);
        break;
      }
      case 'tool.equipped': {
        useHud.getState().addOwnedTool(event.toolType);
        useHud.getState().setEquippedTool(event.toolType);
        break;
      }
      case 'quest.updated': {
        useHud.getState().upsertQuest(event.quest);
        break;
      }
    }
  });
}
