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
        sans: ["var(--font-geist-sans)", "system-ui", "-apple-system", "sans-serif"],
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        "marketing-sm": "var(--shadow-sm)",
        "marketing-md": "var(--shadow-md)",
      },
      maxWidth: {
        page: "1280px",
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)",
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
