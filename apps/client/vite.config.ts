import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { levelSavePlugin } from './vite-plugins/levelSave';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const levelsDir = path.resolve(repoRoot, 'packages/shared/content/levels');

export default defineConfig({
  root: here,
  plugins: [react(), levelSavePlugin(levelsDir)],
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
