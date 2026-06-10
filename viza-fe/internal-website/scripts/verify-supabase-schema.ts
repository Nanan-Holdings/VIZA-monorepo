import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { Client as PgClient } from "pg";

const { Client } = pg;

const EXPECTED_PROJECT_REF = "oyjxdzsoejraedqghndi";
const INTERNAL_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const REPO_ROOT = path.resolve(INTERNAL_ROOT, "..", "..");

const REQUIRED_PROFILE_COLUMNS = [
  "surname",
  "surname_zh",
  "surname_en",
  "given_names",
  "given_names_zh",
  "given_names_en",
  "birth_country",
  "birth_province_or_state",
  "birth_city",
  "occupation_zh",
  "occupation_en",
  "address_zh",
  "address_en",
  "full_name_zh",
  "full_name_en",
  "place_of_birth_zh",
  "place_of_birth_en",
];

const REQUIRED_SUBMISSION_QUEUE_COLUMNS = [
  "mode",
  "provider",
  "manual_action_status",
  "review_diff_status",
  "official_application_reference_encrypted",
];

const REQUIRED_DS160_TABLES = [
  "ds160_submission_jobs",
  "ds160_official_review_snapshots",
  "ds160_review_diffs",
  "ds160_live_manual_actions",
];

const REQUIRED_FRANCE_TABLES = [
  "fv_accounts",
  "france_live_manual_actions",
  "france_official_review_snapshots",
  "france_review_diffs",
];

type CheckStatus = "pass" | "fail" | "warn";

type CheckResult = {
  name: string;
  status: CheckStatus;
  detail: string;
  missing?: string[];
  suggestedMigration?: string;
};

type DbInfo = {
  host: string;
  port: string;
  user: string;
  database: string;
  isLocal: boolean;
  detectedProjectRef: string | null;
};

