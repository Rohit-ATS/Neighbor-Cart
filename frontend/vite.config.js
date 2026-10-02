import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  build: {
    rollupOptions: {
      input: {
        harvestlink: fileURLToPath(new URL('./harvestlink.html', import.meta.url)),
      },
    },
  },
});
