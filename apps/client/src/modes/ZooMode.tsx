import { WorldScene } from '../game/WorldScene';
import { ZOO_LEVEL } from '../game/levels';

export function ZooMode() {
  return (
    <WorldScene
      level={ZOO_LEVEL}
      playerName="Branny"
      tool="pickaxe"
      locationName="The Content Zoo"
      variant="zoo"
    />
  );
}
