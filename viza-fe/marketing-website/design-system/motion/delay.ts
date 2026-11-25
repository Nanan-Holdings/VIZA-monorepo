import type { CSSProperties } from "react";

/** Inline style for a reveal delay in seconds (read by motion.css as --d). */
export const delay = (seconds: number): CSSProperties => ({ ["--d"]: `${seconds}s` }) as CSSProperties;

/** Stagger for the nth card in a grid: 0.05s apart, capped so long grids do not lag. */
export const stagger = (index: number, step = 0.05): CSSProperties => delay(Math.min(index, 6) * step);
