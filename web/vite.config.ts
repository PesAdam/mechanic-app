import { createReadStream, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const YEAR = 60 * 60 * 24 * 365

/** OCR for "Diely zo screenshotu" (src/lib/ocr.ts): engine, worker and Slovak model, served at /tesseract/ out of node_modules. */
const TESSERACT: Record<string, string> = {
  'worker.min.js': 'tesseract.js/dist/worker.min.js',
  'core/tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'core/tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'core/tesseract-core-relaxedsimd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'lang/slk.traineddata.gz': '@tesseract.js-data/slk/4.0.0_best_int/slk.traineddata.gz',
}
const fromModules = (path: string) => fileURLToPath(new URL(`./node_modules/${path}`, import.meta.url))

function tesseractAssets(): Plugin {
  return {
    name: 'tesseract-assets',
    configureServer(server) {
      server.middlewares.use('/tesseract', (req, res, next) => {
        const src = TESSERACT[(req.url ?? '').replace(/^\//, '').split('?')[0]]
        if (!src) return next()
        res.setHeader('Content-Type', src.endsWith('.js') ? 'text/javascript' : 'application/octet-stream')
        createReadStream(fromModules(src)).pipe(res)
      })
    },
    generateBundle() {
      for (const [path, src] of Object.entries(TESSERACT)) this.emitFile({ type: 'asset', fileName: `tesseract/${path}`, source: readFileSync(fromModules(src)) })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiTarget = env.API_PROXY_TARGET || 'http://127.0.0.1:8087'

  return {
    plugins: [
      react(),
      tesseractAssets(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'favicon.svg', 'icon.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          id: '/',
          name: 'Dielňa · správa autoopráv',
          short_name: 'Dielňa',
          description: 'Zákazky, stopky, diely, fotky a reporty pre malú autodielňu.',
          lang: 'sk',
          start_url: '/m',
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
            { name: 'Dielňa dnes', short_name: 'Dielňa', url: '/m', icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
            { name: 'Prehľad', short_name: 'Prehľad', url: '/admin', icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          // The OCR engine (several MB) is fetched on the first scan, not with every install of the app.
          globIgnores: ['tesseract/**'],
          navigateFallback: '/index.html',
          // API and uploaded files are never the SPA shell. Portal pages come from the server, which names the
          // portal's own manifest in them (start /portal), so "add to home screen" there never starts at /m.
          navigateFallbackDenylist: [/^\/api\//, /^\/storage\//, /^\/portal(\/|$)/, /^\/pozvanka\//],
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
            {
              // Photos and diagnostic files uploaded to the API's public disk.
              urlPattern: ({ url }) => url.pathname.startsWith('/storage/'),
              handler: 'CacheFirst',
              options: { cacheName: 'uploads', expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 }, cacheableResponse: { statuses: [0, 200] } },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    server: {
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/storage': { target: apiTarget, changeOrigin: true },
      },
    },
    // `npm run preview` (PWA build on localhost) talks to the same local API.
    preview: {
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/storage': { target: apiTarget, changeOrigin: true },
      },
    },
  }
})
