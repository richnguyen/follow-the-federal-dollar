import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Two builds from one codebase:
//   `vite build`                 -> dist/           standalone site (live Treasury refresh enabled)
//   `vite build --mode artifact` -> dist-artifact/  one self-contained HTML file (data baked in)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'artifact' ? [viteSingleFile()] : [])],
  define: { __ARTIFACT__: JSON.stringify(mode === 'artifact') },
  build: {
    outDir: mode === 'artifact' ? 'dist-artifact' : 'dist',
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: mode === 'artifact' ? 100_000_000 : 4096,
  },
}));
