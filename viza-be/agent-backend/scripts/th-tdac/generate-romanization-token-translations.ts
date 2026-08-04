import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  TDAC_OFFICIAL_DISTRICTS_BY_PROVINCE,
  TDAC_OFFICIAL_SUBDISTRICTS_BY_PROVINCE_DISTRICT,
} from "./tdac-official-dropdowns.generated";

type TokenTranslationCache = {
  _meta: {
    generated_at: string;
    source: string;
    model: string;
    token_count: number;
  };
  translations: Record<string, string>;
};

type OpenAiResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

const OUTPUT_URL = new URL("./romanization-token-translations.zh.json", import.meta.url);
const MODEL = process.env.TDAC_TRANSLATION_MODEL?.trim() || "gpt-4.1-mini";
const BATCH_SIZE = 120;

const hasChineseOnly = (value: string): boolean =>
  /[\u3400-\u9fff]/.test(value) && !/[A-Za-z]/.test(value);

const allOfficialTokens = (): string[] => {
  const names = [
    ...Object.values(TDAC_OFFICIAL_DISTRICTS_BY_PROVINCE).flat().map((item) => item.label),
    ...Object.values(TDAC_OFFICIAL_SUBDISTRICTS_BY_PROVINCE_DISTRICT).flat(),
  ];
  return [...new Set(
    names.flatMap((name) => name.toUpperCase().match(/[A-Z0-9]+/g) ?? []),
  )].sort();
};

const readExistingTranslations = (): Record<string, string> => {
  if (!existsSync(OUTPUT_URL)) return {};
  const parsed = JSON.parse(readFileSync(OUTPUT_URL, "utf8")) as Partial<TokenTranslationCache>;
  return Object.fromEntries(
    Object.entries(parsed.translations ?? {}).filter(([, value]) => hasChineseOnly(value)),
  );
};

const powershellRequest = (body: string): OpenAiResponse => {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is required to generate TDAC romanization translations");
  }
  const command = [
    "$ErrorActionPreference='Stop'",
    "$OutputEncoding=[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new()",
    "$body=[Console]::In.ReadToEnd()",
    "$response=Invoke-WebRequest -UseBasicParsing -Uri 'https://api.openai.com/v1/chat/completions' -Headers @{Authorization=\"Bearer $env:OPENAI_API_KEY\"} -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 180",
    "$json=[Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray())",
    "[Console]::Out.Write($json)",
  ].join("; ");
  const result = spawnSync("powershell", ["-NoProfile", "-Command", command], {
    input: body,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `PowerShell OpenAI request failed (${result.status})`);
  }
  return JSON.parse(result.stdout) as OpenAiResponse;
};

const translateBatch = (tokens: string[]): Record<string, string> => {
  const body = JSON.stringify({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You transliterate Thai geographic names from official RTGS romanization into concise Simplified Chinese.",
          "Each input token is one complete Thai place-name word and may contain several syllables.",
          "Return a JSON object with exactly the same keys.",
          "Values must contain Chinese characters only, normally 1-6 characters, with no Latin letters, punctuation, explanations, or administrative suffixes.",
          "Use established Chinese spellings for well-known Thai names where available; otherwise use a natural phonetic transliteration of the whole token.",
          "Never transliterate letter by letter.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Transliterate these RTGS tokens: ${JSON.stringify(tokens)}`,
      },
    ],
  });
  const response = powershellRequest(body);
  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error(response.error?.message ?? "OpenAI returned no translation content");
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const translations: Record<string, string> = {};
  for (const token of tokens) {
    const value = typeof parsed[token] === "string" ? parsed[token].trim() : "";
    if (!hasChineseOnly(value)) {
      throw new Error(`Invalid Chinese transliteration for ${token}: ${String(parsed[token] ?? "")}`);
    }
    translations[token] = value;
  }
  return translations;
};

const writeCache = (translations: Record<string, string>, tokenCount: number): void => {
  const sorted = Object.fromEntries(Object.entries(translations).sort(([left], [right]) => left.localeCompare(right)));
  const cache: TokenTranslationCache = {
    _meta: {
      generated_at: new Date().toISOString(),
      source: "Official Thailand Immigration Bureau TDAC romanized option inventory; AI-assisted Simplified Chinese phonetic display labels",
      model: MODEL,
      token_count: tokenCount,
    },
    translations: sorted,
  };
  writeFileSync(OUTPUT_URL, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
};

const main = (): void => {
  const tokens = allOfficialTokens();
  const translations = readExistingTranslations();
  const missing = tokens.filter((token) => !translations[token]);
  for (let index = 0; index < missing.length; index += BATCH_SIZE) {
    const batch = missing.slice(index, index + BATCH_SIZE);
    Object.assign(translations, translateBatch(batch));
    writeCache(translations, tokens.length);
    console.log(`Generated ${Math.min(index + batch.length, missing.length)}/${missing.length} missing TDAC tokens`);
  }
  writeCache(translations, tokens.length);
  console.log(`TDAC romanization cache complete: ${tokens.length} tokens`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

