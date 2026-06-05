import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const strict = process.argv.includes("--strict");

const locationsPath = path.join(appRoot, "lib", "travel", "locations.ts");
const cardDataPath = path.join(
  appRoot,
  "components",
  "client",
  "travel",
  "travel-card-curated-data.json"
);
const publicRoot = path.join(appRoot, "public");

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

function readDropdownCities() {
  const source = fs.readFileSync(locationsPath, "utf8");
  return Array.from(
    source.matchAll(
      /\{ en: "([^"]+)", zh: "([^"]+)"(?:, aliases: \[([^\]]+)])? \}/g
    )
  ).map((match) => ({
    en: match[1],
    zh: match[2],
    aliases: Array.from(match[3]?.matchAll(/"([^"]+)"/g) ?? []).map(
      (alias) => alias[1]
    ),
  }));
}

function hasCityKey(item, city) {
  const candidateKeys = [city.en, city.zh, ...city.aliases].map(normalize);
  return (item.cityKeys ?? []).some((key) =>
    candidateKeys.includes(normalize(key))
  );
}

function localAssetExists(imageSrc) {
  if (typeof imageSrc !== "string" || !imageSrc.startsWith("/")) return true;
  return fs.existsSync(path.join(publicRoot, imageSrc));
}

const dropdownCities = readDropdownCities();
const data = JSON.parse(fs.readFileSync(cardDataPath, "utf8"));

const missingCityCards = dropdownCities.filter(
  (city) => !data.cities.some((item) => hasCityKey(item, city))
);
const missingAttractions = dropdownCities.filter(
  (city) => !data.attractions.some((item) => hasCityKey(item, city))
);
const missingSources = [...data.cities, ...data.attractions].filter(
  (item) => typeof item.sourceUrl !== "string" || !item.sourceUrl.trim()
);
const missingLocalAssets = [...data.cities, ...data.attractions].filter(
  (item) => !localAssetExists(item.imageSrc)
);

const report = {
  dropdownCities: dropdownCities.length,
  cityCards: data.cities.length,
  attractions: data.attractions.length,
  missingCityCards: missingCityCards.map((city) => city.en),
  missingAttractions: missingAttractions.map((city) => city.en),
  missingSources: missingSources.map((item) => item.name ?? item.cityLabel),
  missingLocalAssets: missingLocalAssets.map((item) => ({
    label: item.name ?? item.cityLabel,
    imageSrc: item.imageSrc,
  })),
};

console.log(JSON.stringify(report, null, 2));

if (
  strict &&
  (report.missingCityCards.length ||
    report.missingAttractions.length ||
    report.missingSources.length ||
    report.missingLocalAssets.length)
) {
  process.exitCode = 1;
}
