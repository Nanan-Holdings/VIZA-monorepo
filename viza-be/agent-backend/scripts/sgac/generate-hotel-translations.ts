import * as dotenv from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { SGAC_HOTEL_NAME_OPTIONS } from "./official-options";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env.local") });
dotenv.config({ path: path.join(__dirname, "../../.env") });

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

const cachePath = path.join(__dirname, "option-translations.zh.json");
const cache = JSON.parse(readFileSync(cachePath, "utf8")) as {
  city: Record<string, string>;
  hotel: Record<string, string>;
  cruise: Record<string, string>;
};

const officialNames = SGAC_HOTEL_NAME_OPTIONS.map((option) => option.value);
const batchSize = 24;
const startBatch = Number(process.env.SGAC_HOTEL_START_BATCH ?? "0");
const stopBatch = Number(process.env.SGAC_HOTEL_STOP_BATCH ?? String(Math.ceil(officialNames.length / batchSize)));

type Translation = { officialName: string; labelZh: string };

// Verified property/group names take precedence over generated fallbacks.
const VERIFIED_HOTEL_NAMES_ZH: Record<string, string> = {
  "A HOTEL BUGIS": "武吉士艾酒店",
  "A HOTEL CHINATOWN": "牛车水艾酒店",
  "A HOTEL DESKER": "德士卡路艾酒店",
  "A HOTEL DICKSON": "狄克逊路艾酒店",
  "A HOTEL FARRER PARK": "花拉公园艾酒店",
  "A HOTEL JOO CHIAT": "如切艾酒店",
  "ABC HOSTEL": "艾比西青年旅舍",
  "AM HOTEL": "艾姆酒店",
  "AQ @ Westerhout": "韦斯特豪特艾丘酒店",
  "AMARA SINGAPORE": "新加坡阿马拉酒店",
  "HOTEL JEN ORCHARDGATEWAY SINGAPORE": "新加坡乌节门今旅酒店",
  "HOTEL JEN TANGLIN SINGAPORE": "新加坡东陵今旅酒店",
  "IBIS SINGAPORE ON BENCOOLEN": "新加坡明古连路宜必思酒店",
  "JW MARRIOTT HOTEL SINGAPORE SOUTH BEACH": "新加坡南岸杰威万豪酒店",
  "M HOTEL SINGAPORE": "新加坡艾姆酒店",
  "M SOCIAL SINGAPORE": "新加坡艾姆社交酒店",
  "METRO Y HOTEL": "美都酒店",
  "MKS BACKPACKERS' HOSTEL": "艾姆凯艾斯背包客旅舍",
  "SHANGRI-LA RASA SENTOSA, SINGAPORE": "新加坡圣淘沙香格里拉",
  "STUDIO M HOTEL": "新加坡艾姆工作室酒店",
  "VIBE HOTEL SINGAPORE ORCHARD": "新加坡乌节路维贝酒店",
  "VILLAGE HOTEL ALBERT COURT": "悦乐雅柏酒店",
  "VILLAGE HOTEL BUGIS": "悦乐武吉士酒店",
  "VILLAGE HOTEL CHANGI": "悦乐樟宜酒店",
  "VILLAGE HOTEL KATONG": "悦乐加东酒店",
  "VILLAGE HOTEL SENTOSA": "悦乐圣淘沙酒店",
  "W SINGAPORE SENTOSA COVE HOTEL": "新加坡圣淘沙湾达布尔尤酒店",
};

function applyVerifiedOverrides() {
  for (const [officialName, labelZh] of Object.entries(VERIFIED_HOTEL_NAMES_ZH)) {
    if (officialNames.includes(officialName)) cache.hotel[officialName] = labelZh;
  }
}

async function translateBatch(names: string[], batchNumber: number): Promise<Translation[]> {
  const candidates = names.map((officialName) => ({
    officialName,
    currentLabelZh: cache.hotel[officialName] ?? "",
  }));
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.SGAC_TRANSLATION_MODEL ?? "gpt-5.4-mini",
      tools: process.env.SGAC_TRANSLATION_WEB === "1" ? [{ type: "web_search" }] : undefined,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You are the Chinese localization editor for Singapore's SG Arrival Card hotel selector.",
                "Return one Simplified Chinese display label for every exact ICA English hotel name.",
                "Prefer the established Chinese property or hotel-group name used by the hotel, its group, Singapore tourism materials, or major Chinese travel platforms.",
                "Do not translate brand names by their ordinary dictionary meaning. When no established Chinese name exists, use a natural Mandarin transliteration and translate only the property type and location.",
                "Use standard Singapore place names such as 新加坡、乌节、武吉士、牛车水、克拉码头、芽笼、劳明达、花拉公园、如切、马里士他、巴耶利峇、小印度、圣淘沙、诺维娜、樟宜、明古连、惹兰勿刹. Do not confuse 马里士他 with 惹兰勿刹.",
                "The Chinese label must be understandable on its own and contain no Latin letters at all. Preserve digits, but transliterate letter-based registered brands and acronyms into natural Chinese too.",
                "Each item may include a currentLabelZh candidate. Keep it only if it is accurate and natural; correct mistranslated brands, incorrect Singapore locations, duplicated place names, and invented property types.",
                "When web search is available, use it for established property names and hotel-group Chinese sites. Do not replace a verified hotel name with a literal machine translation.",
                "Preserve each officialName byte-for-byte and return exactly one result per input item.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: JSON.stringify(candidates) }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "sgac_hotel_translations",
          strict: true,
          schema: {
            type: "object",
            properties: {
              translations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    officialName: { type: "string" },
                    labelZh: { type: "string" },
                  },
                  required: ["officialName", "labelZh"],
                  additionalProperties: false,
                },
              },
            },
            required: ["translations"],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI batch ${batchNumber} failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as {
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText = body.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")
    ?.text;
  if (!outputText) throw new Error(`OpenAI batch ${batchNumber} returned no output text`);
  const parsed = JSON.parse(outputText) as { translations: Translation[] };
  const expected = new Set(names);
  const returned = new Set(parsed.translations.map((item) => item.officialName));
  if (parsed.translations.length !== names.length || names.some((name) => !returned.has(name))) {
    throw new Error(`OpenAI batch ${batchNumber} did not return every official name`);
  }
  for (const item of parsed.translations) {
    if (!expected.has(item.officialName)) throw new Error(`Unexpected hotel in batch ${batchNumber}: ${item.officialName}`);
    if (!/[\u3400-\u9fff]/.test(item.labelZh)) throw new Error(`Missing Chinese label in batch ${batchNumber}: ${item.officialName}`);
  }
  return parsed.translations;
}

for (let batchNumber = startBatch; batchNumber < stopBatch; batchNumber += 1) {
  const names = officialNames.slice(batchNumber * batchSize, (batchNumber + 1) * batchSize);
  if (names.length === 0) break;
  const translations = await translateBatch(names, batchNumber);
  for (const item of translations) cache.hotel[item.officialName] = item.labelZh.trim();
  applyVerifiedOverrides();
  writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  console.log(`Translated SGAC hotel batch ${batchNumber + 1}/${Math.ceil(officialNames.length / batchSize)}`);
}

applyVerifiedOverrides();
writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");

const translatedKeys = Object.keys(cache.hotel);
const missing = officialNames.filter((name) => !cache.hotel[name]);
const extra = translatedKeys.filter((name) => !officialNames.includes(name));
if (missing.length > 0 || extra.length > 0) {
  throw new Error(`Hotel cache mismatch: missing=${missing.length}, extra=${extra.length}`);
}

console.log(`SGAC hotel translations ready: ${officialNames.length}`);
