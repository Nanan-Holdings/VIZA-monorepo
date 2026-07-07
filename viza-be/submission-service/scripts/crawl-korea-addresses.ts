import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { searchKoreaAddresses, type KoreaAddressLanguage, type KoreaAddressRecord } from "../src/korea-eform/address-search";

interface CrawlArgs {
  out: string;
  keywords: string[];
  language: KoreaAddressLanguage;
  maxPages: number;
  countPerPage: number;
  delayMs: number;
  resume: boolean;
}

const DEFAULT_ENGLISH_KEYWORDS = [
  "Seoul",
  "Busan",
  "Daegu",
  "Incheon",
  "Gwangju",
  "Daejeon",
  "Ulsan",
  "Sejong",
  "Gyeonggi-do",
  "Gangwon-do",
  "Chungcheongbuk-do",
  "Chungcheongnam-do",
  "Jeollabuk-do",
  "Jeollanam-do",
  "Gyeongsangbuk-do",
  "Gyeongsangnam-do",
  "Jeju-do",
];

const DEFAULT_KOREAN_KEYWORDS = [
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
];

function readFlag(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  return fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseArgs(): CrawlArgs {
  const language = (readFlag("language", "en") ?? "en") as KoreaAddressLanguage;
  if (language !== "en" && language !== "ko") throw new Error("--language must be en or ko");

  const keywordFile = readFlag("keyword-file");
  const keywords = keywordFile
    ? fs.readFileSync(path.resolve(keywordFile), "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : (readFlag("keywords")?.split(",").map((keyword) => keyword.trim()).filter(Boolean) ?? (language === "ko" ? DEFAULT_KOREAN_KEYWORDS : DEFAULT_ENGLISH_KEYWORDS));

  return {
    out: path.resolve(readFlag("out", path.join("output", "korea-addresses.jsonl")) ?? path.join("output", "korea-addresses.jsonl")),
    keywords,
    language,
    maxPages: Number.parseInt(readFlag("max-pages", "10") ?? "10", 10),
    countPerPage: Number.parseInt(readFlag("count-per-page", "100") ?? "100", 10),
    delayMs: Number.parseInt(readFlag("delay-ms", "500") ?? "500", 10),
    resume: hasFlag("resume"),
  };
}

function loadSeen(out: string): Set<string> {
  const seen = new Set<string>();
  if (!fs.existsSync(out)) return seen;
  const content = fs.readFileSync(out, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line) as KoreaAddressRecord;
      const key = record.buildingManagementNo || `${record.zipNo}:${record.roadAddress}`;
      seen.add(key);
    } catch {
      // Ignore partial trailing lines from interrupted crawls.
    }
  }
  return seen;
}

function recordKey(record: KoreaAddressRecord): string {
  return record.buildingManagementNo || `${record.zipNo}:${record.roadAddress}`;
}

async function main() {
  const args = parseArgs();
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  const seen = args.resume ? loadSeen(args.out) : new Set<string>();
  const stream = fs.createWriteStream(args.out, { flags: args.resume ? "a" : "w" });
  let written = 0;

  try {
    for (const keyword of args.keywords) {
      for (let page = 1; page <= args.maxPages; page += 1) {
        const result = await searchKoreaAddresses({
          keyword,
          language: args.language,
          page,
          countPerPage: args.countPerPage,
        });

        console.log(`[${args.language}] ${keyword} page ${page}: ${result.records.length}/${result.totalCount} ${result.errorCode} ${result.errorMessage}`);
        if (result.errorCode !== "0" || result.records.length === 0) break;

        for (const record of result.records) {
          const key = recordKey(record);
          if (seen.has(key)) continue;
          seen.add(key);
          stream.write(`${JSON.stringify({ ...record, crawlKeyword: keyword, crawlLanguage: args.language })}\n`);
          written += 1;
        }

        if (page * args.countPerPage >= result.totalCount) break;
        await sleep(args.delayMs);
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      stream.end((error: Error | null | undefined) => (error ? reject(error) : resolve()));
    });
  }

  console.log(`Wrote ${written} new Korea address records to ${args.out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
