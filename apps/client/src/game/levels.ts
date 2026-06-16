import { getEntityDefinition, type LevelDefinition } from '@tot/shared';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../render/constants';

/** The hand-built sandbox level used by the Content Zoo. */
export const ZOO_LEVEL: LevelDefinition = {
  id: 'content_zoo',
  displayName: 'Content Zoo',
  backgroundTextureId: 'bg_area01',
  width: VIRTUAL_WIDTH,
  height: VIRTUAL_HEIGHT,
  entities: [
    { instanceId: 'tree-1', definitionId: 'basic_tree', x: 480, y: 450 },
    { instanceId: 'tree-2', definitionId: 'basic_tree', x: 1470, y: 540 },
    { instanceId: 'rock-1', definitionId: 'small_rock', x: 705, y: 705 },
    { instanceId: 'rock-2', definitionId: 'small_rock', x: 1080, y: 840 },
    { instanceId: 'shack-1', definitionId: 'wood_shack', x: 1400, y: 800 },
    { instanceId: 'npc-1', definitionId: 'mr_smith', x: 760, y: 900 },
  ],
};

/** Builds a lookup of instanceId -> display name for a level. */
export function buildNameLookup(level: LevelDefinition): (instanceId: string) => string {
  const names = new Map(
    level.entities.map((e) => [e.instanceId, getEntityDefinition(e.definitionId)?.displayName ?? e.definitionId]),
  );
  return (instanceId: string) => names.get(instanceId) ?? instanceId;
}
