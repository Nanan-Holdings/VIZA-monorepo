import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp, ease, pop } from "../components/anim";
import { SceneShell } from "../components/SceneShell";
import type { AcronymProps } from "../spec";
import { C, FONT, W } from "../theme";

/** Giant acronym lands as a row, then stacks and unfolds into its full words. */
export const Acronym: React.FC<{ props: AcronymProps; beats: number[]; zh: boolean }> = ({ props, zh }) => {
  const frame = useCurrentFrame();
  const letters = Array.from(props.acronym);
  const stack = ease(frame, 13, 16);
  const rowSize = 250;
  const stackSize = 128;
  const rowGap = 6;
  const letterW = rowSize * 0.66;
  const rowWidth = letters.length * letterW + (letters.length - 1) * rowGap;
  return (
    <SceneShell>
      <AbsoluteFill>
        {letters.map((ch, i) => {
          const p = pop(frame, i * 2, 11, 0.6);
          const rowX = (W - rowWidth) / 2 + i * (letterW + rowGap);
          const rowY = 560;
          const stX = 120;
          const stY = 330 + i * 150;
          const x = interpolate(stack, [0, 1], [rowX, stX]);
          const y = interpolate(stack, [0, 1], [rowY, stY]);
          const size = interpolate(stack, [0, 1], [rowSize, stackSize]);
          const tail = (props.words[i] ?? "").slice(1);
          const tailP = ease(frame, 22 + i * 3, 12);
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "baseline", whiteSpace: "nowrap" }}>
              <span
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 700,
                  fontSize: size,
                  lineHeight: 1,
                  color: C.navy,
                  letterSpacing: "-0.04em",
                  display: "inline-block",
                  transform: `translateY(${interpolate(p, [0, 1], [-260, 0])}px) rotate(${interpolate(p, [0, 1], [-12, 0])}deg)`,
                  opacity: interpolate(frame - i * 2, [0, 4], [0, 1], clamp),
                }}
              >
                {ch}
              </span>
              <span
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 500,
                  fontSize: interpolate(stack, [0, 1], [78, 104]),
                  color: C.ink,
                  letterSpacing: "-0.03em",
                  clipPath: `inset(0 ${100 - tailP * 100}% 0 0)`,
                  marginLeft: 2,
                }}
              >
                {tail}
              </span>
            </div>
          );
        })}
        {props.note && (
          <div
            style={{
              position: "absolute",
              left: 120,
              right: 84,
              top: 1060,
              fontFamily: zh ? FONT.zh : FONT.body,
              fontWeight: 500,
              fontSize: 46,
              color: C.navy,
              opacity: ease(frame, 10, 12),
              transform: `translateY(${interpolate(ease(frame, 10, 12), [0, 1], [20, 0])}px)`,
            }}
          >
            {props.note}
          </div>
        )}
      </AbsoluteFill>
    </SceneShell>
  );
};
