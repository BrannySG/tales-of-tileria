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
    { instanceId: 'tree-1', definitionId: 'basic_tree', x: 320, y: 300 },
    { instanceId: 'tree-2', definitionId: 'basic_tree', x: 980, y: 360 },
    { instanceId: 'rock-1', definitionId: 'small_rock', x: 470, y: 470 },
    { instanceId: 'rock-2', definitionId: 'small_rock', x: 720, y: 560 },
  ],
};

/** Builds a lookup of instanceId -> display name for a level. */
export function buildNameLookup(level: LevelDefinition): (instanceId: string) => string {
  const names = new Map(
    level.entities.map((e) => [e.instanceId, getEntityDefinition(e.definitionId)?.displayName ?? e.definitionId]),
  );
  return (instanceId: string) => names.get(instanceId) ?? instanceId;
}
