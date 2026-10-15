import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { ease, pop } from "../components/anim";
import { Reveal } from "../components/Reveal";
import { SceneShell } from "../components/SceneShell";
import type { CtaProps } from "../spec";
import { C, FONT } from "../theme";

/** Closing card on the navy band: logotype, question, URL pill. */
export const Cta: React.FC<{ props: CtaProps; beats: number[]; zh: boolean }> = ({ props, zh }) => {
  const frame = useCurrentFrame();
  const logo = pop(frame, 2, 13, 0.7);
  const pill = pop(frame, 18, 11, 0.6);
  const shine = interpolate(frame % 70, [0, 30], [-120, 220]);
  return (
    <SceneShell exit={false}>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ position: "absolute", top: 380, transform: `scale(${interpolate(logo, [0, 1], [0.7, 1])})`, opacity: interpolate(logo, [0, 1], [0, 1]) }}>
          <Img src={staticFile("brand/viza-logotype-dark.svg")} style={{ height: 120 }} />
        </div>
        <div style={{ position: "absolute", left: 84, right: 84, top: 600, textAlign: "center", fontFamily: zh ? FONT.zh : FONT.display, fontWeight: 700, fontSize: zh ? 74 : 80, lineHeight: 1.1, color: "#fff", letterSpacing: zh ? 0 : "-0.035em" }}>
          <Reveal text={props.question} delay={8} />
        </div>
        <div
          style={{
            position: "absolute",
            top: 880,
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "22px 30px 22px 44px",
            borderRadius: 999,
            background: "#fff",
            transform: `scale(${pill})`,
            overflow: "hidden",
          }}
        >
          <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 64, color: C.navy, letterSpacing: "-0.03em" }}>{props.url}</span>
          <span style={{ fontFamily: zh ? FONT.zh : FONT.body, fontWeight: 600, fontSize: 32, color: "#fff", background: C.success, padding: "8px 20px", borderRadius: 999 }}>{props.pill}</span>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: shine, width: 60, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)", transform: "skewX(-20deg)" }} />
        </div>
        <div style={{ position: "absolute", left: 84, right: 84, top: 1040, textAlign: "center", fontFamily: zh ? FONT.zh : FONT.body, fontWeight: 400, fontSize: 30, color: "rgba(255,255,255,0.6)", opacity: ease(frame, 30, 14) }}>
          {props.disclaimer}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
