import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Ananda Taskboard — PWA, dev-proxies /api to Django on :8000.
// Architected Capacitor-ready: the built dist/ is a static bundle that Capacitor
// can wrap later (Phase B) with no source changes.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Ananda Taskboard',
        short_name: 'Taskboard',
        description: 'Team task board — projects, sub-projects, tasks.',
        theme_color: '#C8762F',
        background_color: '#FAF7F2',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell offline; API calls are network-first (never cache task data stale).
        navigateFallback: '/index.html',
        importScripts: ['push-sw.js'], // custom push + notificationclick handlers
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
