import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, ease, pop } from "../components/anim";
import { Reveal } from "../components/Reveal";
import { beat, SceneShell } from "../components/SceneShell";
import type { HookProps } from "../spec";
import { C, FONT, W } from "../theme";

const Star: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 1.8l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9l7.1-.6z" fill={C.euGold} />
  </svg>
);

export const Hook: React.FC<{ props: HookProps; beats: number[]; zh: boolean }> = ({ props, beats, zh }) => {
  const frame = useCurrentFrame();
  const b1 = beat(beats, 1, 40);
  const b2 = beat(beats, 2, 80);
  const book = pop(frame, 0, 13, 0.8);
  const rotY = interpolate(book, [0, 1], [-75, -14]);
  const turn = ease(frame, b2, 14);
  const shake = frame > b2 && frame < b2 + 14 ? Math.sin((frame - b2) * 2.2) * (1 - (frame - b2) / 14) * 6 : 0;
  const cx = W / 2;
  const cy = 600;
  const ringR = 345;
  return (
    <SceneShell>
      <AbsoluteFill>
        {/* EU star ring */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2 + frame / 400;
          const p = pop(frame, b1 + i * 1.6, 12, 0.5);
          const dim = interpolate(turn, [0, 1], [1, 0.35]);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: cx + Math.cos(a) * ringR - 30,
                top: cy + Math.sin(a) * ringR - 30,
                transform: `scale(${p})`,
                opacity: dim,
              }}
            >
              <Star size={60} />
            </div>
          );
        })}
        {/* Passport booklet */}
        <div style={{ position: "absolute", left: cx - 230, top: cy - 315, perspective: 1600 }}>
          <div
            style={{
              width: 460,
              height: 630,
              borderRadius: 30,
              background: `linear-gradient(145deg, ${C.navy} 0%, ${C.navyDeep} 70%, ${C.navyInk} 100%)`,
              boxShadow: "0 40px 90px rgba(1,27,58,0.35), inset 0 0 0 2px rgba(255,255,255,0.08)",
              transform: `rotateY(${rotY}deg) translateX(${shake}px) scale(${interpolate(book, [0, 1], [0.7, 1])})`,
              opacity: interpolate(frame, [0, 6], [0, 1], clamp),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 46,
            }}
          >
            <div style={{ width: 170, height: 170, borderRadius: 999, border: "3px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Img src={staticFile("brand/viza-mark-dark.svg")} style={{ width: 92 }} />
            </div>
            <div style={{ fontFamily: FONT.body, fontWeight: 500, fontSize: 30, letterSpacing: "0.42em", color: "rgba(255,255,255,0.8)" }}>
              PASSPORT
            </div>
          </div>
        </div>
        {/* Headline block */}
        <div
          style={{
            position: "absolute",
            left: 84,
            right: 84,
            top: 1000,
            textAlign: "center",
            fontFamily: zh ? FONT.zh : FONT.display,
            color: C.ink,
          }}
        >
          <div style={{ fontSize: zh ? 60 : 62, fontWeight: 600, color: C.navy, letterSpacing: zh ? 0 : "-0.02em" }}>
            <Reveal text={props.kicker} delay={4} />
          </div>
          <div style={{ position: "relative", height: 110, marginTop: 10 }}>
            <div style={{ position: "absolute", inset: 0, opacity: 1 - turn, fontSize: zh ? 76 : 82, fontWeight: 700, letterSpacing: zh ? 0 : "-0.035em" }}>
              {frame >= b1 - 2 && <Reveal text={props.lines[0] ?? ""} delay={b1} accent={props.lines.slice(1)} accentColor={C.success} />}
            </div>
            <div style={{ position: "absolute", inset: 0, opacity: turn, fontSize: zh ? 76 : 82, fontWeight: 700, letterSpacing: zh ? 0 : "-0.035em" }}>
              {frame >= b2 - 2 && <Reveal text={props.turn} delay={b2} />}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
