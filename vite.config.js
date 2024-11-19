import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open:true,
    port: 5173,
    proxy: {
      '/chat': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response:', proxyRes.statusCode, req.url);
          });
        }
      },
      '/set-system-message': {
        target: 'http://localhost:3005',
        changeOrigin: true
      },
      '/clear-system-message': {
        target: 'http://localhost:3005',
        changeOrigin: true
      }
    }
  }
});