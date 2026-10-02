import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '/healthz': 'http://127.0.0.1:8080',
    },
  },
});
