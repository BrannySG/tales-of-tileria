import { getBundledEntityArt, type ArtOverride, type EntityDefinition } from '@tot/shared';

export type { ArtOverride };

/** Fully-resolved art used by the renderer (definition defaults + overlay). */
export interface ResolvedArt {
  textureId: string;
  scale: number;
  rotation: number;
  anchorX: number;
  anchorY: number;
  hitParticleTextureId?: string;
  hitTint: number;
}

type Overlay = Record<string, ArtOverride>;

// Seed from the bundled overlay so the shipped build renders authored transforms
// without a dev server. In dev, loadEntityArtOverlay() refreshes from the live file.
let overlay: Overlay = { ...getBundledEntityArt() };
let loadPromise: Promise<void> | null = null;

const ENDPOINT = '/api/entity-art';

/**
 * Refreshes the global art overlay from the dev middleware so the Entity Editor
 * sees live, unsaved edits. In production there is no dev middleware, so the
 * bundled overlay (seeded above) is authoritative and we skip the fetch.
 */
export function loadEntityArtOverlay(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (!import.meta.env.DEV) return;
    try {
      const res = await fetch(ENDPOINT);
      if (res.ok) overlay = ((await res.json()) as Overlay) ?? {};
    } catch {
      // Dev middleware unavailable — keep the bundled overlay.
    }
  })();
  return loadPromise;
}

export function getArtOverride(definitionId: string): ArtOverride {
  return overlay[definitionId] ?? {};
}

/** Merges a patch into the in-memory overlay (does not persist). */
export function setArtOverride(definitionId: string, patch: ArtOverride): void {
  const next: ArtOverride = { ...overlay[definitionId], ...patch };
  for (const key of Object.keys(next) as (keyof ArtOverride)[]) {
    if (next[key] === undefined) delete next[key];
  }
  overlay = { ...overlay, [definitionId]: next };
}

/** Removes all overrides for a definition (reverts to typed defaults). */
export function clearArtOverride(definitionId: string): void {
  if (!(definitionId in overlay)) return;
  const next = { ...overlay };
  delete next[definitionId];
  overlay = next;
}

/** Persists the current overlay to the repo via the dev middleware. */
export async function saveEntityArtOverlay(): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overlay, null, 2),
  });
  if (!res.ok) throw new Error(`Failed to save entity art (${res.status})`);
}

/** Resolves a definition's art by layering the global overlay over defaults. */
export function resolveArt(def: EntityDefinition): ResolvedArt {
  const ov = overlay[def.id] ?? {};
  return {
    textureId: def.art.textureId,
    scale: ov.scale ?? def.art.scale ?? 1,
    rotation: ov.rotation ?? def.art.rotation ?? 0,
    anchorX: ov.anchorX ?? def.art.anchorX ?? 0.5,
    anchorY: ov.anchorY ?? def.art.anchorY ?? 0.9,
    hitParticleTextureId: def.art.hitParticleTextureId,
    hitTint: def.art.hitTint ?? 0xffffff,
  };
}
