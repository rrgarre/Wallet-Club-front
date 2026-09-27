import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': al haber versión nueva se MUESTRA un aviso con botón
      // "Recargar" en vez de recargar sola la app (nada de tirar una captura
      // a medias por actualizarse el front).
      registerType: 'prompt',
      // El registro lo hace main.jsx (useRegisterSW) para poder pintar el aviso:
      // si el plugin también lo inyectara, se registraría dos veces.
      injectRegister: null,
      manifest: {
        id: '/',
        name: 'Wallet Club',
        short_name: 'Wallet Club',
        description: 'Captura de puntos de Wallet Club: comercios, camareros y clientes.',
        lang: 'es',
        start_url: '/comercio/escanear', // pantalla de batalla de los camareros
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1f6feb',
        background_color: '#f4f6f9',
        categories: ['business', 'finance'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        // Precache de TODO el build (index + JS/CSS + iconos): la app abre al
        // instante y aguanta caídas breves del servidor.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        // Rutas (history): si el servidor no contesta, se sirve el index cacheado.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/sw\.js$/, /^\/manifest\.webmanifest$/],
        // SIN runtimeCaching: la API es otra origen y NUNCA se cachea.
        // Los puntos siempre van a la red; sin conexión, aviso de error.
      },
      devOptions: { enabled: false }, // se prueba con `npm run preview`
    }),
  ],
  server: { port: 5173 },
});
