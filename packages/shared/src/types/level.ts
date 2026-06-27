import type { EntityOverrides } from './entity';
import type { InteractionRule } from './ids';

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
  /**
   * For Beacons: the id of the Level this Beacon travels to. Presentation data
   * only — the client mode reads it to offer Travel; the sim never consumes it
   * (Travel is client-orchestrated, see CONTEXT.md "Beacon"/"Travel" and
   * ADR-0023). Omit on non-Beacon placements.
   */
  travelTargetLevelId?: string;
  /**
   * For Beacons: the name of the Arrival Anchor in the destination Level to
   * arrive at (see CONTEXT.md: Arrival anchor, ADR-0026). Lets edge-to-edge
   * Travel land at the matching edge (exit south -> arrive at the destination's
   * "north" anchor). Omit to arrive at the cursor (legacy ADR-0023 behaviour).
   */
  travelArrivalAnchor?: string;
}

/** A named position a traveler arrives at in a Level (see ADR-0026). */
export interface ArrivalAnchor {
  x: number;
  y: number;
}

/**
 * Per-Level multiplayer/session rules (see ADR-0016). A Level with this block
 * is a networked, shared space; a Level without it is single-player (the
 * onboarding tutorial/council, cutscenes). Most future Levels will be shared.
 */
export interface MultiplayerConfig {
  /**
   * Hard cap on players per Level instance. The router fills instances up to
   * this and rolls overflow into a fresh instance (see ADR-0016). Raids set a
   * higher cap; the open world uses 5.
   */
  maxPlayers: number;
  /** Player-vs-player enabled in this zone. Reserved; defaults to off. */
  pvp?: boolean;
  /**
   * Zone-wide override for how contested entities resolve credit/claim. Takes
   * precedence over each entity's own `interactionRule` (see ADR-0014/0016): a
   * co-op zone is `lastHit`, a competitive zone `sharedContribution`, a peaceful
   * zone `claimed`. Omit to fall back to each entity's own rule.
   */
  interactionDefault?: InteractionRule;
}

/**
 * An authored place a player can be in. Created and saved by the Level Editor;
 * loaded by the game. (Canonical term: "Level" — see CONTEXT.md.)
 */
export interface LevelDefinition {
  id: string;
  displayName: string;
  /**
   * The Region this Level belongs to (see CONTEXT.md: Region) — a named grouping
   * of Levels by cosmology (`tileria`, `the_inbetween`). Presentation/content
   * only: the client resolves it to a display name for the profile location row.
   * Omit for Levels with no Region (the tag is then hidden).
   */
  regionId?: string;
  /** Abstract texture id for the background; client maps to a URL. */
  backgroundTextureId: string;
  /** Authoring bounds in world units (matches the virtual resolution). */
  width: number;
  height: number;
  entities: PlacedEntity[];
  /**
   * Named Arrival Anchors keyed by name (see CONTEXT.md: Arrival anchor,
   * ADR-0026). A Beacon's `travelArrivalAnchor` selects one of these in the
   * destination Level so edge-to-edge Travel lands at the matching edge. Omit
   * for Levels with no authored arrival points (arrivals center on the default).
   */
  arrivalAnchors?: Record<string, ArrivalAnchor>;
  /**
   * Present = this Level is a networked, shared multiplayer space; absent =
   * single-player (see {@link MultiplayerConfig} and ADR-0016).
   */
  multiplayer?: MultiplayerConfig;
}

/** Current LevelDefinition schema version, written into saved files. */
export const LEVEL_SCHEMA_VERSION = 1 as const;

/** On-disk wrapper the editor writes and the loader reads. */
export interface LevelFile {
  schemaVersion: typeof LEVEL_SCHEMA_VERSION;
  level: LevelDefinition;
}
