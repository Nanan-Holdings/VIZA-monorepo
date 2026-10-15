import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { Short } from "./Short";
import type { VideoSpec } from "./spec";
import { H, W } from "./theme";
import etiasEn from "../specs/etias-en.json";
import etiasZh from "../specs/etias-zh.json";

const calc: CalculateMetadataFunction<VideoSpec> = ({ props }) => ({
  durationInFrames: Math.ceil(props.durationSec * 30),
});

export const Root: React.FC = () => (
  <>
    <Composition id="Short" component={Short} width={W} height={H} fps={30} durationInFrames={900} defaultProps={etiasEn as VideoSpec} calculateMetadata={calc} />
    <Composition id="ShortZh" component={Short} width={W} height={H} fps={30} durationInFrames={900} defaultProps={etiasZh as VideoSpec} calculateMetadata={calc} />
  </>
);
