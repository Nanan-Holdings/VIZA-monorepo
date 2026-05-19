/**
 * RAG ingestion: official visa photo requirements.
 *
 * Crawls official country seed sources plus curated official photo sources,
 * then writes photo_requirements documents into visa_documents + visa_chunks.
 *
 * Run:
 *   npm run ingest:photo-requirements-rag
 *   npm run ingest:photo-requirements-rag -- --countries us,uk,france
 *   npm run ingest:photo-requirements-rag -- --dry-run
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { load } from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = "text-embedding-3-small";
const SEED_DIR = path.resolve(
  __dirname,
  "../../../knowledge-base/visa-rag-seeds/countries"
);

interface RagDocument {
  slug: string;
  country: string;
  visaType: string;
  documentType: string;
  title: string;
  sourceUrl: string;
  chunks: Array<{
    id: string;
    title: string;
    tags: string[];
    content: string;
  }>;
}

interface CountryRagSeed {
  country: string;
  documents: RagDocument[];
}

interface CliOptions {
  countries: string[];
  dryRun: boolean;
  skipFetch: boolean;
}

interface PhotoProfile {
  id: string;
  title: string;
  sourceUrl: string;
  summary: string;
  requirements: string[];
  warnings: string[];
}

interface CrawledSource {
  url: string;
  title: string;
  excerpts: string[];
  error: string | null;
}

const SCHENGEN_COUNTRIES = new Set([
  "austria",
  "belgium",
  "bulgaria",
  "croatia",
  "czech_republic",
  "denmark",
  "estonia",
  "finland",
  "france",
  "germany",
  "greece",
  "hungary",
  "iceland",
  "italy",
  "latvia",
  "liechtenstein",
  "lithuania",
  "luxembourg",
  "malta",
  "netherlands",
  "norway",
  "poland",
  "portugal",
  "romania",
  "slovakia",
  "slovenia",
  "spain",
  "sweden",
  "switzerland",
]);

const PHOTO_TERMS = [
  "photo",
  "photograph",
  "passport-size",
  "passport size",
  "portrait",
  "digital image",
  "biometric",
  "照片",
  "画像",
  "写真",
  "паспорт",
  "foto",
  "fotografía",
  "fotografia",
];

const PROFILES: Record<string, PhotoProfile> = {
  us: {
    id: "us",
    title: "U.S. Visa Photo Requirements",
    sourceUrl: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html",
    summary: "For DS-160 nonimmigrant visa applications, the applicant uploads a digital image while completing the online form. The U.S. Department of State says acceptance is at the discretion of the embassy or consulate.",
    requirements: [
      "Use a color photo taken within the last 6 months, in full-face view, directly facing the camera.",
      "Use a plain white or off-white background with neutral expression and both eyes open.",
      "Head size should be 22 mm to 35 mm, or 50% to 69% of total image height.",
      "For digital upload, use JPEG/JPG, square aspect ratio, 600 x 600 pixels, and no more than 240 KB where the DS-160 digital image requirement applies.",
    ],
    warnings: [
      "Eyeglasses are generally not allowed in new U.S. visa photos except rare medical cases.",
      "Do not digitally enhance, retouch, or alter the photo to change appearance.",
      "Bring a compliant printed photo if the DS-160 photo upload fails or the local post asks for one.",
    ],
  },
  uk: {
    id: "uk",
    title: "UK Visitor Visa Photo and Biometrics Requirements",
    sourceUrl: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa",
    summary: "For UK Standard Visitor applications, the official process normally requires an online application and then identity proof at a visa application centre, where fingerprints and a photo may be taken.",
    requirements: [
      "Prepare a clear passport-style photo only if the online flow or visa application centre asks for an upload or supporting image.",
      "For the appointment, follow the visa application centre instructions for photo and biometric capture.",
      "The photo or biometric image must match the applicant's current appearance and passport identity.",
    ],
    warnings: [
      "Do not treat a self-uploaded photo as a replacement for UKVI biometrics if an appointment is required.",
      "Follow the appointment confirmation and UKVI/VAC instructions if they differ from the generic photo guidance.",
    ],
  },
  schengen: {
    id: "schengen",
    title: "Schengen Visa Photo Requirements",
    sourceUrl: "https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/visa-policy/applying-schengen-visa_en",
    summary: "European Commission Schengen guidance lists a photo in compliance with ICAO standards among common short-stay visa application documents.",
    requirements: [
      "Use a recent ICAO-compliant passport-style photo for the Schengen short-stay application.",
      "Face forward with a clear, unobstructed face and a plain light background.",
      "Check the consulate or visa centre for country-specific print size, number of photos, and upload requirements.",
    ],
    warnings: [
      "Different Schengen consulates and outsourced visa centres can add local photo handling rules.",
      "Use the main-destination country's appointment checklist as the final authority.",
    ],
  },
  canada: {
    id: "canada",
    title: "Canada Temporary Resident Visa Photo Specifications",
    sourceUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/temporary-resident-visa-application-photograph-specifications.html",
    summary: "IRCC's temporary resident visa photograph specifications require two compliant photos for paper applications, unless biometrics apply.",
    requirements: [
      "Photos must be identical, clear, well defined, and taken within the last 6 months.",
      "Use a plain white or light-coloured background and a neutral expression with mouth closed.",
      "Frame size must be at least 35 mm x 45 mm; chin-to-crown head size must be 31 mm to 36 mm.",
      "Digital photographs must not be altered.",
    ],
    warnings: [
      "If biometrics are required, IRCC guidance says paper photos may not be required.",
      "If photos fail the specification, IRCC may require new photos before processing.",
    ],
  },
  australia: {
    id: "australia",
    title: "Australia Immi App Applicant Photo Guidance",
    sourceUrl: "https://immi.homeaffairs.gov.au/help-support/meeting-our-requirements/biometrics/australian-immi-app",
    summary: "The Department of Home Affairs may require biometric identifiers. Eligible applicants can use the Australian Immi App to take a live applicant photo after scanning passport details.",
    requirements: [
      "Stand in front of a light-coloured wall with no objects in the background.",
      "Face forward, look directly at the camera, keep eyes open and visible, and remove glasses if practical.",
      "Avoid shadows and make sure nothing covers the face or eyes.",
    ],
    warnings: [
      "If the biometrics letter does not allow app capture, attend the Australian Biometrics Collection Centre named in the letter.",
      "Heavy makeup may affect suitability of the photograph.",
    ],
  },
  indonesia: {
    id: "indonesia",
    title: "Indonesia Online Visa Photo Requirements",
    sourceUrl: "https://www.imigrasi.go.id/faq/visa/apa-saja-dokumen-persyaratan-untuk-mengajukan-visa-online",
    summary: "Indonesia Immigration's visa FAQ lists a passport-size photograph as a required online visa document.",
    requirements: [
      "Upload a passport-size photograph.",
      "Accepted formats are JPG, JPEG, or PNG.",
      "Maximum file size is 200 KB for the photo listed in the online visa FAQ.",
    ],
    warnings: [
      "Use the official evisa.imigrasi.go.id portal and verify any visa-category-specific upload notes in the application screen.",
    ],
  },
  india: {
    id: "india",
    title: "India Visa Digital Photograph Requirements",
    sourceUrl: "https://indianvisaonline.gov.in/evisa/tvoa.html",
    summary: "The Government of India e-Visa page requires a digital photograph upload along with the visa application.",
    requirements: [
      "Use JPEG format.",
      "File size should be between 10 KB and 1 MB for e-Visa photo upload.",
      "Height and width must be equal, with full face, front view, eyes open, and no spectacles.",
      "Use a plain light-coloured or white background with no shadows and no borders.",
    ],
    warnings: [
      "Regular visa photo limits can differ from e-Visa limits, so check the chosen India visa portal before upload.",
    ],
  },
  japan: {
    id: "japan",
    title: "Japan Visa Application Photo Requirement",
    sourceUrl: "https://www.mofa.go.jp/files/000124525.pdf",
    summary: "Japan's official visa application form includes a photo box specifying 45 mm x 35 mm, or 2 in x 1.4 in.",
    requirements: [
      "Prepare a 45 mm x 35 mm visa application photo unless the local Japanese mission gives a different upload instruction.",
      "Use a recent, clear, front-facing passport-style image that matches the applicant's current appearance.",
      "For eVISA, follow the upload screen and the Japanese overseas establishment with jurisdiction over the applicant's residence.",
    ],
    warnings: [
      "Japan visa documents and submission method vary by residence country and local Japanese mission.",
    ],
  },
  singapore: {
    id: "singapore",
    title: "Singapore ICA Photo Guidelines",
    sourceUrl: "https://www.ica.gov.sg/photo-guidelines",
    summary: "ICA photo guidelines are based on ISO and ICAO specifications. Singapore visa detail pages refer applicants to the ICA Photo Guidelines for photo requirements.",
    requirements: [
      "Submit a new colour photograph for a new application.",
      "For online photo submission, ICA lists 400 x 514 pixels as the recommended dimension.",
      "Accepted online file extensions include jpg, jpeg, heic, heif, and png with a maximum file size of 8 MB.",
      "Do not alter or enhance facial features with photo editing software.",
    ],
    warnings: [
      "Selfies are not recommended because they commonly delay applications.",
      "Printed photos for hardcopy submission must be matte or semi-matte.",
    ],
  },
  south_korea: {
    id: "south_korea",
    title: "Korea Visa Application Photo Requirement",
    sourceUrl: "https://www.visa.go.kr/downfile/VisaapplicationForm_EN.pdf",
    summary: "The official Korea visa application form states that the photo should be a passport photo sized 35 mm x 45 mm.",
    requirements: [
      "Use a 35 mm x 45 mm passport photo.",
      "The photo should be colour, taken within the last 6 months, full face without hat, front view, and against a white or off-white background.",
    ],
    warnings: [
      "Do not confuse K-ETA identity photo handling with consular C-3 visa photo requirements.",
    ],
  },
  thailand: {
    id: "thailand",
    title: "Thailand e-Visa Photo Upload Guidance",
    sourceUrl: "https://www.thaievisa.go.th/static/English-Manual.pdf",
    summary: "The official Thai e-Visa manual covers application photo upload in the online workflow. Requirements can be enforced by the upload screen and local Royal Thai Embassy rules.",
    requirements: [
      "Prepare a recent passport-style photograph for the Thai e-Visa application upload.",
      "Use a clear front-facing image with a plain background and no obstruction of the face.",
      "Follow any file type, size, and crop instruction shown in the Thai e-Visa upload step.",
    ],
    warnings: [
      "Thai embassy/consulate document checklists can vary by residence country and visa route.",
    ],
  },
  vietnam: {
    id: "vietnam",
    title: "Vietnam e-Visa Portrait Photo Requirement",
    sourceUrl: "https://evisa.xuatnhapcanh.gov.vn/en_US/khai-thi-thuc-dien-tu/cap-thi-thuc-dien-tu?type=edit",
    summary: "Vietnam's national e-Visa portal requires a portrait photograph and a passport data page image.",
    requirements: [
      "Upload a portrait photograph in the e-Visa form.",
      "The portal guidance says the portrait photo size must be under 50 KB.",
      "The passport data page image is separate and must be under 200 KB.",
    ],
    warnings: [
      "Do not upload the passport data page where the portrait photo is requested.",
    ],
  },
};

const PROFILE_BY_COUNTRY: Record<string, string> = {
  us: "us",
  uk: "uk",
  canada: "canada",
  australia: "australia",
  indonesia: "indonesia",
  india: "india",
  japan: "japan",
  singapore: "singapore",
  south_korea: "south_korea",
  thailand: "thailand",
  vietnam: "vietnam",
};

const fetchCache = new Map<string, Promise<CrawledSource>>();

function normalizeCountryArg(value: string): string {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    united_states: "us",
    usa: "us",
    "united states": "us",
    united_kingdom: "uk",
    "united kingdom": "uk",
    britain: "uk",
  };
  return aliases[normalized] ?? normalized;
}

function parseArgs(argv: string[]): CliOptions {
  const countries = new Set<string>();
  let dryRun = false;
  let skipFetch = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all") continue;

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--skip-fetch") {
      skipFetch = true;
      continue;
    }

    if (arg === "--country" || arg === "--countries") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      value.split(",").map(normalizeCountryArg).filter(Boolean).forEach((country) => {
        countries.add(country);
      });
      index += 1;
      continue;
    }

    if (arg.startsWith("--country=") || arg.startsWith("--countries=")) {
      const value = arg.slice(arg.indexOf("=") + 1);
      value.split(",").map(normalizeCountryArg).filter(Boolean).forEach((country) => {
        countries.add(country);
      });
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    countries: Array.from(countries).sort(),
    dryRun,
    skipFetch,
  };
}

function listSeedFiles(): string[] {
  return fs
    .readdirSync(SEED_DIR)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort()
    .map((fileName) => path.join(SEED_DIR, fileName));
}

function readSeed(filePath: string): CountryRagSeed {
  const raw = fs.readFileSync(filePath, "utf-8");
  const seed = JSON.parse(raw) as CountryRagSeed;
  if (!seed.country || !Array.isArray(seed.documents) || seed.documents.length === 0) {
    throw new Error(`Invalid country seed: ${filePath}`);
  }
  return seed;
}

function resolveSeeds(options: CliOptions): CountryRagSeed[] {
  const seeds = listSeedFiles().map(readSeed);
  if (options.countries.length === 0) return seeds;

  const requested = new Set(options.countries);
  const available = new Set(seeds.map((seed) => seed.country));
  for (const country of requested) {
    if (!available.has(country)) {
      throw new Error(
        `No country seed found for ${country}. Available: ${Array.from(available).sort().join(", ")}`
      );
    }
  }

  return seeds.filter((seed) => requested.has(seed.country));
}

function profileForCountry(seed: CountryRagSeed): PhotoProfile {
  const profileId = SCHENGEN_COUNTRIES.has(seed.country)
    ? "schengen"
    : PROFILE_BY_COUNTRY[seed.country];

  if (profileId && PROFILES[profileId]) return PROFILES[profileId];

  const firstDocument = seed.documents[0];
  return {
    id: "official-portal-fallback",
    title: `${seed.country.replace(/_/g, " ")} Visa Photo Requirements`,
    sourceUrl: firstDocument?.sourceUrl ?? "",
    summary: "The official country workflow mentions photo or document upload requirements, but this crawler did not find a detailed standalone photo specification. Use the destination's official portal, appointment checklist, or upload screen as the final authority.",
    requirements: [
      "Prepare a recent, clear, front-facing passport-style photo.",
      "Use a plain light background and keep the face unobstructed.",
      "Follow the file type, file size, crop, and print-size limits shown by the official application portal or visa centre checklist.",
    ],
    warnings: [
      "Do not assume DS-160, Schengen, or another country's photo dimensions apply unless the destination's official source says so.",
    ],
  };
}

function seedVisaType(seed: CountryRagSeed): string {
  return seed.documents[0]?.visaType ?? "visitor_visa";
}

function stripWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasPhotoTerm(text: string): boolean {
  const lower = text.toLowerCase();
  return PHOTO_TERMS.some((term) => lower.includes(term.toLowerCase()));
}

function extractPhotoExcerpts(text: string): string[] {
  const normalized = stripWhitespace(text);
  const chunks = normalized
    .split(/(?<=[.!?。；;])\s+|\n+/)
    .map(stripWhitespace)
    .filter((item) => item.length >= 35 && hasPhotoTerm(item));

  const excerpts: string[] = [];
  for (const chunk of chunks) {
    if (excerpts.some((existing) => existing.includes(chunk) || chunk.includes(existing))) {
      continue;
    }
    excerpts.push(chunk.slice(0, 700));
    if (excerpts.length >= 5) break;
  }
  return excerpts;
}

async function fetchSource(url: string): Promise<CrawledSource> {
  if (!url) {
    return { url, title: "Unknown source", excerpts: [], error: "missing_url" };
  }

  const cached = fetchCache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        headers: { "User-Agent": "VIZA-photo-requirements-rag/1.0" },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return {
          url,
          title: url,
          excerpts: [],
          error: `http_${response.status}`,
        };
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/pdf")) {
        return {
          url,
          title: path.basename(new URL(url).pathname) || url,
          excerpts: [],
          error: "pdf_not_parsed",
        };
      }

      const html = await response.text();
      const $ = load(html);
      $("script, style, nav, footer, header, noscript").remove();
      const title = stripWhitespace($("title").first().text()) || url;
      const bodyText = $("body").text();
      return {
        url,
        title,
        excerpts: extractPhotoExcerpts(bodyText),
        error: null,
      };
    } catch (error) {
      return {
        url,
        title: url,
        excerpts: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })();

  fetchCache.set(url, promise);
  return promise;
}

async function getEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_KEY || OPENAI_KEY === "your_openai_api_key_here") return null;

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      console.warn(`Embedding failed (${response.status}) for photo requirements chunk`);
      return null;
    }

    const data = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    return data.data?.[0]?.embedding ?? null;
  } catch (error) {
    console.warn(`Embedding request errored: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function buildStaticChunk(seed: CountryRagSeed, profile: PhotoProfile): string {
  return [
    `# ${profile.title}`,
    "",
    `Country: ${seed.country}`,
    `Visa type: ${seedVisaType(seed)}`,
    "Document type: photo_requirements",
    `Primary official source: ${profile.sourceUrl}`,
    "",
    profile.summary,
    "",
    "Requirements:",
    ...profile.requirements.map((item) => `- ${item}`),
    "",
    "Warnings:",
    ...profile.warnings.map((item) => `- ${item}`),
  ].join("\n");
}

function buildCrawledChunk(seed: CountryRagSeed, sources: CrawledSource[]): string {
  const excerptLines = sources.flatMap((source) =>
    source.excerpts.map((excerpt) => `Source: ${source.title}\nURL: ${source.url}\nExcerpt: ${excerpt}`)
  );

  const fallbackLines = sources
    .filter((source) => source.excerpts.length === 0)
    .slice(0, 4)
    .map((source) => `Source checked: ${source.title}\nURL: ${source.url}\nStatus: ${source.error ?? "no_photo_excerpt_found"}`);

  return [
    `# Crawled official photo-related excerpts for ${seed.country}`,
    "",
    `Country: ${seed.country}`,
    `Visa type: ${seedVisaType(seed)}`,
    "Document type: photo_requirements",
    "",
    ...(excerptLines.length > 0 ? excerptLines : fallbackLines),
  ].join("\n\n");
}

async function deleteExistingPhotoDocument(
  supabase: ReturnType<typeof createClient>,
  country: string,
  visaType: string
): Promise<void> {
  const { data, error } = await supabase
    .from("visa_documents")
    .select("id")
    .eq("country", country)
    .eq("visa_type", visaType)
    .eq("document_type", "photo_requirements")
    .eq("title", "Visa Photo Requirements");

  if (error) throw new Error(`Failed to query existing photo document: ${error.message}`);

  for (const row of data ?? []) {
    const id = (row as { id: string }).id;
    const { error: chunkError } = await supabase.from("visa_chunks").delete().eq("document_id", id);
    if (chunkError) throw new Error(`Failed to delete photo chunks: ${chunkError.message}`);

    const { error: documentError } = await supabase.from("visa_documents").delete().eq("id", id);
    if (documentError) throw new Error(`Failed to delete photo document: ${documentError.message}`);
  }
}

async function insertPhotoDocument(
  supabase: ReturnType<typeof createClient>,
  seed: CountryRagSeed,
  profile: PhotoProfile,
  sources: CrawledSource[]
): Promise<{ inserted: number; embedded: number }> {
  const visaType = seedVisaType(seed);
  await deleteExistingPhotoDocument(supabase, seed.country, visaType);

  const { data: insertedDocument, error: documentError } = await supabase
    .from("visa_documents")
    .insert({
      country: seed.country,
      visa_type: visaType,
      document_type: "photo_requirements",
      title: "Visa Photo Requirements",
      source_url: profile.sourceUrl,
    })
    .select("id")
    .single();

  if (documentError || !insertedDocument) {
    throw new Error(`Failed to insert photo document for ${seed.country}: ${documentError?.message}`);
  }

  const documentId = (insertedDocument as { id: string }).id;
  const chunks = [
    {
      label: `${seed.country}_photo_requirements_static`,
      content: buildStaticChunk(seed, profile),
    },
    {
      label: `${seed.country}_photo_requirements_crawled_sources`,
      content: buildCrawledChunk(seed, sources),
    },
  ];

  let inserted = 0;
  let embedded = 0;
  for (const chunk of chunks) {
    const embedding = await getEmbedding(`${profile.title}\n\n${chunk.content}`);
    const row: Record<string, unknown> = {
      document_id: documentId,
      country: seed.country,
      visa_type: visaType,
      document_type: "photo_requirements",
      content: chunk.content,
    };

    if (embedding) {
      row.embedding = embedding;
      embedded += 1;
    }

    const { error } = await supabase.from("visa_chunks").insert(row);
    if (error) throw new Error(`Failed to insert ${chunk.label}: ${error.message}`);
    inserted += 1;
    process.stdout.write(`    - ${chunk.label} (${chunk.content.length} chars${embedding ? ", embedded" : ""})\n`);
  }

  return { inserted, embedded };
}

async function collectSources(seed: CountryRagSeed, profile: PhotoProfile, skipFetch: boolean): Promise<CrawledSource[]> {
  const urls = new Set<string>([
    profile.sourceUrl,
    ...seed.documents.map((document) => document.sourceUrl).filter(Boolean),
  ]);

  if (skipFetch) {
    return Array.from(urls).map((url) => ({
      url,
      title: url,
      excerpts: [],
      error: "fetch_skipped",
    }));
  }

  const sources = await Promise.all(Array.from(urls).map(fetchSource));
  return sources.filter((source) => source.url);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const seeds = resolveSeeds(options);

  if (!options.dryRun && (!SUPABASE_URL || !SUPABASE_KEY)) {
    throw new Error("Missing Supabase credentials");
  }

  const supabase = !options.dryRun && SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  console.log("Starting photo requirements RAG ingestion");
  console.log(`Seed directory: ${SEED_DIR}`);
  console.log(`Countries: ${seeds.length}`);
  console.log(`Mode: ${options.dryRun ? "dry-run" : "insert"}`);
  console.log(
    `Embeddings: ${
      OPENAI_KEY && OPENAI_KEY !== "your_openai_api_key_here"
        ? `enabled (${EMBEDDING_MODEL})`
        : "disabled (chunks will still be inserted for filtered fallback)"
    }`
  );

  let totalInserted = 0;
  let totalEmbedded = 0;

  for (const seed of seeds) {
    const profile = profileForCountry(seed);
    const sources = await collectSources(seed, profile, options.skipFetch);
    const sourceCount = sources.length;
    const excerptCount = sources.reduce((sum, source) => sum + source.excerpts.length, 0);

    console.log(`\nCountry: ${seed.country}`);
    console.log(`  Profile: ${profile.id}`);
    console.log(`  Visa type: ${seedVisaType(seed)}`);
    console.log(`  Sources crawled: ${sourceCount}; photo excerpts: ${excerptCount}`);

    if (options.dryRun || !supabase) {
      console.log(`  Dry run chunk sizes: ${buildStaticChunk(seed, profile).length}, ${buildCrawledChunk(seed, sources).length}`);
      continue;
    }

    const result = await insertPhotoDocument(supabase, seed, profile, sources);
    totalInserted += result.inserted;
    totalEmbedded += result.embedded;
  }

  console.log("\nPhoto requirements RAG ingestion complete");
  console.log(`Inserted chunks: ${totalInserted}`);
  console.log(`Embedded chunks: ${totalEmbedded}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
