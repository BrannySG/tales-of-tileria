import type { EntityDefinition } from '@tot/shared';
import type { EntityView } from './EntityView';
import {
  NPC_REACTIONS,
  NPC_REACTION_COOLDOWN,
  NPC_GLOBAL_REACTION_COOLDOWN,
  depletionTrigger,
  type NpcReaction,
  type ReactionTrigger,
} from '../content/npcReactions';

interface NpcEntry {
  view: EntityView;
  x: number;
  y: number;
  cooldown: number;
}

/**
 * Owns the NPC reaction layer: the registry of speaking NPCs, their cooldowns,
 * nearest-off-cooldown selection, and the resolution of a {@link ReactionTrigger}
 * to a spoken line via the data-driven {@link NPC_REACTIONS} table. Presentation
 * only (see CONTEXT.md: System NPC) — it never touches sim state.
 *
 * Reaction selection honours the table's `priority` (higher wins among reactions
 * sharing a trigger), `oncePerPlayer` (fires at most once a session), and
 * per-reaction `cooldownSeconds`, on top of a per-NPC quiet window so a single
 * speaker doesn't chatter. Variants rotate without repeating the previous line.
 */
export class NpcReactionController {
  private readonly npcs: NpcEntry[] = [];
  /** Reactions grouped by trigger, each list sorted by descending priority. */
  private readonly byTrigger = new Map<ReactionTrigger, NpcReaction[]>();
  /** Wall-clock-ish accumulator (seconds) used for per-reaction cooldowns. */
  private clock = 0;
  /** Earliest clock time ANY ambient reaction may fire again (global quiet window). */
  private globalReadyAt = 0;
  /** Earliest clock time each reaction id may fire again. */
  private readonly reactionReadyAt = new Map<string, number>();
  /** Reaction ids that have already fired their once-per-session line. */
  private readonly consumedOnce = new Set<string>();
  /** Last spoken line index per reaction id (for non-repeating rotation). */
  private readonly lastLineIndex = new Map<string, number>();

  constructor(reactions: readonly NpcReaction[] = NPC_REACTIONS) {
    for (const reaction of reactions) {
      const list = this.byTrigger.get(reaction.trigger) ?? [];
      list.push(reaction);
      this.byTrigger.set(reaction.trigger, list);
    }
    for (const list of this.byTrigger.values()) {
      list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }
  }

  /** Registers a speaking NPC view at a world position. */
  register(view: EntityView, x: number, y: number): void {
    this.npcs.push({ view, x, y, cooldown: 0 });
  }

  get hasNpcs(): boolean {
    return this.npcs.length > 0;
  }

  /** The primary NPC's view (e.g. Mr Smith), used as an FX anchor fallback. */
  primaryView(): EntityView | undefined {
    return this.npcs[0]?.view;
  }

  /** Advances cooldown clocks each frame. */
  update(dt: number): void {
    this.clock += dt;
    for (const npc of this.npcs) {
      if (npc.cooldown > 0) npc.cooldown -= dt;
    }
  }

  /** Resolves a depleted entity to a trigger and has the nearest NPC react. */
  reactToDepletion(def: EntityDefinition, x: number, y: number): void {
    const trigger = depletionTrigger(def.tags);
    if (!trigger) return;
    this.fire(trigger, { x, y });
  }

  /** Has an available NPC speak a line for a (non-depletion) trigger. */
  react(trigger: ReactionTrigger): void {
    this.fire(trigger);
  }

  /** Has the first available NPC speak a literal line (e.g. a craft quip). */
  sayCustom(text: string): void {
    const npc = this.pickNpc();
    if (!npc) return;
    npc.view.say(text);
    npc.cooldown = NPC_REACTION_COOLDOWN;
  }

  /** Resolves the best eligible reaction for a trigger and speaks it. */
  private fire(trigger: ReactionTrigger, near?: { x: number; y: number }): void {
    const reaction = this.pickReaction(trigger);
    if (!reaction) return;
    // Honour the global quiet window so the layer doesn't bark on every event in
    // a rapid sequence; one-time scripted beats may interject through it.
    if (!reaction.oncePerPlayer && this.clock < this.globalReadyAt) return;
    const npc = this.pickNpc(near);
    if (!npc) return;

    npc.view.say(this.pickLine(reaction));
    npc.cooldown = NPC_REACTION_COOLDOWN;
    // Any bark opens the global quiet window (even a scripted beat's), so chatter
    // stays spaced out afterwards.
    this.globalReadyAt = this.clock + NPC_GLOBAL_REACTION_COOLDOWN;
    if (reaction.oncePerPlayer) this.consumedOnce.add(reaction.id);
    if (reaction.cooldownSeconds) {
      this.reactionReadyAt.set(reaction.id, this.clock + reaction.cooldownSeconds);
    }
  }

  /** Highest-priority reaction for a trigger that isn't muted or already spent. */
  private pickReaction(trigger: ReactionTrigger): NpcReaction | undefined {
    const candidates = this.byTrigger.get(trigger);
    if (!candidates) return undefined;
    for (const reaction of candidates) {
      if (reaction.oncePerPlayer && this.consumedOnce.has(reaction.id)) continue;
      const readyAt = this.reactionReadyAt.get(reaction.id);
      if (readyAt !== undefined && this.clock < readyAt) continue;
      return reaction;
    }
    return undefined;
  }

  /**
   * Picks the NPC to speak: the nearest off-cooldown one to `near` (for depletion
   * reactions), otherwise the first off-cooldown NPC; falls back to the primary
   * NPC when all are muted so a scripted beat still lands.
   */
  private pickNpc(near?: { x: number; y: number }): NpcEntry | undefined {
    if (this.npcs.length === 0) return undefined;
    if (near) {
      let best: NpcEntry | undefined;
      let bestDist = Infinity;
      for (const npc of this.npcs) {
        if (npc.cooldown > 0) continue;
        const d = (npc.x - near.x) ** 2 + (npc.y - near.y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = npc;
        }
      }
      return best;
    }
    return this.npcs.find((n) => n.cooldown <= 0) ?? this.npcs[0];
  }

  /** Rotates through a reaction's variants, avoiding the previous line. */
  private pickLine(reaction: NpcReaction): string {
    const pool = reaction.lines;
    if (pool.length === 0) return '';
    if (pool.length === 1) return pool[0]!;
    const prev = this.lastLineIndex.get(reaction.id);
    let i = Math.floor(Math.random() * pool.length);
    if (i === prev) i = (i + 1) % pool.length;
    this.lastLineIndex.set(reaction.id, i);
    return pool[i]!;
  }
}
