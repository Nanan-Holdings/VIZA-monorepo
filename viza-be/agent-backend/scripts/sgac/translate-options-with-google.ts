import * as dotenv from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SGAC_CITY_OPTIONS,
  SGAC_HOTEL_NAME_OPTIONS,
} from "./official-options";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const agentBackendRoot = path.resolve(__dirname, "../..");

for (const envFile of [
  path.join(agentBackendRoot, ".env.local"),
  path.join(agentBackendRoot, ".env"),
]) {
  dotenv.config({ path: envFile, override: false });
}

const GOOGLE_TRANSLATE_V2_ENDPOINT = "https://translation.googleapis.com/language/translate/v2";
const CACHE_PATH = path.join(__dirname, "option-translations.zh.json");

const CRUISE_NAMES = [
  "ADONIA",
  "ADORA MEDITERRANEA",
  "AEGEAN ODYSSEY",
  "AEGEAN PARADISE",
  "AIDAAURA",
  "AIDABELLA",
  "AIDADIVA",
  "AIDALUNA",
  "AIDAMAR",
  "AIDANOVA",
  "AIDAPERLA",
  "AIDAPRIMA",
  "AIDASOL",
  "AIDASTELLA",
  "ANTHEM OF THE SEAS",
  "AZAMARA JOURNEY",
  "AZAMARA QUEST",
  "CELEBRITY MILLENNIUM",
  "DIAMOND PRINCESS",
  "GENTING DREAM",
  "MARINER OF THE SEAS",
  "OVATION OF THE SEAS",
  "QUANTUM OF THE SEAS",
  "RESORTS WORLD ONE",
  "SPECTRUM OF THE SEAS",
  "SUPERSTAR GEMINI",
  "SUPERSTAR VIRGO",
  "VOYAGER OF THE SEAS",
];

interface CacheShape {
  city: Record<string, string>;
  hotel: Record<string, string>;
  cruise: Record<string, string>;
}

interface GoogleTranslateResponse {
  data?: {
    translations?: Array<{ translatedText?: string }>;
  };
  error?: { message?: string };
}

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
}

function readCache(): CacheShape {
  if (!existsSync(CACHE_PATH)) return { city: {}, hotel: {}, cruise: {} };
  const parsed = JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Partial<CacheShape>;
  return {
    city: parsed.city ?? {},
    hotel: parsed.hotel ?? {},
    cruise: parsed.cruise ?? {},
  };
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function translateBatch(apiKey: string, values: string[]): Promise<string[]> {
  const endpoint = new URL(GOOGLE_TRANSLATE_V2_ENDPOINT);
  endpoint.searchParams.set("key", apiKey);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: values,
      source: "en",
      target: "zh-CN",
      format: "text",
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as GoogleTranslateResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Google Translate failed with HTTP ${response.status}`);
  }
  const translations = payload.data?.translations ?? [];
  if (translations.length !== values.length) {
    throw new Error(`Google Translate returned ${translations.length} translations for ${values.length} inputs`);
  }
  return translations.map((translation) => decodeHtmlEntities(clean(translation.translatedText)));
}

async function fillMissing(apiKey: string, cache: Record<string, string>, values: string[], label: string) {
  const missing = Array.from(new Set(values)).filter((value) => !clean(cache[value]));
  const batchSize = 100;
  for (let index = 0; index < missing.length; index += batchSize) {
    const batch = missing.slice(index, index + batchSize);
    const translated = await translateBatch(apiKey, batch);
    batch.forEach((value, offset) => {
      cache[value] = translated[offset] ?? value;
    });
    writeFileSync(CACHE_PATH, `${JSON.stringify(currentCache, null, 2)}\n`);
    console.log(`${label}: translated ${Math.min(index + batch.length, missing.length)}/${missing.length}`);
  }
}

const apiKey = clean(process.env.GOOGLE_TRANSLATE_API_KEY)
  || clean(process.env.CLOUD_TRANSLATE_API_KEY)
  || clean(process.env.GCP_TRANSLATE_API_KEY);

if (!apiKey) {
  throw new Error("Missing GOOGLE_TRANSLATE_API_KEY / CLOUD_TRANSLATE_API_KEY / GCP_TRANSLATE_API_KEY");
}

const currentCache = readCache();
await fillMissing(apiKey, currentCache.city, SGAC_CITY_OPTIONS.map((option) => option.value), "city");
await fillMissing(apiKey, currentCache.hotel, SGAC_HOTEL_NAME_OPTIONS.map((option) => option.value), "hotel");
await fillMissing(apiKey, currentCache.cruise, CRUISE_NAMES, "cruise");
writeFileSync(CACHE_PATH, `${JSON.stringify(currentCache, null, 2)}\n`);

console.log(
  `Saved SGAC zh translation cache: city=${Object.keys(currentCache.city).length}, hotel=${Object.keys(currentCache.hotel).length}, cruise=${Object.keys(currentCache.cruise).length}`,
);
