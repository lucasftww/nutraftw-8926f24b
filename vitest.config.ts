import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    // e2e/** é Playwright (browser-based) — não roda no jsdom do vitest
    exclude: ['scripts/**', 'node_modules/**', 'e2e/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // Inclui apenas código de aplicação. UI gerada (shadcn), configs e
      // bootstrap não contam para o threshold — métrica fica honesta.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/components/ui/**',
        'src/integrations/supabase/types.ts',
        'src/__tests__/**',
        '**/*.config.*',
        '**/*.d.ts',
        'src/main.tsx',
        'src/vite-env-pwa.d.ts',
      ],
      // Threshold inicial conservador — sobe à medida que adicionamos
      // testes nas áreas críticas (checkoutMath, validators, cart-store).
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 25,
        statements: 30,
      },
    },
  },
})
