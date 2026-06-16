import { create } from 'zustand';
import {
  DEFAULT_COMBAT_CONFIG,
  type AwardedItem,
  type CombatConfig,
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
  target: TargetInfo | undefined;
  locked: boolean;
  combat: CombatConfig;
  soundEnabled: boolean;
  equippedTool: ToolType;
  addItems: (items: AwardedItem[]) => void;
  setTarget: (target: TargetInfo | undefined) => void;
  setLocked: (locked: boolean) => void;
  setCombat: (partial: Partial<CombatConfig>) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setEquippedTool: (tool: ToolType) => void;
  reset: () => void;
}

export const useHud = create<HudState>((set) => ({
  inventory: {},
  target: undefined,
  locked: false,
  combat: { ...DEFAULT_COMBAT_CONFIG },
  soundEnabled: true,
  equippedTool: 'pickaxe',
  addItems: (items) =>
    set((state) => {
      const inventory = { ...state.inventory };
      for (const item of items) {
        inventory[item.itemId] = (inventory[item.itemId] ?? 0) + item.quantity;
      }
      return { inventory };
    }),
  setTarget: (target) => set({ target }),
  setLocked: (locked) => set({ locked }),
  setCombat: (partial) => set((state) => ({ combat: { ...state.combat, ...partial } })),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setEquippedTool: (equippedTool) => set({ equippedTool }),
  reset: () => set({ inventory: {}, target: undefined, locked: false }),
}));

/**
 * Subscribes the HUD store to sim events. Keeps a local cache of entity HP so
 * the target panel can reflect the live target. Returns an unsubscribe fn.
 */
export function bindHud(transport: SimTransport, nameOf: (instanceId: string) => string): () => void {
  const hp = new Map<string, { hp: number; maxHp: number }>();
  for (const e of transport.getSnapshot().entities) hp.set(e.instanceId, { hp: e.hp, maxHp: e.maxHp });
  let currentTarget: string | undefined;

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
      case 'loot.rolled': {
        useHud.getState().addItems(event.items);
        break;
      }
    }
  });
}
