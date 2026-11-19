import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages under /PHY2ICK/ or anywhere else.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 6000 },
});