function isDirectRun(): boolean {
  const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return scriptPath === fileURLToPath(import.meta.url);
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

function loadKnownEnvFiles(): void {
  const paths = [
    path.join(INTERNAL_ROOT, ".env.local"),
    path.join(INTERNAL_ROOT, ".env"),
    path.join(REPO_ROOT, ".env"),
    path.join(REPO_ROOT, "viza-be", "agent-backend", ".env"),
    path.join(REPO_ROOT, "viza-be", "submission-service", ".env"),
  ];

  for (const envPath of paths) {
    loadEnvFile(envPath);
  }
}

function parseDatabaseUrl(databaseUrl: string): DbInfo {
  const parsed = new URL(databaseUrl);
  const host = parsed.hostname;
  const port = parsed.port || "5432";
  const user = decodeURIComponent(parsed.username);
  const database = parsed.pathname.replace(/^\//, "") || "postgres";
  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  const isLocal =
    localHosts.has(host.toLowerCase()) ||
    databaseUrl.includes("127.0.0.1:54321") ||
    databaseUrl.includes("127.0.0.1:54322") ||
    databaseUrl.includes("localhost:54321") ||
    databaseUrl.includes("localhost:54322");
  const detectedProjectRef =
    [host, user].find((part) => part.includes(EXPECTED_PROJECT_REF)) ?? null;

  return { host, port, user, database, isLocal, detectedProjectRef };
}

function pass(name: string, detail: string): CheckResult {
  return { name, detail, status: "pass" };
}

function fail(
  name: string,
  detail: string,
  options: Pick<CheckResult, "missing" | "suggestedMigration"> = {}
): CheckResult {
  return { name, detail, status: "fail", ...options };
}

function warn(name: string, detail: string): CheckResult {
  return { name, detail, status: "warn" };
}

function printCheck(check: CheckResult): void {
  const icon =
    check.status === "pass" ? "✅" : check.status === "fail" ? "❌" : "⚠️";
  console.log(`${icon} ${check.name}: ${check.detail}`);
  if (check.missing?.length) {
    console.log(`   Missing: ${check.missing.join(", ")}`);
  }
  if (check.suggestedMigration) {
    console.log(`   Suggested migration: ${check.suggestedMigration}`);
  }
}

async function tableExists(
  client: PgClient,
  schemaName: string,
  tableName: string
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = $2
      ) AS exists
    `,
    [schemaName, tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function schemaExists(client: PgClient, schemaName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.schemata
        WHERE schema_name = $1
      ) AS exists
    `,
    [schemaName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function tableColumns(
  client: PgClient,
  schemaName: string,
  tableName: string
): Promise<Set<string>> {
  const result = await client.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
    `,
    [schemaName, tableName]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

async function findProfileTable(client: PgClient): Promise<string | null> {
  for (const tableName of ["applicant_profiles", "applicant_profile", "profiles"]) {
    if (await tableExists(client, "public", tableName)) {
      return tableName;
    }
  }
  return null;
}

async function verifyProfileSchema(client: PgClient): Promise<CheckResult> {
  const tableName = await findProfileTable(client);
  if (!tableName) {
    return fail("Universal Profile table", "No profile table was found.", {
      missing: ["applicant_profiles"],
      suggestedMigration:
        "supabase/migrations/20260610_applicant_profile_bilingual_fields.sql",
    });
  }

  const columns = await tableColumns(client, "public", tableName);
  const missing = REQUIRED_PROFILE_COLUMNS.filter((column) => !columns.has(column));
  if (missing.length > 0) {
    return fail(
      `Universal Profile columns (${tableName})`,
      "Required bilingual profile columns are missing.",
      {
        missing,
        suggestedMigration:
          "supabase/migrations/20260610_applicant_profile_bilingual_fields.sql",
      }
    );
  }

  return pass(
    `Universal Profile columns (${tableName})`,
    "All required bilingual columns exist."
  );
}

async function verifySubmissionQueue(client: PgClient): Promise<CheckResult> {
  if (!(await tableExists(client, "public", "submission_queue"))) {
    return fail("submission_queue table", "submission_queue does not exist.", {
      missing: ["submission_queue"],
      suggestedMigration:
        "supabase/migrations/20260610_ds160_live_assisted_controls.sql",
    });
  }

  const columns = await tableColumns(client, "public", "submission_queue");
  const missing = REQUIRED_SUBMISSION_QUEUE_COLUMNS.filter(
    (column) => !columns.has(column)
  );
  if (missing.length > 0) {
    return fail(
      "submission_queue live-assisted columns",
      "Required live-assisted columns are missing.",
      {
        missing,
        suggestedMigration:
          "supabase/migrations/20260610_ds160_live_assisted_controls.sql and 20260610_france_live_assisted_controls.sql",
      }
    );
  }

  return pass(
    "submission_queue live-assisted columns",
    "mode, provider, manual action, review diff, and official reference columns exist."
  );
}

async function verifyTables(
  client: PgClient,
  label: string,
  tableNames: string[],
  suggestedMigration: string
): Promise<CheckResult> {
  const missing: string[] = [];
  for (const tableName of tableNames) {
    if (!(await tableExists(client, "public", tableName))) {
      missing.push(tableName);
    }
  }

  if (missing.length > 0) {
    return fail(label, "Required tables are missing.", {
      missing,
      suggestedMigration,
    });
  }

  return pass(label, "All required tables exist.");
}

async function verifyStorage(client: PgClient): Promise<CheckResult> {
  if (!(await schemaExists(client, "storage"))) {
    return warn(
      "Storage bucket application-documents",
      "storage schema is not queryable from this connection."
    );
  }

  if (!(await tableExists(client, "storage", "buckets"))) {
    return warn(
      "Storage bucket application-documents",
      "storage.buckets is not queryable from this connection."
    );
  }

  const result = await client.query<{ id: string }>(
    "SELECT id FROM storage.buckets WHERE id = $1",
    ["application-documents"]
  );

  if (result.rows.length === 0) {
    return fail(
      "Storage bucket application-documents",
      "Required private upload bucket is missing.",
      {
        missing: ["storage.buckets.application-documents"],
        suggestedMigration:
          "supabase/migrations/20260531_create_application_documents_bucket.sql",
      }
    );
  }

  return pass(
    "Storage bucket application-documents",
    "Required private upload bucket exists."
  );
}

async function verifyConnection(client: PgClient): Promise<CheckResult[]> {
  const result = await client.query<{
    current_database: string;
    current_user: string;
    version: string;
  }>(
    "SELECT current_database() AS current_database, current_user AS current_user, version() AS version"
  );
  const row = result.rows[0];
  if (!row) {
    return [fail("Connection", "Connected, but database metadata query returned no rows.")];
  }

  return [
    pass("Connection", "Connected to remote Postgres."),
    pass("current_database", row.current_database),
    pass("current_user", row.current_user),
    pass("server_version", row.version.split(",")[0] ?? row.version),
  ];
}

function verifyProjectSanity(dbInfo: DbInfo): CheckResult {
  if (dbInfo.isLocal && process.env.ALLOW_LOCAL_SUPABASE !== "true") {
    return fail(
      "Supabase project sanity",
      "DATABASE_URL points to local Supabase. Set ALLOW_LOCAL_SUPABASE=true only for explicit local testing."
    );
  }

  if (!dbInfo.detectedProjectRef) {
    return warn(
      "Supabase project sanity",
      `Remote URL detected, but project ref ${EXPECTED_PROJECT_REF} was not visible in host/user. Confirm the dashboard project before applying migrations.`
    );
  }

  return pass(
    "Supabase project sanity",
    `Detected expected project ref ${EXPECTED_PROJECT_REF} in the database URL metadata.`
  );
}

export async function runVerification(): Promise<boolean> {
  loadKnownEnvFiles();

  const databaseUrl = process.env.DATABASE_URL;
  const checks: CheckResult[] = [];

  if (!databaseUrl) {
    const missing = fail("DATABASE_URL", "DATABASE_URL is not set.", {
      missing: ["DATABASE_URL"],
    });
    printCheck(missing);
    return false;
  }

  let dbInfo: DbInfo;
  try {
    dbInfo = parseDatabaseUrl(databaseUrl);
  } catch {
    const invalid = fail(
      "DATABASE_URL",
      "DATABASE_URL is set but could not be parsed. Value was not printed."
    );
    printCheck(invalid);
    return false;
  }

  const sanity = verifyProjectSanity(dbInfo);
  printCheck(sanity);
  if (sanity.status === "fail") {
    return false;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: dbInfo.isLocal ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    checks.push(...(await verifyConnection(client)));
    checks.push(await verifyProfileSchema(client));
    checks.push(await verifySubmissionQueue(client));
    checks.push(
      await verifyTables(
        client,
        "France live-assisted schema",
        REQUIRED_FRANCE_TABLES,
        "supabase/migrations/20260610_fv_accounts.sql and 20260610_france_live_assisted_controls.sql"
      )
    );
    checks.push(
      await verifyTables(
        client,
        "DS-160 live-assisted schema",
        REQUIRED_DS160_TABLES,
        "supabase/migrations/20260610_ds160_live_assisted_controls.sql"
      )
    );
    checks.push(await verifyStorage(client));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const hint =
      message.includes("ENOTFOUND") ||
      message.includes("ETIMEDOUT") ||
      message.includes("timeout")
        ? " Check that DATABASE_URL uses a reachable remote Supabase Session pooler or direct database host."
        : "";
    checks.push(
      fail(
        "Connection/query execution",
        `Database verification failed: ${message}.${hint}`
      )
    );
  } finally {
    await client.end().catch(() => undefined);
  }

  for (const check of checks) {
    printCheck(check);
  }

  const failures = checks.filter((check) => check.status === "fail");
  if (failures.length > 0) {
    console.log("");
    console.log("Missing required schema was found. Do not claim DB completion.");
    return false;
  }

  console.log("");
  console.log("Required VIZA Supabase schema checks passed.");
  return true;
}

if (isDirectRun()) {
  runVerification()
    .then((ok) => {
      process.exitCode = ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(
        `Supabase schema verification failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
      process.exitCode = 1;
    });
}
