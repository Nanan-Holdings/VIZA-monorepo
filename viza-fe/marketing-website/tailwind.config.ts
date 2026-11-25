import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Display"', "var(--font-geist-sans)", "system-ui", "-apple-system", "sans-serif"],
        body: ['"Inter Display"', "var(--font-geist-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-switzer)", "system-ui", "sans-serif"],
        geist: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        heading: ["var(--font-switzer)", "system-ui", "sans-serif"],
        switzer: ["var(--font-switzer)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          "50": "#EEF3FA",
          "100": "#D4E0F0",
          "200": "#AABFDF",
          "300": "#7A9DCE",
          "400": "#3D6DAD",
          "500": "#03346E",
          "600": "#022B5C",
          "700": "#01214A",
          "800": "#011737",
          "900": "#000D21",
          DEFAULT: "#03346E",
        },
        shell: "var(--shell-bg)",
        // Design system tokens (design-system/tokens.css), from the Framer reference.
        canvas: "var(--ds-canvas)",
        surface: "var(--ds-surface)",
        "surface-muted": "var(--ds-surface-muted)",
        ink: "var(--ds-ink)",
        "ink-muted": "var(--ds-ink-muted)",
        "ink-faint": "var(--ds-ink-faint)",
        line: "var(--ds-line)",
        accent: { DEFAULT: "var(--ds-accent)", hover: "var(--ds-accent-hover)", soft: "var(--ds-accent-soft)" },
        page: "var(--page-bg)",
        card: "var(--card-bg)",
        "surface-subtle": "var(--surface-subtle)",
        "surface-locked": "var(--surface-locked)",
        "fg-1": "var(--fg-1)",
        "fg-2": "var(--fg-2)",
        "fg-3": "var(--fg-3)",
        "fg-label": "var(--fg-label)",
        "fg-on-brand": "var(--fg-on-brand)",
        "fg-on-brand-dim": "var(--fg-on-brand-dim)",
        "border-hairline": "var(--border-hairline)",
        "border-input": "var(--border-input)",
        success: "var(--success)",
        "warning-bg": "var(--warning-bg)",
        "warning-fg": "var(--warning-fg)",
        destructive: "var(--destructive)",
        // Third-party brand color — required for WeChat Pay CTA per
        // their brand guide. Not for general use.
        wechat: {
          DEFAULT: "#07C160",
          hover: "#06AD56",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        pill: "var(--radius-pill)",
        frame: "var(--ds-r-frame)",
        band: "var(--ds-r-band)",
        card: "var(--ds-r-card)",
        "card-sm": "var(--ds-r-card-sm)",
        media: "var(--ds-r-media)",
        input: "var(--ds-r-input)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        "marketing-sm": "var(--shadow-sm)",
        "marketing-md": "var(--shadow-md)",
      },
      maxWidth: {
        page: "1280px",
        ds: "var(--ds-max)",
      },
      spacing: {
        gutter: "var(--ds-gutter)",
        section: "var(--ds-section-y)",
      },
      fontSize: {
        "ds-hero": ["var(--ds-fs-hero)", { lineHeight: "1.12", letterSpacing: "-0.04em" }],
        "ds-h2": ["var(--ds-fs-h2)", { lineHeight: "1.12", letterSpacing: "-0.04em" }],
        "ds-statement": ["var(--ds-fs-statement)", { lineHeight: "1.12", letterSpacing: "-0.04em" }],
        "ds-title": ["var(--ds-fs-title)", { lineHeight: "1.25", letterSpacing: "-0.04em" }],
        "ds-body": ["var(--ds-fs-body)", { lineHeight: "1.32", letterSpacing: "-0.02em" }],
        "ds-small": ["var(--ds-fs-small)", { lineHeight: "1.24", letterSpacing: "-0.02em" }],
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)",
        spring: "var(--ds-ease-spring)",
        hover: "var(--ds-ease-hover)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
        nav: "var(--dur-nav)",
      },
    },
  },
  plugins: [],
};

export default config;
