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
          /* Variante AA-safe para uso como TEXTO sobre fundo claro */
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
          /* Variante AA-safe para uso como TEXTO sobre fundo claro (6.2:1). */
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
        /* Escala tipográfica semântica — garante hierarquia consistente
           em toda a loja sem depender de classes Tailwind arbitrárias.
           Uso: text-display-lg (hero), text-display-md (section titles),
           text-body-md (paragraphs), text-label (chips, badges). */
        "display-lg": ["2.5rem",  { lineHeight: "1.15", fontWeight: "700" }],
        "display-md": ["2rem",    { lineHeight: "1.2",  fontWeight: "700" }],
        "display-sm": ["1.5rem",  { lineHeight: "1.25", fontWeight: "600" }],
        "display-xs": ["1.625rem",{ lineHeight: "1.15", fontWeight: "800" }],
        "body-lg":    ["1.125rem",{ lineHeight: "1.7",  fontWeight: "400" }],
        "body-md":    ["1rem",    { lineHeight: "1.7",  fontWeight: "400" }],
        "body-sm":    ["0.875rem",{ lineHeight: "1.6",  fontWeight: "400" }],
        "label":      ["0.75rem", { lineHeight: "1.4",  fontWeight: "500", letterSpacing: "0.04em" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-hero": "var(--gradient-hero)",
        "gradient-cta": "var(--gradient-cta)",
        "gradient-price": "var(--gradient-price)",
        "gradient-soft": "var(--gradient-soft)",
        "gradient-brand": "var(--gradient-brand)",
      },
      boxShadow: {
        elegant: "var(--shadow-elegant)",
        card: "var(--shadow-card)",
        soft: "var(--shadow-soft)",
        pop: "var(--shadow-pop)",
        cta: "var(--shadow-cta)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        shimmer: "shimmer 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
