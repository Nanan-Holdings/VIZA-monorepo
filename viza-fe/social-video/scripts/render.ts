/**
 * Renders a built spec to out/<name>.mp4 (1080x1920, H.264, AAC).
 *   npx tsx scripts/render.ts specs/etias-en.json
 */
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

async function main() {
  const specFile = process.argv[2];
  if (!specFile) throw new Error("usage: render <spec.json>");
  const root = path.resolve(__dirname, "..");
  const inputProps = JSON.parse(fs.readFileSync(path.resolve(specFile), "utf8"));
  const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
  const composition = await selectComposition({ serveUrl, id: "Short", inputProps });
  const out = path.join(root, "out", `viza-${path.basename(specFile, ".json")}.mp4`);
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 18, audioBitrate: "192k", outputLocation: out, inputProps });
  console.log(`rendered ${path.relative(root, out)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
