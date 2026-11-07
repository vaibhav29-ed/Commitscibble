import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

/**
 * Tailwind configuration for CommitScibble web app.
 *
 * The palette is driven by the RGB CSS variables in src/index.css so light and
 * dark themes stay in sync. Only tokens that the app actually consumes are
 * declared here: a utility that is missing from this file is silently dropped
 * from the compiled stylesheet.
 */
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
        inverse: "rgb(var(--inverse) / <alpha-value>)",
        "inverse-foreground": "rgb(var(--inverse-fg) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        "code-bg": "rgb(var(--code-bg) / <alpha-value>)",
        // Green brand ramp (#0f7d45 family) used for marketing accents.
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
      },
      fontFamily: {
        display: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      // Radii measured from the SuperCommands reference: 4 / 8 / 12.
      borderRadius: {
        sm: "4px",
        DEFAULT: "8px",
        md: "10px",
      },
      maxWidth: {
        content: "1280px",
      },
      boxShadow: {
        subtle: "0 1px 2px rgb(43 38 34 / 0.04), 0 8px 24px -18px rgb(43 38 34 / 0.25)",
        card: "0 1px 2px #2b26220a, 0 12px 32px -20px #2b262247",
        overlay: "0 2px 6px #2b26220f, 0 32px 72px -32px #2b262266",
        reference: "rgba(0,0,0,0.14) 0px 2px 4px 0px, rgba(0,0,0,0.1) 0px 8px 20px 0px",
        "reference-inset": "inset 0 1px 0 rgb(255 255 255 / 0.7), inset 0 0 0 1px rgb(0 0 0 / 0.04)",
        "dark-inset": "inset 0 1px 0 rgb(255 255 255 / 0.18), inset 0 -1px 0 rgb(0 0 0 / 0.12)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [typography],
} satisfies Config;
