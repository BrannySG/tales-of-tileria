import { WorldScene } from '../game/WorldScene';
import { ZOO_LEVEL } from '../game/levels';

export function ZooMode() {
  return (
    <WorldScene
      level={ZOO_LEVEL}
      playerName="Branny"
      tool="pickaxe"
      title="CONTENT ZOO"
      subtitle="Tune the feel of hits, idle locking, and respawns."
      locationName="The Content Zoo"
    />
  );
}
