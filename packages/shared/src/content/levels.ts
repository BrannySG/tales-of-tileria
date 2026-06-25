import type { LevelDefinition, LevelFile } from '../types/level';
import bigworld01 from '../../content/levels/bigworld_01.json';
import deepwood01 from '../../content/levels/deepwood_01.json';
import tutorial01 from '../../content/levels/tutorial_01.json';
import council01 from '../../content/levels/council_01.json';
import blackmarket01 from '../../content/levels/blackmarket_01.json';

/**
 * Levels bundled into the shipped build (see ADR-0016). The authoritative server
 * (`InstanceDO`) and the production client both read Levels from here instead of
 * the dev-only `/api/levels` middleware, so server and client always agree on the
 * same authored content and the shipped build needs no dev server. The Level
 * Editor still writes the JSON files; this registry imports the ones the runtime
 * needs: the shared multiplayer zone plus the single-player onboarding Levels.
 */
const BUNDLED_FILES: Record<string, LevelFile> = {
  bigworld_01: bigworld01 as LevelFile,
  deepwood_01: deepwood01 as LevelFile,
  tutorial_01: tutorial01 as LevelFile,
  council_01: council01 as LevelFile,
  blackmarket_01: blackmarket01 as LevelFile,
};

/** A bundled Level by id, or undefined if it isn't bundled. */
export function getBundledLevel(id: string): LevelDefinition | undefined {
  return BUNDLED_FILES[id]?.level;
}

/** Every bundled Level definition. */
export function listBundledLevels(): LevelDefinition[] {
  return Object.values(BUNDLED_FILES).map((f) => f.level);
}
