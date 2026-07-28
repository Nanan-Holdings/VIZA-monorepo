import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";

// Switzer -- used for all headings/titles (h1-h6, display text)
export const switzer = localFont({
  src: [
    {
      path: "../public/fonts/switzer/Switzer-Variable.woff2",
      style: "normal",
    },
    {
      path: "../public/fonts/switzer/Switzer-VariableItalic.woff2",
      style: "italic",
    },
  ],
  variable: "--font-switzer",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

// Geist Sans -- used for all body/display/UI text
export const geist = GeistSans;
