#!/usr/bin/env node
/** Import measured keyword volumes from a VIZA CSV/TSV export. */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/build-seo-keywords.mjs /absolute/path/to/keyword-export.csv");
  process.exit(1);
}

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = resolve(appRoot, "content/seo-keywords.json");
const source = resolve(input);
const raw = readFileSync(source, "utf8").replace(/^\uFEFF/, "");
const delimiter = raw.slice(0, 4000).includes("\t") ? "\t" : ",";

function parseDelimited(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(cell); cell = "";
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error("Keyword export has an unterminated quoted field");
  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);
  return rows;
}

const rows = parseDelimited(raw);
const normalize = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const keywordNames = new Set(["keyword", "keywords", "searchterm", "query"]);
const volumeNames = new Set(["avgmonthlysearches", "averagemonthlysearches", "monthlysearches", "searchvolume", "volume"]);
const headerAt = rows.findIndex((row) => row.some((cell) => keywordNames.has(normalize(cell))) && row.some((cell) => volumeNames.has(normalize(cell))));
if (headerAt < 0) throw new Error("Could not find Keyword and average monthly searches columns");
const header = rows[headerAt].map(normalize);
const keywordAt = header.findIndex((cell) => keywordNames.has(cell));
const volumeAt = header.findIndex((cell) => volumeNames.has(cell));
const keywords = new Map();
let skipped = 0;
for (const row of rows.slice(headerAt + 1)) {
  const keyword = row[keywordAt]?.trim().replace(/\s+/g, " ");
  const volumeText = row[volumeAt]?.trim();
  if (!keyword || !volumeText) { skipped++; continue; }
  // Ranges and threshold values are not measured point estimates.
  if (!/^\d[\d,]*(?:\.\d+)?$/.test(volumeText)) { skipped++; continue; }
  const volume = Number(volumeText.replaceAll(",", ""));
  if (!Number.isFinite(volume) || volume < 0) { skipped++; continue; }
  const key = keyword.toLocaleLowerCase("en");
  const previous = keywords.get(key);
  if (previous && previous.averageMonthlySearches !== volume) throw new Error(`Conflicting measured volume for keyword: ${keyword}`);
  keywords.set(key, { keyword, averageMonthlySearches: volume, source: basename(source) });
}
if (!keywords.size) throw new Error("No measured keyword volumes were found; the existing list was preserved");
const list = [...keywords.values()].sort((a, b) => b.averageMonthlySearches - a.averageMonthlySearches || a.keyword.localeCompare(b.keyword));
writeFileSync(output, `${JSON.stringify(list, null, 2)}\n`);
console.log(`Imported ${list.length} measured keywords; skipped ${skipped} rows without a point estimate.`);
