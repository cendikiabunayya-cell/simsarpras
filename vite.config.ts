import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Mengaktifkan akses via IP lokal (Wi-Fi / LAN)
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:10000', changeOrigin: true },
      '/realtime': { target: 'http://localhost:10000', changeOrigin: true },
      '/auth': { target: 'http://localhost:10000', changeOrigin: true },
      '/users': { target: 'http://localhost:10000', changeOrigin: true },
      '/assets': { target: 'http://localhost:10000', changeOrigin: true },
      '/loans': { target: 'http://localhost:10000', changeOrigin: true },
      '/loan-requests': { target: 'http://localhost:10000', changeOrigin: true },
      '/locations': { target: 'http://localhost:10000', changeOrigin: true },
      '/categories': { target: 'http://localhost:10000', changeOrigin: true },
      '/funding-sources': { target: 'http://localhost:10000', changeOrigin: true },
      '/school-settings': { target: 'http://localhost:10000', changeOrigin: true },
      '/returns': { target: 'http://localhost:10000', changeOrigin: true },
      '/dashboard': { target: 'http://localhost:10000', changeOrigin: true },
      '/audit-logs': { target: 'http://localhost:10000', changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // @ts-expect-error Vitest configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
