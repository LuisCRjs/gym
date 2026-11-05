import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['plan.json'],
      manifest: {
        name: 'Gym Tracker',
        short_name: 'Gym',
        display: 'standalone',
        start_url: '/',
        background_color: '#111111',
        theme_color: '#111111',
      },
      workbox: { globPatterns: ['**/*.{js,css,html,json}'] },
    }),
  ],
});
