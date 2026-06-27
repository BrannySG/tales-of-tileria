import type { EntityDefinition } from '../types/entity';
import type { SkillId, ToolType } from '../types/ids';
import type { Player } from '../types/player';
import type { BlockReason } from '../types/protocol';
import { requireToolDefinition } from './registry';
import { maxTierUnlocked } from './stats';

/**
 * The slice of a Player the requirement check reads (see {@link evaluateEntityBlock}).
 * Narrowed so the client can pass its HUD projection of authoritative state
 * directly, without reconstructing a full Player (see ADR-0032).
 */
export type RequirementPlayer = Pick<
  Player,
  'ownedTools' | 'equippedBySlot' | 'skills' | 'skillTrees'
>;

/**
 * Structured reason a player cannot interact with (damage/harvest) an entity,
 * or `undefined` if nothing blocks them. Mirrors the `entity.blocked` event
 * fields so a sim emit is a direct spread (see ADR-0008/0022/0030).
 */
export interface BlockInfo {
  reason: BlockReason;
  requiredToolType?: ToolType;
  requiredTier?: number;
  requiredSkillId?: SkillId;
  requiredSkillLevel?: number;
}

/**
 * The single, pure rule for "can this player act on this entity?" (see
 * CONTEXT.md: Requirement, Tier, Equipment). It is the shared choke point used
 * by BOTH the authoritative sim (`World.applyActiveTap` gate) and the client's
 * optimistic-feedback gate (so success juice never fires on a tap that can't
 * land — see ADR-0032). Keeping it here means the rule is defined once.
 *
 * Tools gate by TYPE and must be EQUIPPED (ADR-0030); the entity's Tier is gated
 * by the matching Skill tree's unlocked Tier (ADR-0022); the entity's own
 * skill-level requirement is checked last. Returns `undefined` when allowed.
 */
export function evaluateEntityBlock(
  player: RequirementPlayer,
  def: EntityDefinition,
): BlockInfo | undefined {
  const req = def.requirements;
  if (!req) return undefined;

  // Equipment gate (ADR-0030): own a Tool of the required type AND have it
  // equipped in its slot. Owning but not equipping is `notEquipped`.
  if (req.toolType) {
    const ownsType = player.ownedTools.some(
      (id) => requireToolDefinition(id).toolType === req.toolType,
    );
    if (!ownsType) return { reason: 'missingTool', requiredToolType: req.toolType };
    if (!player.equippedBySlot?.[req.toolType]) {
      return { reason: 'notEquipped', requiredToolType: req.toolType };
    }
  }

  // Tier gate: the entity's Tier must be unlocked in its Skill's tree. Tier 1 is
  // always available, so only a higher Tier with a gating Skill can block.
  const tier = req.tier ?? 1;
  const skillId = req.skill?.skillId;
  if (tier > 1 && skillId && tier > maxTierUnlocked(player, skillId)) {
    return { reason: 'tierLocked', requiredSkillId: skillId, requiredTier: tier };
  }

  // The entity's own generic skill-level requirement.
  if (req.skill && (player.skills[req.skill.skillId]?.level ?? 1) < req.skill.level) {
    return {
      reason: 'skillLevel',
      requiredSkillId: req.skill.skillId,
      requiredSkillLevel: req.skill.level,
    };
  }

  return undefined;
}
