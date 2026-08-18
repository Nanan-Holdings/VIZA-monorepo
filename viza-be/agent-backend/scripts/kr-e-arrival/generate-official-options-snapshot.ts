import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const KOREA_E_ARRIVAL_OFFICIAL_BASE = "https://www.e-arrivalcard.go.kr";
export const KOREA_E_ARRIVAL_SNAPSHOT_PATH = fileURLToPath(
  new URL("./official-options.snapshot.json", import.meta.url),
);

export const DYNAMIC_OPTION_ENDPOINTS = {
  nationality: "/portal/apply/srchIbmsNatList.do",
  airports: "/portal/apply/srchAptList.do",
  flightAndShip: "/portal/apply/srchNavInfo.do",
  additionalQuestions: "/portal/apply/srchAddItemList.do",
} as const;

const DYNAMIC_OPTION_IDENTITIES = {
  nationality: "country_code",
  airports: "airport_code",
  flightAndShip: "transport_number",
  additionalQuestions: "question_code",
} as const;

export type DynamicOptionKey = keyof typeof DYNAMIC_OPTION_ENDPOINTS;

export interface CleanOfficialOption {
  value: string;
  code: string;
  text: string;
  label_en: string;
  official_label: string;
}

export interface GeneratorArguments {
  update: boolean;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scalarString(value: unknown): string | null {
  if (typeof value === "string") {
    const cleaned = value.trim();
    return cleaned.length > 0 ? cleaned : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function firstScalar(record: JsonRecord, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = scalarString(record[key]);
    if (value) return value;
  }
  return null;
}

function extractArray(payload: unknown, endpoint: string): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload)) {
    for (const key of ["data", "items", "result", "list", "rows", "content"]) {
      if (Array.isArray(payload[key])) return payload[key];
    }
  }
  throw new Error(`Official Korea option response shape is unsupported: ${endpoint}`);
}

function normalizeOption(raw: unknown, endpoint: string): CleanOfficialOption {
  if (!isRecord(raw)) throw new Error(`Official Korea option item is not an object: ${endpoint}`);

  const value = firstScalar(raw, [
    "value",
    "code",
    "id",
    "natCd",
    "natCode",
    "airportCode",
    "aptCd",
    "transportNumber",
    "questionCode",
    "itemCd",
    "addItemCd",
  ]);
  const label = firstScalar(raw, [
    "label",
    "name",
    "text",
    "title",
    "description",
    "natNm",
    "airportName",
    "aptNm",
    "question",
    "itemNm",
    "addItemNm",
  ]);
  if (!value || !label) throw new Error(`Official Korea option item is missing code/label: ${endpoint}`);
  if (value.length > 160 || label.length > 300) {
    throw new Error(`Official Korea option item exceeds safe length: ${endpoint}`);
  }

  return {
    value,
    code: value,
    text: label,
    label_en: label,
    official_label: label,
  };
}

export function normalizeOfficialOptionPayload(
  payload: unknown,
  key: DynamicOptionKey,
): CleanOfficialOption[] {
  const endpoint = DYNAMIC_OPTION_ENDPOINTS[key];
  const rows = extractArray(payload, endpoint);
  if (rows.length === 0 && key !== "additionalQuestions") {
    throw new Error(`Official Korea option response is unexpectedly empty: ${endpoint}`);
  }
  if (key === "additionalQuestions" && rows.length > 0) {
    throw new Error(
      "Korea e-Arrival Card portal-changed: additional questions are not modeled in V1; manual snapshot review and explicit schema versioning are required",
    );
  }

  const seen = new Map<string, CleanOfficialOption>();
  for (const row of rows) {
    const option = normalizeOption(row, endpoint);
    const previous = seen.get(option.value);
    if (previous && previous.official_label !== option.official_label) {
      throw new Error(`Official Korea option has conflicting labels: ${endpoint}`);
    }
    seen.set(option.value, option);
  }
  return [...seen.values()].sort((left, right) => left.value.localeCompare(right.value));
}

export function parseGeneratorArguments(argv: readonly string[]): GeneratorArguments {
  let update = false;
  for (const argument of argv) {
    if (argument === "--update") {
      update = true;
      continue;
    }
    throw new Error(`Unknown snapshot generator argument: ${argument}`);
  }
  return { update };
}

