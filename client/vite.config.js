// Vite yapılandırması. Kaynak "client/" klasöründe, derleme çıktısı kökteki "dist/".
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    host: true, // aynı Wi-Fi'daki telefondan erişim için
    // Geliştirirken API ve giriş sayfası isteklerini Express sunucusuna (3000) aktar.
    proxy: {
      '/api': 'http://localhost:3000',
      '/login': 'http://localhost:3000',
      '/login-assets': 'http://localhost:3000',
    },
  },
});
