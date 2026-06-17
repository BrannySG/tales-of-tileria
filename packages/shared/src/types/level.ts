import type { EntityOverrides } from './entity';

/**
 * A placed entity inside an authored Level. References a definition by id and
 * stores only the fields the author overrode (merged over definition defaults
 * at load time).
 */
export interface PlacedEntity {
  instanceId: string;
  definitionId: string;
  x: number;
  y: number;
  overrides?: EntityOverrides;
  /**
   * Authored starting condition. 'unbuilt' makes a Buildable entity start in its
   * needs-build (inert) look instead of fully built. Omit for the default.
   */
  initialState?: 'unbuilt';
  /**
   * For pickups: present in the Level but not yet collectible until enabled
   * (see "Locked pickup" in CONTEXT.md). Defaults to false (collectible).
   */
  locked?: boolean;
}

/**
 * An authored place a player can be in. Created and saved by the Level Editor;
 * loaded by the game. (Canonical term: "Level" — see CONTEXT.md.)
 */
export interface LevelDefinition {
  id: string;
  displayName: string;
  /** Abstract texture id for the background; client maps to a URL. */
  backgroundTextureId: string;
  /** Authoring bounds in world units (matches the virtual resolution). */
  width: number;
  height: number;
  entities: PlacedEntity[];
}

/** Current LevelDefinition schema version, written into saved files. */
export const LEVEL_SCHEMA_VERSION = 1 as const;

/** On-disk wrapper the editor writes and the loader reads. */
export interface LevelFile {
  schemaVersion: typeof LEVEL_SCHEMA_VERSION;
  level: LevelDefinition;
}