export function buildUpdatedSnapshot(
  existing: JsonRecord,
  options: Readonly<Record<DynamicOptionKey, readonly CleanOfficialOption[]>>,
  reviewedAt: string,
): JsonRecord {
  const existingDynamic = isRecord(existing.dynamicLists) ? existing.dynamicLists : {};
  const dynamicLists: JsonRecord = { ...existingDynamic };
  const sourceEndpoints = isRecord(existing.sourceEndpoints) ? existing.sourceEndpoints : {};

  for (const key of Object.keys(DYNAMIC_OPTION_ENDPOINTS) as DynamicOptionKey[]) {
    if (key === "additionalQuestions" && options[key].length > 0) {
      throw new Error(
        "Korea e-Arrival Card portal-changed: additional questions cannot be written before explicit schema modeling",
      );
    }
    const rows = options[key].map((option) => ({ ...option }));
    const existingEntry = isRecord(existingDynamic[key]) ? existingDynamic[key] : {};
    dynamicLists[key] = {
      ...existingEntry,
      status: rows.length === 0 ? "reviewed_empty_clean_snapshot" : "reviewed_clean_snapshot",
      identity: DYNAMIC_OPTION_IDENTITIES[key],
      endpoint: DYNAMIC_OPTION_ENDPOINTS[key],
      options: rows,
      ...(key === "additionalQuestions"
        ? { fail_closed_on_non_empty_or_shape_change: true }
        : {}),
    };
    sourceEndpoints[key] = DYNAMIC_OPTION_ENDPOINTS[key];
  }

  return {
    ...existing,
    snapshotVersion: reviewedAt,
    reviewedAt,
    sourceEndpoints,
    dynamicLists,
    additionalQuestions: {
      status: options.additionalQuestions.length === 0
        ? "reviewed_empty_clean_snapshot"
        : "reviewed_clean_snapshot",
      identity: DYNAMIC_OPTION_IDENTITIES.additionalQuestions,
      endpoint: DYNAMIC_OPTION_ENDPOINTS.additionalQuestions,
      items: options.additionalQuestions.map((option) => ({ ...option })),
      fail_closed_on_non_empty_or_shape_change: true,
    },
  };
}

async function fetchOfficialPayload(
  key: DynamicOptionKey,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const endpoint = DYNAMIC_OPTION_ENDPOINTS[key];
  const cookie = process.env.KR_E_ARRIVAL_COOKIE?.trim();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (cookie) headers.Cookie = cookie;

  const response = await fetchImpl(`${KOREA_E_ARRIVAL_OFFICIAL_BASE}${endpoint}`, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Official Korea option request failed with HTTP ${response.status}: ${endpoint}`);
  }
  const body = await response.text();
  if (body.length > 8_000_000) throw new Error(`Official Korea option response is too large: ${endpoint}`);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(`Official Korea option response is not JSON; session/auth may be required: ${endpoint}`);
  }
}

async function readExistingSnapshot(): Promise<JsonRecord> {
  const raw = await readFile(KOREA_E_ARRIVAL_SNAPSHOT_PATH, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || !isRecord(parsed.staticLists)) {
    throw new Error("Existing Korea option snapshot is not a valid object with staticLists");
  }
  return parsed;
}

async function writeSnapshotAtomically(snapshot: JsonRecord): Promise<void> {
  const temporaryPath = `${KOREA_E_ARRIVAL_SNAPSHOT_PATH}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await rename(temporaryPath, KOREA_E_ARRIVAL_SNAPSHOT_PATH);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function generateSnapshot(
  update: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<JsonRecord> {
  const existing = await readExistingSnapshot();
  const options = {} as Record<DynamicOptionKey, readonly CleanOfficialOption[]>;
  for (const key of Object.keys(DYNAMIC_OPTION_ENDPOINTS) as DynamicOptionKey[]) {
    options[key] = normalizeOfficialOptionPayload(await fetchOfficialPayload(key, fetchImpl), key);
  }
  const snapshot = buildUpdatedSnapshot(existing, options, new Date().toISOString().slice(0, 10));
  if (update) await writeSnapshotAtomically(snapshot);
  return snapshot;
}

async function main(): Promise<void> {
  const { update } = parseGeneratorArguments(process.argv.slice(2));
  const snapshot = await generateSnapshot(update);
  console.log(update
    ? `Updated Korea e-Arrival Card official option snapshot at ${KOREA_E_ARRIVAL_SNAPSHOT_PATH}.`
    : `Validated Korea e-Arrival Card official option responses; snapshot not written (${Object.keys(snapshot.dynamicLists as JsonRecord).length} dynamic lists).`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown snapshot generation failure";
    console.error(`Korea e-Arrival Card snapshot generation stopped safely: ${message}`);
    process.exitCode = 1;
  });
}
