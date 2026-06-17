import type { SkillRequirement, ToolId, ToolType } from './ids';

/**
 * An identified Tool: reusable content describing a single tool the player can
 * own (see ADR-0008). Tools have a `toolType` (axe/pickaxe/sword) and a numeric
 * `tier`; entity tool requirements gate on both. A tool may carry a
 * `wieldRequirement` (a skill level needed to *use* it) — owning a tool is not
 * enough if its wield requirement is unmet (e.g. the Stone Axe needs
 * Woodcutting 3). Gating is owned-based; the cursor ring auto-equips the best
 * *usable* tool of the required type.
 */
export interface ToolDefinition {
  id: ToolId;
  toolType: ToolType;
  /** Tier the tool satisfies; entity requirements declare a `minTier`. */
  tier: number;
  displayName: string;
  /** Skill level needed to wield (use) the tool. Owned-but-unusable below it. */
  wieldRequirement?: SkillRequirement;
  /** Texture id (client manifest) for the HUD/cursor icon. */
  iconTextureId: string;
}
