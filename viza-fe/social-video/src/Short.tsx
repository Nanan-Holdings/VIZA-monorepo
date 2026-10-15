import React from "react";
import { AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, FPS, sec } from "./components/anim";
import { Background } from "./components/Background";
import { BrandBug } from "./components/BrandBug";
import { Captions } from "./components/Captions";
import { Acronym } from "./scenes/Acronym";
import { Cta } from "./scenes/Cta";
import { Hook } from "./scenes/Hook";
import { NotA } from "./scenes/NotA";
import { Stats } from "./scenes/Stats";
import { Timeline } from "./scenes/Timeline";
import { Verdict } from "./scenes/Verdict";
import type { SceneSpec, VideoSpec } from "./spec";
import { C, W } from "./theme";

const SceneView: React.FC<{ scene: SceneSpec; zh: boolean }> = ({ scene, zh }) => {
  const beats = scene.beats.map((b) => sec(b - scene.start));
  switch (scene.kind) {
    case "hook":
      return <Hook props={scene.props} beats={beats} zh={zh} />;
    case "acronym":
      return <Acronym props={scene.props} beats={beats} zh={zh} />;
    case "notA":
      return <NotA props={scene.props} beats={beats} zh={zh} />;
    case "stats":
      return <Stats props={scene.props} beats={beats} zh={zh} />;
    case "timeline":
      return <Timeline props={scene.props} beats={beats} zh={zh} />;
    case "verdict":
      return <Verdict props={scene.props} beats={beats} zh={zh} />;
    case "cta":
      return <Cta props={scene.props} beats={beats} zh={zh} />;
  }
};

/** Skewed navy panel that sweeps across a scene cut. */
const Swipe: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [at - 6, at + 6], [-W * 1.6, W * 1.6], clamp);
  if (frame < at - 6 || frame > at + 6) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: -200,
        bottom: -200,
        left: x,
        width: W * 0.9,
        background: `linear-gradient(90deg, rgba(3,52,110,0), ${C.navy} 25%, ${C.navyDeep} 75%, rgba(3,52,110,0))`,
        transform: "skewX(-14deg)",
      }}
    />
  );
};

export const Short: React.FC<VideoSpec> = (spec) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const zh = spec.locale === "zh-CN";
  const cta = spec.scenes.find((s) => s.kind === "cta");
  const ctaFrame = cta ? sec(cta.start) : durationInFrames + 1;
  const dark = interpolate(frame, [ctaFrame - 4, ctaFrame + 6], [0, 1], clamp);
  const onDark = dark > 0.5;
  const musicVol = spec.musicVolume ?? 0.16;
  return (
    <AbsoluteFill style={{ backgroundColor: C.shell }}>
      <Background dark={dark} />
      {spec.scenes.map((s, i) => {
        const from = sec(s.start);
        const to = i < spec.scenes.length - 1 ? sec(spec.scenes[i + 1].start) : durationInFrames;
        return (
          <Sequence key={i} from={from} durationInFrames={Math.max(1, to - from)} name={`${i + 1}. ${s.kind}`}>
            <SceneView scene={s} zh={zh} />
          </Sequence>
        );
      })}
      <BrandBug topic={spec.topic} onDark={onDark} opacity={interpolate(frame, [4, 14], [0, 1], clamp) * (onDark ? 0 : 1)} />
      <Captions captions={spec.captions} zh={zh} onDark={onDark} />
      {spec.scenes.slice(1).map((s, i) => (
        <Swipe key={i} at={sec(s.start)} />
      ))}
      <Html5Audio src={staticFile(spec.voice)} />
      {spec.music && (
        <Html5Audio
          src={staticFile(spec.music)}
          volume={(f) =>
            musicVol *
            interpolate(f, [0, 12], [0, 1], clamp) *
            interpolate(f, [durationInFrames - FPS * 1.2, durationInFrames], [1, 0], clamp) *
            // Lift the bed in the gaps where nobody is speaking.
            (spec.captions.some((c) => f / FPS >= c.start && f / FPS <= c.end) ? 1 : 1.6)
          }
        />
      )}
    </AbsoluteFill>
  );
};
