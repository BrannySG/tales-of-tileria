import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { levelSavePlugin } from './vite-plugins/levelSave';
import { entityArtSavePlugin } from './vite-plugins/entityArtSave';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const levelsDir = path.resolve(repoRoot, 'packages/shared/content/levels');
const entityArtFile = path.resolve(repoRoot, 'packages/shared/content/entity-art.json');

export default defineConfig({
  root: here,
  plugins: [react(), levelSavePlugin(levelsDir), entityArtSavePlugin(entityArtFile)],
  resolve: {
    alias: {
      '@assets': path.resolve(repoRoot, 'AvailableAssets'),
    },
  },
  server: {
    fs: {
      // Allow serving the repo root (asset PNGs + workspace packages live outside the app).
      allow: [repoRoot],
    },
  },
});
