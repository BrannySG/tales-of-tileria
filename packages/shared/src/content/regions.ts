import type { RegionDefinition } from '../types/region';

/**
 * The Region registry (see CONTEXT.md: Region). A Level references one of these
 * by `regionId`; the client resolves the `displayName` for the profile location
 * row. Splits the world by cosmology: the mortal realm vs the Clicker/celestial
 * Inbetween.
 */
export const REGION_DEFINITIONS: readonly RegionDefinition[] = [
  { id: 'tileria', displayName: 'Tileria' },
  { id: 'the_inbetween', displayName: 'The Inbetween' },
];
