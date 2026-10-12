import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const YEAR = 60 * 60 * 24 * 365

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Dielňa · správa autoopráv',
        short_name: 'Dielňa',
        description: 'Zákazky, stopky, diely, fotky a reporty pre malú autodielňu.',
        lang: 'sk',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f2f2f3',
        theme_color: '#f2f2f3',
        categories: ['business', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Dielňa dnes', short_name: 'Dielňa', url: '/', icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Prehľad', short_name: 'Prehľad', url: '/prehlad', icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css', expiration: { maxEntries: 10, maxAgeSeconds: YEAR } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-files', expiration: { maxEntries: 30, maxAgeSeconds: YEAR }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
