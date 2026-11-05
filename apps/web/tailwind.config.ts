import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--bg) / <alpha-value>)",
        foreground: "rgb(var(--fg) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        "muted-foreground": "rgb(var(--muted-fg) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-foreground": "rgb(var(--primary-fg) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-foreground": "rgb(var(--accent-fg) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        "code-bg": "rgb(var(--code-bg) / <alpha-value>)",
        // Green brand ramp from the Taste Skill deal (accent #0f7d45 family).
        brand: {
          50: "#eef7f2",
          100: "#d9ecdf",
          200: "#b0dabb",
          300: "#7cc49c",
          400: "#46a96f",
          500: "#2f8f57",
          600: "#0f7d45",
          700: "#0c6b39",
          800: "#0d5530",
          900: "#0f4527",
          950: "#072a19",
        },
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cad5e2",
          400: "#90a1b9",
          500: "#62748e",
          600: "#45556c",
          700: "#314158",
          800: "#1d293d",
          900: "#0f172b",
          950: "#020618",
        },
      },
      fontFamily: {
        display: ['"Mona Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: [
          "Mona Sans",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        "display-sm": ["2.5rem", { lineHeight: "1.06", letterSpacing: "-0.032em" }],
        "display": ["4rem", { lineHeight: "1.08", letterSpacing: "-0.032em" }],
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "12px",
        md: "12px",
        lg: "20px",
        xl: "20px",
        "2xl": "20px",
        "3xl": "24px",
      },
      maxWidth: {
        content: "1280px",
      },
      spacing: {
        18: "4.5rem",
        30: "7.5rem",
        36: "9rem",
      },
      boxShadow: {
        subtle: "0 1px 2px rgb(43 38 34 / 0.04), 0 8px 24px -18px rgb(43 38 34 / 0.25)",
        card: "0 1px 2px #2b26220a, 0 12px 32px -20px #2b262247",
        overlay: "0 2px 6px #2b26220f, 0 32px 72px -32px #2b262266",
        glow: "0 4px 48px -12px rgb(15 125 69), inset 0 1px 8px -4px #fff",
        "glow-sm": "0 2px 24px -10px rgb(15 125 69 / 0.9)",
        "inner-ring": "inset 0 0 0 1px rgb(255 255 255 / 0.18)",
      },
      backgroundImage: {
        grid: "linear-gradient(to right, rgb(var(--border) / 0.7) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--border) / 0.7) 1px, transparent 1px)",
        "brand-gradient": "linear-gradient(135deg, #0f7d45 0%, #159a60 55%, #4cb87e 100%)",
        "brand-gradient-soft":
          "linear-gradient(140deg, rgb(238 247 242 / 0.9) 0%, rgb(255 255 255 / 0.6) 45%, rgb(217 236 223 / 0.8) 100%)",
        "hero-fade":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgb(15 125 69 / 0.16), transparent 70%)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
        "out-quad": "cubic-bezier(0, 0, 0.2, 1)",
      },
      transitionDuration: {
        150: "150ms",
      },
      keyframes: {
        "float-slow-anim": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "pulse-slow-anim": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.8" },
        },
        "line-pulse-travel-straight": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "20%": { opacity: "1" },
          "80%": { opacity: "1" },
          "100%": { transform: "translateX(100%)", opacity: "0" },
        },
        "line-pulse-travel-corner": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "25%": { opacity: "1" },
          "75%": { opacity: "1" },
          "100%": { transform: "translateY(100%)", opacity: "0" },
        },
        "border-ring-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgb(15 125 69 / 0.35)" },
          "50%": { boxShadow: "0 0 0 6px rgb(15 125 69 / 0)" },
        },
        "mascot-peek-anim": {
          "0%, 100%": { transform: "translateY(6px) rotate(-2deg)" },
          "50%": { transform: "translateY(-4px) rotate(2deg)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "float-slow": "float-slow-anim 6s ease-in-out infinite",
        "pulse-slow": "pulse-slow-anim 5s ease-in-out infinite",
        "line-pulse": "line-pulse-travel-straight 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "line-pulse-corner":
          "line-pulse-travel-corner 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "border-ring": "border-ring-pulse 2.6s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "mascot-peek": "mascot-peek-anim 4s ease-in-out infinite",
        "fade-up": "fade-up 0.5s cubic-bezier(0, 0, 0.2, 1) both",
      },
    },
  },
  plugins: [typography],
} satisfies Config;
