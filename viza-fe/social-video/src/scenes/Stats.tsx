import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp, ease, pop } from "../components/anim";
import { Reveal } from "../components/Reveal";
import { beat, SceneShell } from "../components/SceneShell";
import type { StatsProps } from "../spec";
import { C, FONT } from "../theme";

/** Up to three fact cards, each landing on its own voice beat, with count-ups. */
export const Stats: React.FC<{ props: StatsProps; beats: number[]; zh: boolean }> = ({ props, beats, zh }) => {
  const frame = useCurrentFrame();
  return (
    <SceneShell>
      <AbsoluteFill>
        {props.title && (
          <div style={{ position: "absolute", left: 84, right: 84, top: 270, fontFamily: zh ? FONT.zh : FONT.display, fontWeight: 600, fontSize: 50, color: C.navy, letterSpacing: zh ? 0 : "-0.02em" }}>
            <Reveal text={props.title} delay={0} />
          </div>
        )}
        {props.items.map((it, i) => {
          const b = beat(beats, i, i * 30);
          const p = pop(frame, b, 14, 0.6);
          const count = it.countTo !== undefined ? Math.round(interpolate(frame, [b + 3, b + 22], [0, it.countTo], clamp)) : null;
          const value = count !== null ? `${it.prefix ?? ""}${count}${it.suffix ?? ""}` : it.value;
          const strikeP = ease(frame, b + 14, 10);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 84,
                right: 84,
                top: 380 + i * 262,
                height: 236,
                borderRadius: 34,
                background: i === 0 ? C.navy : C.card,
                border: i === 0 ? "none" : `2px solid ${C.hairline}`,
                boxShadow: "0 24px 60px rgba(3,52,110,0.10)",
                display: "flex",
                alignItems: "center",
                padding: "0 48px",
                gap: 40,
                opacity: interpolate(frame - b, [0, 4], [0, 1], clamp),
                transform: `translateY(${interpolate(p, [0, 1], [120, 0])}px) rotate(${interpolate(p, [0, 1], [3, 0])}deg)`,
              }}
            >
              <div style={{ minWidth: 330, display: "flex", flexDirection: "column" }}>
                {it.struck && (
                  <span style={{ position: "relative", alignSelf: "flex-start", fontFamily: FONT.display, fontWeight: 600, fontSize: 44, color: i === 0 ? "rgba(255,255,255,0.55)" : C.muted }}>
                    {it.struck}
                    <span style={{ position: "absolute", left: -4, top: "52%", height: 5, background: C.alert, width: `calc(${strikeP * 100}% + 8px)` }} />
                  </span>
                )}
                <span
                  style={{
                    fontFamily: zh && !/^[\d€$]/.test(value) ? FONT.zh : FONT.display,
                    fontWeight: 700,
                    fontSize: 132,
                    lineHeight: 1,
                    letterSpacing: "-0.05em",
                    color: i === 0 ? "#fff" : C.navy,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {value}
                </span>
              </div>
              <div style={{ fontFamily: zh ? FONT.zh : FONT.body, fontWeight: 500, fontSize: 40, lineHeight: 1.25, color: i === 0 ? "rgba(255,255,255,0.88)" : C.ink }}>
                {it.label}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </SceneShell>
  );
};
