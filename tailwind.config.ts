import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["'Poppins'", "system-ui", "sans-serif"],
        display: ["'Poppins'", "system-ui", "sans-serif"],
        brand: ["'Poppins'", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          glow: "hsl(var(--secondary-glow))",
          text: "hsl(var(--secondary-text))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        oldPrice: {
          DEFAULT: "hsl(var(--old-price))",
          foreground: "hsl(var(--old-price-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        whatsapp: {
          DEFAULT: "hsl(var(--whatsapp))",
          foreground: "hsl(var(--whatsapp-foreground))",
          hover: "hsl(var(--whatsapp-hover))",
        },
        "brand-cyan": {
          DEFAULT: "hsl(var(--brand-cyan))",
          foreground: "hsl(var(--brand-cyan-foreground))",
          text: "hsl(var(--brand-cyan-text))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      fontSize: {
        /* Escala semântica principal — hierarquia de display/body */
        "display-lg": ["2.5rem",   { lineHeight: "1.15", fontWeight: "700" }],
        "display-md": ["2rem",     { lineHeight: "1.2",  fontWeight: "700" }],
        "display-sm": ["1.5rem",   { lineHeight: "1.25", fontWeight: "600" }],
        "display-xs": ["1.625rem", { lineHeight: "1.15", fontWeight: "800" }],
        "body-lg":    ["1.125rem", { lineHeight: "1.7",  fontWeight: "400" }],
        "body-md":    ["1rem",     { lineHeight: "1.7",  fontWeight: "400" }],
        "body-sm":    ["0.875rem", { lineHeight: "1.6",  fontWeight: "400" }],
        "label":      ["0.75rem",  { lineHeight: "1.4",  fontWeight: "500", letterSpacing: "0.04em" }],

        /* Micro-escala — substitui text-[10px]/[11px]/[13px]/[17px] arbitrários.
           Uso:
             text-2xs   → badges, captions, "no PIX", contadores (11px)
             text-sm-plus → chips de categoria, meta de card, checkout-label (13px)
             text-price → preço PIX mobile (17px); desktop usa text-xl (20px = exact) */
        "2xs":      ["0.6875rem", { lineHeight: "1.4", fontWeight: "500" }],
        "sm-plus":  ["0.8125rem", { lineHeight: "1.5" }],
        "price":    ["1.0625rem", { lineHeight: "1",   fontWeight: "800" }],
      },
      borderRadius: {
        /* Sistema de radius semântico — use os nomes em vez de valores ad-hoc.
           Referência:
             rounded-sm   → 0.5rem  — micro-elementos (indicadores, pills pequenos)
             rounded-md   → 0.6875rem — uso interno
             rounded-lg   → 0.75rem — var(--radius) — botões, inputs
             rounded-card → 1rem    — product cards, drawers
             rounded-hero → 1.5rem  — hero sections, modais grandes */
        lg:   "var(--radius)",
        md:   "calc(var(--radius) - 2px)",
        sm:   "calc(var(--radius) - 4px)",
        card: "1rem",
        hero: "1.5rem",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-hero":    "var(--gradient-hero)",
        "gradient-cta":     "var(--gradient-cta)",
        "gradient-price":   "var(--gradient-price)",
        "gradient-soft":    "var(--gradient-soft)",
        "gradient-brand":   "var(--gradient-brand)",
      },
      boxShadow: {
        /* Hierarquia de elevação — use na ordem abaixo (do menor para o maior).
           shadow-soft     → separadores, divisores sutis
           shadow-card     → card em repouso
           shadow-elegant  → card elevado, dropdowns
           shadow-pop      → estado hover de cards
           shadow-cta      → botão de ação principal (CTA laranja) */
        elegant: "var(--shadow-elegant)",
        card:    "var(--shadow-card)",
        soft:    "var(--shadow-soft)",
        pop:     "var(--shadow-pop)",
        cta:     "var(--shadow-cta)",
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%":   { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-up": {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in":        "fade-in 0.4s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-up":       "slide-up 0.35s ease-out",
        "scale-in":       "scale-in 0.25s ease-out",
        shimmer:          "shimmer 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
