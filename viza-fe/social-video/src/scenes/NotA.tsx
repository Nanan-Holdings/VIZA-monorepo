import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp, ease, lerp, pop } from "../components/anim";
import { Reveal } from "../components/Reveal";
import { beat, SceneShell } from "../components/SceneShell";
import type { NotAProps } from "../spec";
import { C, FONT } from "../theme";

const Check: React.FC<{ p: number }> = ({ p }) => (
  <svg width={44} height={44} viewBox="0 0 44 44">
    <circle cx={22} cy={22} r={20} fill={C.success} opacity={Math.min(1, p * 2)} />
    <path d="M13 22.5l6 6 12-13" fill="none" stroke="#fff" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={30} strokeDashoffset={30 * (1 - p)} />
  </svg>
);

/** "X is NOT a Y": the wrong word gets struck and stamped, then the right concept slides in as a form card. */
export const NotA: React.FC<{ props: NotAProps; beats: number[]; zh: boolean }> = ({ props, beats, zh }) => {
  const frame = useCurrentFrame();
  const b1 = beat(beats, 1, 45);
  const card = pop(frame, 0, 14, 0.6);
  const strike = lerp(frame, 10, 20, 0, 1);
  const stamp = pop(frame, 18, 9, 0.9);
  const up = ease(frame, b1, 18);
  const rows = zh ? ["护照信息", "行程信息", "网上获批"] : ["Passport details", "Travel plans", "Approved online"];
  return (
    <SceneShell>
      <AbsoluteFill>
        <div style={{ position: "absolute", left: 0, right: 0, top: interpolate(up, [0, 1], [380, 250]), display: "flex", justifyContent: "center" }}>
          <div
            style={{
              position: "relative",
              width: 820,
              height: 380,
              borderRadius: 36,
              background: C.card,
              border: `2px solid ${C.hairline}`,
              boxShadow: "0 30px 80px rgba(3,52,110,0.12)",
              transform: `scale(${interpolate(card, [0, 1], [0.85, 1]) * interpolate(up, [0, 1], [1, 0.78])})`,
              opacity: interpolate(frame, [0, 5], [0, 1], clamp),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ position: "relative", fontFamily: zh ? FONT.zh : FONT.display, fontWeight: 700, fontSize: zh ? 200 : 220, color: "rgba(3,52,110,0.9)", letterSpacing: zh ? "0.05em" : "-0.04em" }}>
              {props.struck}
              <div style={{ position: "absolute", left: -20, top: "52%", height: 16, borderRadius: 8, background: C.alert, width: `calc(${strike * 100}% + 40px)` }} />
            </div>
            <div
              style={{
                position: "absolute",
                right: 40,
                bottom: 34,
                transform: `rotate(-11deg) scale(${interpolate(stamp, [0, 1], [2.4, 1])})`,
                opacity: interpolate(frame, [18, 21], [0, 1], clamp),
                border: `7px solid ${C.alert}`,
                color: C.alert,
                borderRadius: 18,
                padding: "6px 24px",
                fontFamily: zh ? FONT.zh : FONT.display,
                fontWeight: 800,
                fontSize: zh ? 60 : 56,
                letterSpacing: zh ? "0.1em" : "0.04em",
                background: "rgba(255,255,255,0.92)",
              }}
            >
              {props.stamp}
            </div>
          </div>
        </div>
        {/* What it actually is */}
        <div style={{ position: "absolute", left: 84, right: 84, top: 640, opacity: up, transform: `translateY(${interpolate(up, [0, 1], [80, 0])}px)` }}>
          <div style={{ fontFamily: zh ? FONT.zh : FONT.display, fontWeight: 700, fontSize: zh ? 66 : 70, color: C.ink, textAlign: "center", letterSpacing: zh ? 0 : "-0.03em", lineHeight: 1.1 }}>
            {frame >= b1 && <Reveal text={props.is} delay={b1 + 2} />}
          </div>
          <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
            {rows.map((r, i) => {
              const p = ease(frame, b1 + 12 + i * 7, 14);
              return (
                <div
                  key={r}
                  style={{
                    width: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 22,
                    padding: "18px 26px",
                    borderRadius: 22,
                    background: C.card,
                    border: `2px solid ${C.hairline}`,
                    opacity: p,
                    transform: `translateX(${interpolate(p, [0, 1], [60, 0])}px)`,
                    fontFamily: zh ? FONT.zh : FONT.body,
                    fontWeight: 500,
                    fontSize: 40,
                    color: C.ink,
                  }}
                >
                  <Check p={ease(frame, b1 + 18 + i * 7, 12)} />
                  {r}
                </div>
              );
            })}
          </div>
          {props.like && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 30 }}>
              <div
                style={{
                  fontFamily: zh ? FONT.zh : FONT.body,
                  fontWeight: 600,
                  fontSize: 38,
                  color: "#fff",
                  background: C.navy,
                  borderRadius: 999,
                  padding: "12px 34px",
                  transform: `scale(${pop(frame, b1 + 36, 12, 0.6)})`,
                }}
              >
                {props.like}
              </div>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
