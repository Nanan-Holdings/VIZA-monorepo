import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp, ease, lerp, pop } from "../components/anim";
import { Reveal } from "../components/Reveal";
import { beat, SceneShell } from "../components/SceneShell";
import type { TimelineProps } from "../spec";
import { C, FONT } from "../theme";

/** Vertical timeline: a marker runs down past slipped dates, then settles on the current target. */
export const Timeline: React.FC<{ props: TimelineProps; beats: number[]; zh: boolean }> = ({ props, beats, zh }) => {
  const frame = useCurrentFrame();
  const b1 = beat(beats, 1, 60);
  const pts = props.points;
  const top = 420;
  const step = 168;
  const x = 190;
  const lastSlipped = pts.filter((p) => p.state === "slipped").length - 1;
  // Marker walks through the slipped points during beat 0, reaches the target at beat 1.
  const walkEnd = Math.max(12, b1 - 6);
  const idx = frame < walkEnd ? lerp(frame, 6, walkEnd, 0, Math.max(0, lastSlipped)) : lerp(frame, b1 - 6, b1 + 8, lastSlipped, pts.length - 1);
  const markerY = top + idx * step;
  const track = lerp(frame, 0, 16, 0, 1);
  const wobble = frame > b1 + 20 ? Math.sin((frame - b1) / 4) * 3 : 0;
  return (
    <SceneShell>
      <AbsoluteFill>
        <div style={{ position: "absolute", left: 84, right: 84, top: 255, fontFamily: zh ? FONT.zh : FONT.display, fontWeight: 700, fontSize: zh ? 64 : 68, color: C.ink, letterSpacing: zh ? 0 : "-0.03em" }}>
          <Reveal text={props.title} delay={0} />
        </div>
        {/* track */}
        <div style={{ position: "absolute", left: x - 3, top, width: 6, height: (pts.length - 1) * step * track, borderRadius: 3, background: "rgba(3,52,110,0.15)" }} />
        <div style={{ position: "absolute", left: x - 3, top, width: 6, height: Math.max(0, markerY - top), borderRadius: 3, background: C.navy }} />
        {pts.map((p, i) => {
          const y = top + i * step;
          const appear = ease(frame, 4 + i * 4, 14);
          const passed = idx >= i - 0.02;
          const isTarget = p.state === "target";
          const tagP = pop(frame, isTarget ? b1 + 4 : 10 + i * ((walkEnd - 10) / Math.max(1, lastSlipped + 1)), 12, 0.5);
          return (
            <div key={i} style={{ position: "absolute", left: x + 60, top: y - 44, opacity: appear, display: "flex", alignItems: "center", gap: 26 }}>
              <span
                style={{
                  position: "relative",
                  fontFamily: zh ? FONT.zh : FONT.display,
                  fontWeight: isTarget ? 700 : 600,
                  fontSize: isTarget ? 84 : 66,
                  letterSpacing: "-0.03em",
                  color: isTarget ? C.navy : passed ? C.muted : C.ink,
                  transform: isTarget ? `rotate(${wobble * 0.3}deg)` : undefined,
                }}
              >
                {p.label}
                {!isTarget && (
                  <span style={{ position: "absolute", left: -6, top: "54%", height: 6, borderRadius: 3, background: C.alert, width: `calc(${(passed ? ease(frame, 8 + i * 8, 8) : 0) * 100}% + 12px)` }} />
                )}
              </span>
              {p.note && (
                <span
                  style={{
                    fontFamily: zh ? FONT.zh : FONT.body,
                    fontWeight: 600,
                    fontSize: 30,
                    padding: "8px 18px",
                    borderRadius: 999,
                    color: isTarget ? C.navy : C.alert,
                    background: isTarget ? C.tint : "rgba(217,63,43,0.10)",
                    border: isTarget ? `2px dashed ${C.navy}` : "none",
                    transform: `scale(${passed ? tagP : 0})`,
                  }}
                >
                  {p.note}
                </span>
              )}
            </div>
          );
        })}
        {pts.map((p, i) => (
          <div
            key={`dot-${i}`}
            style={{
              position: "absolute",
              left: x - 15,
              top: top + i * step - 15,
              width: 30,
              height: 30,
              borderRadius: 99,
              background: idx >= i - 0.02 ? C.navy : C.card,
              border: `4px solid ${C.navy}`,
              opacity: ease(frame, 4 + i * 4, 10),
            }}
          />
        ))}
        {/* marker */}
        <div style={{ position: "absolute", left: x - 34, top: markerY - 34, width: 68, height: 68, borderRadius: 99, border: `4px solid ${C.navy}`, opacity: 0.35 + 0.25 * Math.sin(frame / 5) }} />
        <div
          style={{
            position: "absolute",
            left: 84,
            right: 84,
            top: top + pts.length * step - 20,
            fontFamily: zh ? FONT.zh : FONT.body,
            fontWeight: 500,
            fontSize: 42,
            color: C.alert,
            opacity: ease(frame, b1 + 24, 14),
            transform: `translateY(${interpolate(ease(frame, b1 + 24, 14), [0, 1], [16, 0], clamp)}px)`,
          }}
        >
          {props.caveat}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
