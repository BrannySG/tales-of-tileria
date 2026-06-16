import { Assets, type Texture } from 'pixi.js';
import { TEXTURE_MANIFEST } from '../assets/manifest';

export type TextureMap = Map<string, Texture>;

/** Loads every texture in the manifest and returns a textureId -> Texture map. */
export async function loadTextures(): Promise<TextureMap> {
  const entries = Object.entries(TEXTURE_MANIFEST);
  const map: TextureMap = new Map();
  await Promise.all(
    entries.map(async ([id, url]) => {
      const texture = await Assets.load<Texture>(url);
      map.set(id, texture);
    }),
  );
  return map;
}
