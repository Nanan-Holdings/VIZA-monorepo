import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Caption } from "../spec";
import { C, FONT, H, SAFE } from "../theme";
import { clamp, FPS, pop } from "./anim";

/**
 * Burned-in captions built from the script and the voice timings, never from speech recognition.
 * English highlights the spoken word; Chinese fills character by character across the phrase.
 */
export const Captions: React.FC<{ captions: Caption[]; zh: boolean; onDark: boolean }> = ({ captions, zh, onDark }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cap = captions.find((c) => t >= c.start - 0.05 && t < c.end + 0.25);
  if (!cap) return null;
  const local = frame - Math.round(cap.start * FPS);
  const enter = pop(local, 0, 16, 0.5);
  const y = interpolate(enter, [0, 1], [24, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.side - 20,
        right: SAFE.side - 20,
        top: H - SAFE.bottom - 210,
        height: 190,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateY(${y}px)`,
        opacity: interpolate(enter, [0, 1], [0, 1], clamp),
      }}
    >
      <div
        style={{
          fontFamily: zh ? FONT.zh : FONT.display,
          fontWeight: zh ? 700 : 600,
          fontSize: zh ? 56 : 58,
          lineHeight: 1.22,
          letterSpacing: zh ? "0.02em" : "-0.01em",
          textAlign: "center",
          color: onDark ? "#fff" : C.navyInk,
          padding: "14px 28px",
          borderRadius: 28,
          background: onDark ? "rgba(1,27,58,0.55)" : "rgba(255,255,255,0.86)",
          boxShadow: onDark ? "none" : "0 10px 40px rgba(3,52,110,0.12)",
          maxWidth: "100%",
        }}
      >
        {zh ? <ZhLine cap={cap} t={t} onDark={onDark} /> : <EnLine cap={cap} t={t} onDark={onDark} />}
      </div>
    </div>
  );
};

const EnLine: React.FC<{ cap: Caption; t: number; onDark: boolean }> = ({ cap, t, onDark }) => (
  <>
    {cap.words.map((w, i) => {
      const active = t >= w.start && t < (cap.words[i + 1]?.start ?? cap.end + 0.25);
      const spoken = t >= w.start;
      return (
        <span key={i}>
          <span
            style={{
              display: "inline-block",
              padding: "0 10px",
              borderRadius: 12,
              background: active ? C.navy : "transparent",
              color: active ? "#fff" : spoken ? undefined : onDark ? "rgba(255,255,255,0.45)" : "rgba(1,27,58,0.38)",
              transform: `scale(${active ? 1.06 : 1})`,
            }}
          >
            {w.text}
          </span>{" "}
        </span>
      );
    })}
  </>
);

const ZhLine: React.FC<{ cap: Caption; t: number; onDark: boolean }> = ({ cap, t, onDark }) => {
  const chars = Array.from(cap.text);
  const spokenChars = interpolate(t, [cap.start, cap.end], [0, chars.length], clamp);
  return (
    <>
      {chars.map((ch, i) => (
        <span key={i} style={{ color: i < spokenChars ? undefined : onDark ? "rgba(255,255,255,0.45)" : "rgba(1,27,58,0.38)" }}>
          {ch}
        </span>
      ))}
    </>
  );
};
