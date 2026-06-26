import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { MY_MDAC_CITY_OPTIONS } from "./official-options";

const GOOGLE_TRANSLATE_V2_ENDPOINT = "https://translation.googleapis.com/language/translate/v2";
const CACHE_URL = new URL("./option-translations.zh.json", import.meta.url);

type MdacZhTranslationCache = {
  city: Record<string, string>;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function loadCache(): MdacZhTranslationCache {
  try {
    return JSON.parse(readFileSync(CACHE_URL, "utf8")) as MdacZhTranslationCache;
  } catch {
    return { city: {} };
  }
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
  if (!response.ok) {
    throw new Error(`Google Translate failed with ${response.status}: ${await response.text()}`);
  }
  const payload = (await response.json()) as {
    data?: { translations?: Array<{ translatedText?: string }> };
  };
  const translations = payload.data?.translations ?? [];
  if (translations.length !== values.length) {
    throw new Error(`Google Translate returned ${translations.length} translations for ${values.length} inputs`);
  }
  return translations.map((translation) => decodeHtmlEntities(clean(translation.translatedText)));
}

const apiKey =
  clean(process.env.GOOGLE_TRANSLATE_API_KEY) ||
  clean(process.env.GOOGLE_AI_API_KEY) ||
  clean(process.env.CLOUD_TRANSLATE_API_KEY) ||
  clean(process.env.GCP_TRANSLATE_API_KEY);

if (!apiKey) {
  throw new Error("Missing GOOGLE_TRANSLATE_API_KEY / GOOGLE_AI_API_KEY / CLOUD_TRANSLATE_API_KEY / GCP_TRANSLATE_API_KEY");
}

const cache = loadCache();
const pending = MY_MDAC_CITY_OPTIONS.filter((option) => !cache.city[option.value]);
const batchSize = 60;

for (let index = 0; index < pending.length; index += batchSize) {
  const batch = pending.slice(index, index + batchSize);
  const translations = await translateBatch(apiKey, batch.map((option) => option.label_en));
  batch.forEach((option, batchIndex) => {
    cache.city[option.value] = translations[batchIndex] || option.label_en;
  });
  writeFileSync(CACHE_URL, `${JSON.stringify(cache, null, 2)}\n`);
  console.log(`Translated ${Math.min(index + batch.length, pending.length)} / ${pending.length} MDAC city options`);
}

console.log(`Saved MDAC zh translation cache: city=${Object.keys(cache.city).length}`);
