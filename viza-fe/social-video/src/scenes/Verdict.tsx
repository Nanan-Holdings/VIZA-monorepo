import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ease, lerp, pop } from "../components/anim";
import { Reveal } from "../components/Reveal";
import { SceneShell } from "../components/SceneShell";
import type { VerdictProps } from "../spec";
import { C, FONT } from "../theme";

/** The takeaway: a large drawn check, the verdict, and what to do next. */
export const Verdict: React.FC<{ props: VerdictProps; beats: number[]; zh: boolean }> = ({ props, zh }) => {
  const frame = useCurrentFrame();
  const ring = lerp(frame, 0, 18, 0, 1);
  const tick = lerp(frame, 12, 26, 0, 1);
  const badge = pop(frame, 0, 12, 0.7);
  const R = 150;
  const circ = 2 * Math.PI * R;
  return (
    <SceneShell>
      <AbsoluteFill>
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", justifyContent: "center", transform: `scale(${interpolate(badge, [0, 1], [0.6, 1])})` }}>
          <svg width={380} height={380} viewBox="0 0 380 380">
            <circle cx={190} cy={190} r={R + 22} fill="rgba(22,163,74,0.10)" />
            <circle cx={190} cy={190} r={R} fill="none" stroke={C.success} strokeWidth={14} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - ring)} transform="rotate(-90 190 190)" />
            <path d="M120 194l46 46 96-104" fill="none" stroke={C.success} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={240} strokeDashoffset={240 * (1 - tick)} />
          </svg>
        </div>
        <div style={{ position: "absolute", left: 84, right: 84, top: 740, textAlign: "center" }}>
          <div style={{ display: "inline-block", fontFamily: zh ? FONT.zh : FONT.body, fontWeight: 600, fontSize: 34, color: C.success, background: "rgba(22,163,74,0.10)", padding: "10px 26px", borderRadius: 999, transform: `scale(${pop(frame, 14, 12, 0.5)})` }}>
            {props.badge}
          </div>
          <div style={{ marginTop: 28, fontFamily: zh ? FONT.zh : FONT.display, fontWeight: 700, fontSize: zh ? 80 : 86, lineHeight: 1.08, color: C.ink, letterSpacing: zh ? 0 : "-0.035em" }}>
            <Reveal text={props.headline} delay={8} />
          </div>
          <div style={{ marginTop: 26, fontFamily: zh ? FONT.zh : FONT.body, fontWeight: 500, fontSize: 40, color: C.muted, opacity: ease(frame, 26, 14) }}>
            {props.note}
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
