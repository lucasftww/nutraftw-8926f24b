import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => ({
  server: { host: "::", port: 8080 },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      includeAssets: [
        "apple-touch-icon.png",
        "logo-royalvita.png",
      ],
      manifest: {
        name: "Royal Vita - Farmácia Internacional",
        short_name: "Royal Vita",
        description:
          "Importação de medicamentos com segurança, rapidez e preço justo.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#0B1F6B",
        categories: ["shopping", "medical", "health"],
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        shortcuts: [
          { name: "Catálogo", url: "/catalogo" },
          { name: "Carrinho", url: "/checkout" },
          { name: "Favoritos", url: "/favoritos" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"],
        // Não pré-cachear bundles do painel administrativo — eles só
        // interessam ao admin e somam ~155 kB de download desnecessário
        // para clientes finais.
        globIgnores: [
          "**/Admin-*.js",
          "**/AdminLogin-*.js",
          "**/AdminHealth-*.js",
          "**/AdminProducts-*.js",
          "**/WeeklyReport-*.js",
          "**/WeeklyReportCharts-*.js",
          "**/charts-vendor-*.js",
          "**/dnd-vendor-*.js",
          "**/date-vendor-*.js",
        ],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/admin/,
          /^\/api/,
          /\/functions\/v1\//,
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // CRÍTICO: HTML/navegação sempre tenta a rede primeiro.
            // Sem isto, o navigateFallback cacheado serve a versão antiga
            // do index.html mesmo após um deploy novo — usuário precisa
            // limpar cache pra ver atualização.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "royalvita-html",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "royalvita-images",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // JS/CSS fora do precache (chunks pesados/raros) são cacheados
            // sob demanda. Mantém first-load enxuto e acelera visitas
            // subsequentes sem fixar todos os bundles no install do SW.
            urlPattern: ({ request, url }) =>
              (request.destination === "script" || request.destination === "style") &&
              url.origin === self.location.origin,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "royalvita-assets",
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/rest/v1/") ||
              url.hostname.endsWith("supabase.co"),
            handler: "NetworkFirst",
            options: {
              cacheName: "royalvita-api",
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    // Vendor splitting estável → cache de longo prazo entre deploys.
    // Mudanças de código de aplicação não invalidam o chunk de bibliotecas,
    // que costuma ser o maior bundle e o mais caro de baixar.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (
            id.includes("/recharts/") ||
            id.includes("\\recharts\\")
          ) {
            return "charts-vendor";
          }
          if (
            id.includes("/date-fns/") ||
            id.includes("\\date-fns\\")
          ) {
            return "date-vendor";
          }
          if (
            id.includes("/@dnd-kit/") ||
            id.includes("\\@dnd-kit\\")
          ) {
            return "dnd-vendor";
          }
          if (
            id.includes("/react-router-dom/") ||
            id.includes("\\react-router-dom\\") ||
            id.includes("/react-dom/") ||
            id.includes("\\react-dom\\") ||
            id.includes("/react/") ||
            id.includes("\\react\\")
          ) {
            return "react-vendor";
          }
          if (
            id.includes("/@tanstack/react-query/") ||
            id.includes("\\@tanstack\\react-query\\")
          ) {
            return "query-vendor";
          }
          if (
            id.includes("/@supabase/supabase-js/") ||
            id.includes("\\@supabase\\supabase-js\\")
          ) {
            return "supabase-vendor";
          }
          if (
            id.includes("/lucide-react/") ||
            id.includes("\\lucide-react\\") ||
            id.includes("/sonner/") ||
            id.includes("\\sonner\\")
          ) {
            return "ui-vendor";
          }
        },
      },
    },
  },
}));
