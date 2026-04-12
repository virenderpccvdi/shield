import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://shield.rstglobal.in',
  output: 'static',
  build: {
    // Keep page file names clean (no /index.html folders where we don't want them)
    format: 'file',
  },
  compressHTML: true,
});
