import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, H, W } from "../theme";

/** Passport-paper ground: off-white with slowly drifting guilloche lines and a soft navy glow. */
export const Background: React.FC<{ dark?: number }> = ({ dark = 0 }) => {
  const frame = useCurrentFrame();
  const lines = 14;
  const paths: string[] = [];
  for (let l = 0; l < lines; l++) {
    const amp = 38 + l * 3;
    const yBase = 260 + l * 105;
    const phase = frame / 70 + l * 0.55;
    let d = `M -40 ${yBase}`;
    for (let x = -40; x <= W + 40; x += 24) {
      const y = yBase + Math.sin(x / 140 + phase) * amp * Math.sin(phase * 0.35 + l);
      d += ` L ${x} ${y.toFixed(1)}`;
    }
    paths.push(d);
  }
  return (
    <AbsoluteFill style={{ backgroundColor: C.shell }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1100px 900px at 85% 8%, rgba(3,52,110,0.10), transparent 60%), radial-gradient(900px 900px at 0% 100%, rgba(3,52,110,0.08), transparent 60%)`,
        }}
      />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={C.navy} strokeOpacity={0.055} strokeWidth={1.6} />
        ))}
      </svg>
      <AbsoluteFill style={{ backgroundColor: C.navy, opacity: dark }} />
    </AbsoluteFill>
  );
};
