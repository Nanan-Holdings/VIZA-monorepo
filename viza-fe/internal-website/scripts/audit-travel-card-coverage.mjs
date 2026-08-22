import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const strict = process.argv.includes("--strict");
const minAttractionsArgIndex = process.argv.indexOf("--min-attractions");
const minAttractionsArg =
  minAttractionsArgIndex >= 0 ? process.argv[minAttractionsArgIndex + 1] : "";
const minAttractions = Number(
  minAttractionsArg || process.env.TRAVEL_CARD_MIN_ATTRACTIONS || 10
);

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
  // Travel binaries were moved to the public Supabase Storage bucket. The
  // Next.js /travel/* rewrite serves these paths in deployed environments,
  // even though the files are intentionally absent from the checkout.
  if (imageSrc.startsWith("/travel/")) return true;
  return fs.existsSync(path.join(publicRoot, imageSrc));
}

const dropdownCities = readDropdownCities();
const data = JSON.parse(fs.readFileSync(cardDataPath, "utf8"));
const coverageCities = [
  ...dropdownCities,
  ...data.cities.map((item) => ({
    en:
      item.cityKeys?.find((key) => /[A-Za-z]/.test(key)) ?? item.cityLabel,
    zh: item.cityLabel,
    aliases: item.cityKeys ?? [],
  })),
].reduce((cities, city) => {
  const key = normalize(city.en);
  if (!key || cities.some((existing) => normalize(existing.en) === key)) {
    return cities;
  }
  cities.push(city);
  return cities;
}, []);

const missingCityCards = dropdownCities.filter(
  (city) => !data.cities.some((item) => hasCityKey(item, city))
);
const missingAttractions = coverageCities.filter(
  (city) =>
    data.attractions.filter((item) => hasCityKey(item, city)).length <
    minAttractions
);
const missingSources = [...data.cities, ...data.attractions].filter(
  (item) => typeof item.sourceUrl !== "string" || !item.sourceUrl.trim()
);
const missingDescriptions = data.attractions.filter(
  (item) => typeof item.description !== "string" || !item.description.trim()
);
const invalidCoordinates = data.attractions.filter(
  (item) =>
    !Number.isFinite(item.lat) ||
    item.lat < -90 ||
    item.lat > 90 ||
    !Number.isFinite(item.lng) ||
    item.lng < -180 ||
    item.lng > 180
);
const missingLocalAssets = [...data.cities, ...data.attractions].filter(
  (item) => !localAssetExists(item.imageSrc)
);

const report = {
  dropdownCities: dropdownCities.length,
  coverageCities: coverageCities.length,
  cityCards: data.cities.length,
  attractions: data.attractions.length,
  minAttractions,
  missingCityCards: missingCityCards.map((city) => city.en),
  missingAttractions: missingAttractions.map((city) => ({
    city: city.en,
    count: data.attractions.filter((item) => hasCityKey(item, city)).length,
  })),
  missingSources: missingSources.map((item) => item.name ?? item.cityLabel),
  missingDescriptions: missingDescriptions.map((item) => item.name ?? item.cityLabel),
  invalidCoordinates: invalidCoordinates.map((item) => item.name ?? item.cityLabel),
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
    report.missingDescriptions.length ||
    report.invalidCoordinates.length ||
    report.missingLocalAssets.length)
) {
  process.exitCode = 1;
}
