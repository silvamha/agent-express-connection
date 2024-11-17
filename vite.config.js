import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/chat': 'http://localhost:3005',
      '/set-system-message': 'http://localhost:3005',
      '/clear-history': 'http://localhost:3005'
    }
  }
});