import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages sirve el proyecto en https://luiscrjs.github.io/gym/ (subruta = nombre del repo).
  // vite-plugin-pwa usa este base para el scope y start_url del manifest.
  base: '/gym/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': la versión nueva espera a que el usuario toque "Actualizar" (ver UpdatePrompt).
      registerType: 'prompt',
      includeAssets: ['plan.json', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gym Tracker',
        short_name: 'Gym',
        lang: 'es',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,json,png}'] },
    }),
  ],
});
