import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        error: {
          DEFAULT:    "hsl(var(--error))",
          foreground: "hsl(var(--error-foreground))",
        },
        success: {
          DEFAULT:    "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg:   "var(--radius)",
        md:   "calc(var(--radius) - 2px)",
        sm:   "calc(var(--radius) - 4px)",
        xl:   "calc(var(--radius) + 4px)",
        "2xl":"calc(var(--radius) + 8px)",
      },
      backgroundImage: {
        "glass-gradient":
          "linear-gradient(135deg, hsl(210 40% 98% / 0.07) 0%, transparent 60%)",
        "brand-gradient":
          "linear-gradient(135deg, hsl(192 100% 58%) 0%, hsl(240 80% 65%) 50%, hsl(265 80% 68%) 100%)",
        "card-shine":
          "linear-gradient(135deg, hsl(210 40% 98% / 0.05) 0%, transparent 50%)",
      },
      boxShadow: {
        glass:       "inset 0 1px 0 hsl(210 40% 98% / 0.05), 0 4px 32px hsl(0 0% 0% / 0.35)",
        "glass-lg":  "inset 0 1px 0 hsl(210 40% 98% / 0.07), 0 8px 48px hsl(0 0% 0% / 0.50)",
        "glass-sm":  "inset 0 1px 0 hsl(210 40% 98% / 0.04), 0 2px 16px hsl(0 0% 0% / 0.28)",
        "glow-cyan": "0 0 30px hsl(192 100% 58% / 0.30)",
        "glow-brand":"0 0 40px hsl(192 100% 58% / 0.22), 0 0 80px hsl(265 80% 68% / 0.12)",
        "premium":   "0 0 0 1px hsl(192 100% 58% / 0.10), 0 8px 40px hsl(192 100% 58% / 0.14)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
