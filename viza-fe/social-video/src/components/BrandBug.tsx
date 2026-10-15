import React from "react";
import { Img, staticFile } from "remotion";
import { C, FONT, SAFE } from "../theme";

export const BrandBug: React.FC<{ topic: string; onDark: boolean; opacity: number }> = ({ topic, onDark, opacity }) => (
  <div
    style={{
      position: "absolute",
      top: 150,
      left: SAFE.side,
      right: SAFE.side,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      opacity,
    }}
  >
    <Img src={staticFile(onDark ? "brand/viza-logotype-dark.svg" : "brand/viza-logotype-light.svg")} style={{ height: 40 }} />
    <div
      style={{
        fontFamily: FONT.body,
        fontWeight: 500,
        fontSize: 26,
        letterSpacing: "0.02em",
        color: onDark ? "#fff" : C.navy,
        border: `2px solid ${onDark ? "rgba(255,255,255,0.35)" : "rgba(3,52,110,0.25)"}`,
        borderRadius: 999,
        padding: "8px 22px",
      }}
    >
      {topic}
    </div>
  </div>
);
