import { defineConfig } from '@vite-pwa/assets-generator/config'

// One full-bleed SVG → every PNG the manifest and iOS need. The glyph sits
// inside the maskable safe zone already, so no extra padding is added.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0, resizeOptions: { background: '#5980a6' } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#5980a6' } },
  },
  images: ['public/icon.svg'],
})
