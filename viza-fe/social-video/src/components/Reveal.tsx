import React from "react";
import { useCurrentFrame } from "remotion";
import { clamp, pop, splitUnits } from "./anim";
import { interpolate } from "remotion";

type Props = {
  text: string;
  delay?: number;
  stagger?: number;
  style?: React.CSSProperties;
  /** Words (case-insensitive) drawn in the accent colour. */
  accent?: string[];
  accentColor?: string;
};

/** Kinetic type: each word (or CJK character) rises out of a mask with a spring. */
export const Reveal: React.FC<Props> = ({ text, delay = 0, stagger = 2.2, style, accent = [], accentColor }) => {
  const frame = useCurrentFrame();
  const units = splitUnits(text);
  const accentSet = new Set(accent.map((a) => a.toLowerCase()));
  let i = 0;
  return (
    <span style={{ display: "inline", ...style }}>
      {units.map((u, idx) => {
        if (/^\s+$/.test(u)) return <span key={idx}>{" "}</span>;
        const d = delay + i * stagger;
        i += 1;
        const p = pop(frame, d, 15, 0.55);
        const y = interpolate(p, [0, 1], [105, 0]);
        const blur = interpolate(frame - d, [0, 6], [8, 0], clamp);
        const bare = u.toLowerCase().replace(/[.,?!，。？！]/g, "");
        const isAccent = accentSet.has(bare) || (/[\u3400-\u9fff]/.test(bare) && accent.some((a) => a.includes(bare)));
        return (
          <span
            key={idx}
            style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.08em", marginBottom: "-0.08em" }}
          >
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${y}%)`,
                filter: `blur(${blur}px)`,
                color: isAccent ? accentColor : undefined,
              }}
            >
              {u}
            </span>
          </span>
        );
      })}
    </span>
  );
};
