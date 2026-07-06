/**
 * Precomputes the dotted world map for the explore page's Map view (lib/world-dots.json).
 *
 * Uses https://github.com/NTag/dotted-map (devDependency) at build-script time only —
 * the heavy countries GeoJSON never ships to the client; the component renders the
 * committed JSON as plain SVG circles.
 *
 * Re-run after adding a country to COUNTRY_PINS:
 *   node scripts/generate-world-map.mjs
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const DottedMap = require("dotted-map").default;

/**
 * Representative point per lib/countries.ts slug (capital / population centre,
 * nudged toward where users expect the pin rather than the geometric centroid).
 */
const COUNTRY_PINS = {
  indonesia: { lat: -6.2, lng: 106.85 },
  egypt: { lat: 30.05, lng: 31.24 },
  australia: { lat: -25.3, lng: 133.8 },
  "saudi-arabia": { lat: 24.71, lng: 46.68 },
  "united-kingdom": { lat: 52.8, lng: -1.5 },
  vietnam: { lat: 21.03, lng: 105.85 },
  malaysia: { lat: 3.14, lng: 101.69 },
  japan: { lat: 36.2, lng: 138.25 },
  "united-states": { lat: 39.8, lng: -98.6 },
  canada: { lat: 54.0, lng: -96.0 },
  turkiye: { lat: 39.0, lng: 35.2 },
  thailand: { lat: 15.87, lng: 100.99 },
  "united-arab-emirates": { lat: 24.3, lng: 54.4 },
  france: { lat: 46.6, lng: 2.4 },
  italy: { lat: 42.8, lng: 12.5 },
  india: { lat: 21.0, lng: 78.0 },
};

const map = new DottedMap({
  width: 120,
  grid: "diagonal",
  // Crop Antarctica / far-north emptiness for a tighter marketing map.
  region: { lat: { min: -60, max: 75 }, lng: { min: -180, max: 180 } },
});

for (const [slug, { lat, lng }] of Object.entries(COUNTRY_PINS)) {
  map.addPin({ lat, lng, data: { slug } });
}

const points = map.getPoints();
const round = (n) => Math.round(n * 100) / 100;

const dots = points.filter((p) => !p.data).map((p) => [round(p.x), round(p.y)]);
const pins = points
  .filter((p) => p.data)
  .map((p) => ({ slug: p.data.slug, x: round(p.x), y: round(p.y) }));

const viewBox = map.getSVG({ radius: 0.3 }).match(/viewBox="([\d.\s-]+)"/)[1];
const [, , width, height] = viewBox.split(" ").map(Number);

const missing = Object.keys(COUNTRY_PINS).filter((slug) => !pins.some((p) => p.slug === slug));
if (missing.length) throw new Error(`Pins missing from output: ${missing.join(", ")}`);

const out = { width, height, dots, pins };
const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../lib/world-dots.json");
writeFileSync(outPath, JSON.stringify(out));
console.log(`Wrote ${outPath}: ${dots.length} dots, ${pins.length} pins, viewBox 0 0 ${width} ${height}`);
