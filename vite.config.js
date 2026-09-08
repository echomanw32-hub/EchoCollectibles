import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ command }) => ({
  // Camera access (getUserMedia) is blocked by browsers on any non-HTTPS,
  // non-localhost origin. If you test on a phone via your computer's LAN IP
  // (e.g. http://192.168.x.x:5173), the camera will silently fail without
  // this — basic-ssl gives `npm run dev` a (self-signed, dev-only) HTTPS
  // cert so phone testing actually works. Your browser will show a
  // "not secure" warning on first visit — that's expected, just proceed.
  server: command === 'serve' ? { host: true } : undefined,
  plugins: [
    react(),
    command === 'serve' && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'EchoCollectibles',
        short_name: 'EchoCollectibles',
        description: 'Scan, price, and track your collections',
        theme_color: '#14181a',
        background_color: '#14181a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ].filter(Boolean)
}))
