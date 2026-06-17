import type { EntityDefinition, EntityInstance, PlacedEntity } from '@tot/shared';

/**
 * Merges a placed entity's per-instance overrides over its definition defaults
 * to produce the initial runtime instance. Shared by the sim (runtime) and the
 * editor (live preview) so both resolve values identically.
 */
export function resolveEntityInstance(
  placed: PlacedEntity,
  def: EntityDefinition,
): EntityInstance {
  const maxHp = placed.overrides?.maxHp ?? def.damageable?.maxHp ?? 0;
  const respawnSeconds = placed.overrides?.respawnSeconds ?? def.respawns?.respawnSeconds ?? 0;
  const lootTableId = placed.overrides?.lootTableId ?? def.loot?.lootTableId;
  // A Buildable authored as 'unbuilt' starts inert in its needs-build look.
  const unbuilt = placed.initialState === 'unbuilt' && !!def.buildable;
  return {
    instanceId: placed.instanceId,
    definitionId: placed.definitionId,
    x: placed.x,
    y: placed.y,
    state: unbuilt ? 'unbuilt' : 'available',
    hp: maxHp,
    maxHp,
    respawnSeconds,
    lootTableId,
    respawnRemaining: 0,
    locked: placed.locked ?? false,
  };
}
