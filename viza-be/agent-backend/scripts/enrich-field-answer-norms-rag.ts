/**
 * Enrich country RAG seeds with official-source field-answer norms.
 *
 * This script crawls the official/authorized source URLs already present in
 * knowledge-base/visa-rag-seeds/countries/*.json, extracts field-specific
 * answer guidance snippets, and writes one chunk into the country's existing
 * form_requirements document.
 *
 * Run:
 *   npm run enrich:field-answer-norms-rag -- --all
 *   npm run enrich:field-answer-norms-rag -- --countries indonesia,vietnam
 *   npm run enrich:field-answer-norms-rag -- --all --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(
  __dirname,
  "../../../knowledge-base/visa-rag-seeds/countries"
);

const OUTPUT_CHUNK_ID = "official_field_answer_norms";
const REQUEST_TIMEOUT_MS = 12000;
const MAX_URLS_PER_COUNTRY = 10;
const MAX_SNIPPETS_PER_TOPIC = 3;
const MAX_CHARS_PER_SNIPPET = 360;

const FIELD_TOPICS = [
  {
    key: "passport_identity",
    title: "Passport and identity fields",
    keywords: [
      "passport",
      "travel document",
      "document number",
      "surname",
      "given name",
      "family name",
      "date of birth",
      "place of birth",
      "nationality",
      "citizenship",
      "sex",
      "gender",
      "护照",
      "旅行证件",
      "姓名",
      "出生日期",
      "出生地",
      "国籍",
      "性别",
    ],
  },
  {
    key: "document_validity",
    title: "Issue, expiry, and validity fields",
    keywords: [
      "valid for",
      "validity",
      "expiration",
      "expiry",
      "expire",
      "date of issue",
      "issue date",
      "issuing authority",
      "place of issue",
      "签发",
      "有效期",
      "到期",
    ],
  },
  {
    key: "travel_plan",
    title: "Travel plan and port fields",
    keywords: [
      "arrival",
      "departure",
      "entry",
      "exit",
      "port",
      "checkpoint",
      "border",
      "flight",
      "itinerary",
      "ticket",
      "入境",
      "出境",
      "口岸",
      "航班",
      "行程",
    ],
  },
  {
    key: "stay_address",
    title: "Accommodation, host, and address fields",
    keywords: [
      "hotel",
      "accommodation",
      "address",
      "host",
      "sponsor",
      "guarantor",
      "inviting",
      "invitation",
      "住宿",
      "地址",
      "邀请",
      "担保",
      "接待",
    ],
  },
  {
    key: "purpose_work_study",
    title: "Purpose, occupation, work, and study fields",
    keywords: [
      "purpose",
      "tourism",
      "business",
      "work",
      "employment",
      "study",
      "occupation",
      "profession",
      "school",
      "employer",
      "目的",
      "旅游",
      "商务",
      "工作",
      "学习",
      "职业",
      "雇主",
      "学校",
    ],
  },
  {
    key: "funds_insurance_documents",
    title: "Funds, insurance, photo, and supporting-document fields",
    keywords: [
      "funds",
      "financial",
      "bank statement",
      "insurance",
      "medical insurance",
      "photo",
      "photograph",
      "supporting document",
      "upload",
      "evidence",
      "资金",
      "银行",
      "保险",
      "照片",
      "材料",
      "上传",
      "证明",
    ],
  },
] as const;

interface RagChunk {
  id: string;
  title: string;
  tags: string[];
  content: string;
}

interface RagDocument {
  slug: string;
  country: string;
  visaType: string;
  documentType: string;
  title: string;
  sourceUrl: string;
  chunks: RagChunk[];
}

interface CountryRagSeed {
  version: string;
  country: string;
  notes: string;
  documents: RagDocument[];
}

interface CliOptions {
  countries: string[];
  all: boolean;
  dryRun: boolean;
}

interface TopicEvidence {
  title: string;
  snippets: string[];
}

function normalizeCountry(value: string): string {
  return value.trim().toLowerCase();
}

function parseArgs(argv: string[]): CliOptions {
  const countries = new Set<string>();
  let all = false;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--all") {
      all = true;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--country" || arg === "--countries") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      value.split(",").map(normalizeCountry).filter(Boolean).forEach((country) => {
        countries.add(country);
      });
      index += 1;
      continue;
    }

    if (arg.startsWith("--country=") || arg.startsWith("--countries=")) {
      const value = arg.slice(arg.indexOf("=") + 1);
      value.split(",").map(normalizeCountry).filter(Boolean).forEach((country) => {
        countries.add(country);
      });
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { countries: Array.from(countries).sort(), all, dryRun };
}

function listSeedFiles(): string[] {
  return fs
    .readdirSync(SEED_DIR)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort()
    .map((fileName) => path.join(SEED_DIR, fileName));
}

function readSeed(filePath: string): CountryRagSeed {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as CountryRagSeed;
}

function writeSeed(filePath: string, seed: CountryRagSeed): void {
  fs.writeFileSync(filePath, `${JSON.stringify(seed, null, 2)}\n`);
}

function resolveSeedFiles(options: CliOptions): string[] {
  const files = listSeedFiles();
  if (options.all || options.countries.length === 0) return files;

  const wanted = new Set(options.countries);
  return files.filter((filePath) => wanted.has(path.basename(filePath, ".json")));
}

function collectSourceUrls(seed: CountryRagSeed): string[] {
  const urls = new Set<string>();

  for (const document of seed.documents) {
    if (document.sourceUrl?.startsWith("http")) urls.add(document.sourceUrl);
    for (const chunk of document.chunks) {
      const matches = chunk.content.match(/https?:\/\/[^\s);]+/g) ?? [];
      matches.forEach((url) => urls.add(url.replace(/[.,]+$/, "")));
    }
  }

  return Array.from(urls).slice(0, MAX_URLS_PER_COUNTRY);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|li|tr|td|th|div|section|article|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 900);
}

function isAsciiKeyword(value: string): boolean {
  return /^[a-z0-9 -]+$/i.test(value);
}

function matchesKeyword(sentence: string, keyword: string): boolean {
  const lower = sentence.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase();
  if (!isAsciiKeyword(keyword)) return lower.includes(normalizedKeyword);

  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(sentence);
}

function isNoisySentence(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return [
    "cookie",
    "cookies",
    "covid-19",
    "wuhan",
    "fully vaccinated",
    "ease of doing business",
    "efficient delivery of government services",
    "p/cve",
    "integrated border management fund",
    "digital border and migration management",
    "migration management in eu member states",
    "networked state",
    "diaspora",
    "new domains",
    "new addresses",
    "click here",
    "national portal on immigration",
    "please visit these new addresses",
    "menuju networked",
  ].some((noise) => lower.includes(noise));
}

function hasNormativeSignal(sentence: string): boolean {
  return [
    "must",
    "required",
    "requirement",
    "should",
    "valid",
    "validity",
    "provide",
    "submit",
    "present",
    "upload",
    "apply",
    "application",
    "eligible",
    "permitted",
    "not permitted",
    "not required",
    "enter",
    "exit",
    "arrival",
    "departure",
    "passport",
    "travel document",
    "address",
    "hotel",
    "accommodation",
    "invitation",
    "guarantor",
    "sponsor",
    "funds",
    "financial",
    "insurance",
    "photo",
    "purpose",
    "stay",
    "visa",
    "e-visa",
    "evisa",
    "需要",
    "必须",
    "有效",
    "提交",
    "上传",
    "入境",
    "出境",
    "护照",
    "地址",
    "住宿",
    "邀请",
    "担保",
    "资金",
    "保险",
    "照片",
  ].some((signal) => matchesKeyword(sentence, signal));
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "VIZA field-answer-norms audit/1.0",
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text|html|json|xml/i.test(contentType)) return null;
    return stripHtml(await response.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function snippetKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, " ").trim();
}

function addSnippet(topic: TopicEvidence, snippet: string): void {
  const normalized = snippetKey(snippet);
  if (!normalized) return;
  if (topic.snippets.some((existing) => snippetKey(existing) === normalized)) return;
  if (topic.snippets.length >= MAX_SNIPPETS_PER_TOPIC) return;
  topic.snippets.push(snippet.slice(0, MAX_CHARS_PER_SNIPPET));
}

function extractEvidence(sentences: string[], urls: string[]): Map<string, TopicEvidence> {
  const evidence = new Map<string, TopicEvidence>();

  for (const topic of FIELD_TOPICS) {
    evidence.set(topic.key, { title: topic.title, snippets: [] });
  }

  for (const sentence of sentences) {
    if (isNoisySentence(sentence)) continue;
    if (!hasNormativeSignal(sentence)) continue;
    const lower = sentence.toLowerCase();
    for (const topic of FIELD_TOPICS) {
      if (topic.keywords.some((keyword) => matchesKeyword(lower, keyword))) {
        addSnippet(evidence.get(topic.key)!, sentence);
      }
    }
  }

  const used = new Map<string, TopicEvidence>();
  for (const [key, topic] of evidence) {
    if (topic.snippets.length > 0) used.set(key, topic);
  }

  if (used.size === 0 && urls.length > 0) {
    const generic = evidence.get("passport_identity")!;
    addSnippet(
      generic,
      "Crawler reached official or authorized source URLs, but did not extract a concise field-specific sentence. Keep this country's field answers constrained to official forms, passport data, and source URLs already listed in the country RAG seed."
    );
    used.set("passport_identity", generic);
  }

  return used;
}

function buildChunkContent(seed: CountryRagSeed, evidence: Map<string, TopicEvidence>, urls: string[]): string {
  const lines = [
    `Official-source field answer norms for ${seed.country}.`,
    "Use these norms only as filling guidance; if a live official form, passport, or uploaded document shows a more specific value, that document controls the answer.",
    "",
    `Crawled source URLs: ${urls.join(" ; ")}`,
    "",
  ];

  for (const topic of evidence.values()) {
    lines.push(`${topic.title}:`);
    for (const snippet of topic.snippets) {
      lines.push(`- ${snippet}`);
    }
    lines.push("");
  }

  lines.push(
    "Answering rule: for closed-list fields, prefer the exact official option label/value. For document-backed fields, copy the passport, official identity document, application account, itinerary, invitation, accommodation, insurance, funds, or uploaded support document rather than guessing from a city, country, or prior answer."
  );

  return lines.join("\n").trim();
}

function upsertFieldNormChunk(seed: CountryRagSeed, content: string): void {
  const formDocument = seed.documents.find((document) => document.documentType === "form_requirements");
  if (!formDocument) {
    throw new Error(`${seed.country} has no form_requirements document`);
  }

  const nextChunk: RagChunk = {
    id: OUTPUT_CHUNK_ID,
    title: "Official-source field answer norms",
    tags: [
      "field-guidance",
      "answer-norms",
      "official-source",
      "form-requirements",
      seed.country,
    ],
    content,
  };

  const existingIndex = formDocument.chunks.findIndex((chunk) => chunk.id === OUTPUT_CHUNK_ID);
  if (existingIndex >= 0) {
    formDocument.chunks[existingIndex] = nextChunk;
  } else {
    formDocument.chunks.push(nextChunk);
  }
}

async function enrichSeed(filePath: string, options: CliOptions): Promise<boolean> {
  const seed = readSeed(filePath);
  const urls = collectSourceUrls(seed);
  const sentences: string[] = [];
  let fetched = 0;

  for (const url of urls) {
    const text = await fetchText(url);
    if (!text) continue;
    fetched += 1;
    sentences.push(...splitSentences(text));
  }

  const evidence = extractEvidence(sentences, urls);
  if (evidence.size === 0) {
    console.log(`${seed.country}: no field evidence extracted`);
    return false;
  }

  const content = buildChunkContent(seed, evidence, urls);
  console.log(`${seed.country}: ${fetched}/${urls.length} URLs fetched, ${evidence.size} topic(s) extracted`);

  if (!options.dryRun) {
    upsertFieldNormChunk(seed, content);
    writeSeed(filePath, seed);
  }

  return true;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const files = resolveSeedFiles(options);
  let enriched = 0;

  console.log("Starting field-answer norm enrichment");
  console.log(`Seed directory: ${SEED_DIR}`);
  console.log(`Countries: ${files.length}`);
  console.log(`Mode: ${options.dryRun ? "dry-run" : "write"}`);

  for (const filePath of files) {
    if (await enrichSeed(filePath, options)) enriched += 1;
  }

  console.log("Field-answer norm enrichment complete");
  console.log(`Countries enriched: ${enriched}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
