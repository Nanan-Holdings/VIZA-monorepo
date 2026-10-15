import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp } from "./anim";

/** Shared exit motion: the scene lifts and fades in its last frames so the next one can land. */
export const SceneShell: React.FC<{ children: React.ReactNode; exit?: boolean }> = ({ children, exit = true }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const out = exit ? interpolate(frame, [durationInFrames - 9, durationInFrames], [0, 1], clamp) : 0;
  return (
    <AbsoluteFill
      style={{
        opacity: 1 - out,
        transform: `translateY(${-70 * out}px) scale(${1 - 0.04 * out})`,
        filter: `blur(${out * 6}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const beat = (beats: number[], i: number, fallback = 0) => beats[i] ?? beats[beats.length - 1] ?? fallback;
