import type { ToolType } from './ids';
import type { StatKey } from './skillTree';

/**
 * An Equipment slot (see CONTEXT.md: Equipment slot; ADR-0030). A piece of
 * Equipment is equipped into exactly one slot. For Tools the slot IS the Tool's
 * `toolType` — one slot each for axe/pickaxe/sword. Future Artifact slots widen
 * this union when the Artifact subtype ships.
 */
export type EquipmentSlot = ToolType;

/**
 * The base of every equippable thing (see CONTEXT.md: Equipment; ADR-0030).
 * `Tool` is the first Equipment subtype (a future `Artifact` is the second):
 * each occupies a slot and may grant flat per-Stat bonuses, summed at the single
 * `deriveStats` choke point — but ONLY while equipped. Behavioural effects
 * (Artifact procs) are a later subtype-specific extension and do not live here.
 */
export interface EquipmentDefinition {
  id: string;
  /**
   * Flat per-Stat bonuses applied (additively) while this Equipment is equipped
   * in its slot (see CONTEXT.md: Stat). Resolved by `deriveStats`; omit for a
   * piece that grants no Stats.
   */
  stats?: Partial<Record<StatKey, number>>;
}
