import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// Versão do build — usada como sufixo dos cache names do Service Worker.
// Cada build gera um identificador único; quando o SW novo ativa, os caches
// antigos (com sufixo diferente) são apagados pelo cleanup em src/main.tsx.
// Workbox já faz `cleanupOutdatedCaches` para o precache, mas os caches de
// runtime têm nomes estáticos — sem versionar, eles persistiam entre deploys.
const BUILD_VERSION =
  process.env.BUILD_VERSION ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.COMMIT_REF ||
  process.env.GITHUB_SHA ||
  String(Date.now());
const V = BUILD_VERSION.slice(0, 12);

export default defineConfig(() => ({
  server: { host: "::", port: 8080 },
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
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
        // BUG FIX: `purpose: "any maskable"` é incorreto pela spec W3C —
        // cada purpose deve ser uma entrada separada. Como o ícone atual
        // (pwa-512.png) não tem o safe-zone de ~10% para maskable, removemos
        // a variante maskable até existir um pwa-512-maskable.png próprio.
        // Sem isso, launchers Android cortavam o conteúdo central do ícone.
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
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
              cacheName: `royalvita-html-${V}`,
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: `royalvita-images-${V}`,
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
            //
            // BUG FIX: `self.location.origin` era avaliado em tempo de BUILD
            // (Node.js), onde `self` não existe — a regra nunca aplicava JS/CSS
            // do próprio site. Substituído por exclusão de hosts externos
            // conhecidos (Supabase, fontes Google) — pega tudo o que sobra,
            // incluindo o próprio domínio em qualquer preview Vercel.
            urlPattern: ({ request, url }) =>
              (request.destination === "script" || request.destination === "style") &&
              !url.hostname.includes("supabase.co") &&
              !url.hostname.includes("googleapis.com") &&
              !url.hostname.includes("gstatic.com"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: `royalvita-assets-${V}`,
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
              cacheName: `google-fonts-${V}`,
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
              cacheName: `royalvita-api-${V}`,
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
