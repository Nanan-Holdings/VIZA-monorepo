import { loadFont as loadLocalFont } from "@remotion/fonts";
import { loadFont as loadNotoSansSC } from "@remotion/google-fonts/NotoSansSC";
import { staticFile } from "remotion";

// Brand tokens, from kelin-studio-vault/Brand/VIZA/Overview.md and the live site.
export const C = {
  navy: "#03346E",
  navyDeep: "#022B5C",
  navyInk: "#011B3A",
  tint: "#EEF3FA",
  shell: "#FAFAFA",
  card: "#FFFFFF",
  ink: "#3D3D3D",
  muted: "rgba(0,0,0,0.45)",
  hairline: "#EFEFEF",
  success: "#16A34A",
  // Accent for stamps and strike-throughs. Used sparingly, never for the mark.
  alert: "#D93F2B",
  euBlue: "#003399",
  euGold: "#FFCC00",
};

loadLocalFont({
  family: "Switzer",
  url: staticFile("fonts/Switzer-Variable.woff2"),
  weight: "100 900",
});
for (const [w, file] of [
  ["400", "Geist-Regular"],
  ["500", "Geist-Medium"],
  ["600", "Geist-SemiBold"],
] as const) {
  loadLocalFont({ family: "Geist", url: staticFile(`fonts/${file}.woff2`), weight: w });
}
const noto = loadNotoSansSC("normal", { weights: ["500", "700", "900"] });

export const FONT = {
  display: `Switzer, ${noto.fontFamily}, "PingFang SC", sans-serif`,
  body: `Geist, ${noto.fontFamily}, "PingFang SC", sans-serif`,
  zh: `${noto.fontFamily}, "PingFang SC", sans-serif`,
};

export const W = 1080;
export const H = 1920;
// Platform UI covers the top ~130px and bottom ~500px on TikTok/Reels/Shorts.
export const SAFE = { top: 200, bottom: 520, side: 84 };
