import type { SkillRequirement, ToolId, ToolType } from './ids';
import type { EquipmentDefinition } from './equipment';

/**
 * An identified Tool: the first Equipment subtype (see CONTEXT.md: Equipment,
 * Tool; ADR-0008, ADR-0030). Tools have a `toolType` (axe/pickaxe/sword, which
 * IS the Equipment slot) and a numeric `tier` (a stat-quality indicator, no
 * longer a harvest gate — see ADR-0022). A Tool gates skill access by type and
 * grants its `stats` ONLY while equipped (see ADR-0030). `wieldRequirement` is
 * legacy and no longer enforced (see ADR-0022).
 */
export interface ToolDefinition extends EquipmentDefinition {
  id: ToolId;
  toolType: ToolType;
  /** Tier of the Tool (stat-quality indicator; no longer gates harvesting). */
  tier: number;
  displayName: string;
  /** @deprecated Skill level needed to wield. No longer enforced (see ADR-0022). */
  wieldRequirement?: SkillRequirement;
  /** Texture id (client manifest) for the HUD/cursor icon. */
  iconTextureId: string;
}
