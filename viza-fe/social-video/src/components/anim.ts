import { Easing, interpolate, spring } from "remotion";

export const FPS = 30;

/** Snappy spring used for most entrances. Returns 0..1 (can overshoot slightly). */
export const pop = (frame: number, delay = 0, damping = 14, mass = 0.6) =>
  spring({ frame: frame - delay, fps: FPS, config: { damping, mass, stiffness: 160 } });

/** Smooth spring without overshoot. */
export const ease = (frame: number, delay = 0, durationInFrames = 18) =>
  spring({ frame: frame - delay, fps: FPS, durationInFrames, config: { damping: 200 } });

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const lerp = (frame: number, from: number, to: number, a: number, b: number, easing = Easing.bezier(0.22, 1, 0.36, 1)) =>
  interpolate(frame, [from, to], [a, b], { ...clamp, easing });

export const sec = (s: number) => Math.round(s * FPS);

/** Split text into animatable units: words for Latin text, characters for CJK (keeping Latin runs together). */
export const splitUnits = (text: string): string[] => {
  const hasCjk = /[㐀-鿿]/.test(text);
  if (!hasCjk) return text.split(/(\s+)/).filter((t) => t.length > 0);
  const out: string[] = [];
  const re = /[A-Za-z0-9€$.%+\-/]+|\s+|./gu;
  for (const m of text.matchAll(re)) out.push(m[0]);
  return out;
};
