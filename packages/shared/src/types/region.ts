/**
 * A Region: a named grouping of Levels along the game's cosmology (see
 * CONTEXT.md: Region). Today two exist — Tileria (the mortal realm) and The
 * Inbetween (the Clicker/celestial spaces of the Cursor-beings). A Region is a
 * presentation/content classification surfaced in the profile location row; it
 * is not a sim or Level-instance concept.
 */
export interface RegionDefinition {
  id: string;
  displayName: string;
}
