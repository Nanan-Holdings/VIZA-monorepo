import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { Client as PgClient } from "pg";
import { runVerification } from "./verify-supabase-schema";

const { Client } = pg;

const EXPECTED_PROJECT_REF = "oyjxdzsoejraedqghndi";
const INTERNAL_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const REPO_ROOT = path.resolve(INTERNAL_ROOT, "..", "..");

type MigrationPlanItem = {
  fileName: string;
  purpose: string;
};

type DbInfo = {
  host: string;
  isLocal: boolean;
  detectedProjectRef: string | null;
};

const PLAN: MigrationPlanItem[] = [
  {
    fileName: "20260610_applicant_profile_bilingual_fields.sql",
    purpose: "Universal Profile bilingual fields",
  },
  {
    fileName: "20260610_ds160_live_assisted_controls.sql",
    purpose: "DS-160 live-assisted columns, jobs, review snapshots, review diffs, and manual actions",
  },
  {
    fileName: "20260610_fv_accounts.sql",
    purpose: "France-Visas account table and queue result columns",
  },
  {
    fileName: "20260610_france_live_assisted_controls.sql",
    purpose: "France live-assisted official reference, manual action, review snapshot, and diff controls",
  },
  {
    fileName: "20260610_submission_manual_action_bridge.sql",
    purpose: "Generic submission manual action, review snapshot, and review diff bridge",
  },
  {
    fileName: "20260625_official_fee_payment.sql",
    purpose: "Official fee quote, intent, attempt, receipt, and reconciliation tables",
  },
  {
    fileName: "20260625_vietnam_payment_status_tracking.sql",
    purpose: "Vietnam official-fee queue links and official status check history",
  },
  {
    fileName: "20260625_vn_evisa_official_form_parity.sql",
    purpose: "Vietnam e-Visa official portal form parity fields, conditional tables, and date rules",
  },
  {
    fileName: "20260625_vn_evisa_photo_face_rules.sql",
    purpose: "Vietnam e-Visa official photo size, face-match, and passport validity guardrails",
  },
];

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
  for (const envPath of [
    path.join(INTERNAL_ROOT, ".env.local"),
    path.join(INTERNAL_ROOT, ".env"),
    path.join(REPO_ROOT, ".env"),
    path.join(REPO_ROOT, "viza-be", "agent-backend", ".env"),
    path.join(REPO_ROOT, "viza-be", "submission-service", ".env"),
  ]) {
    loadEnvFile(envPath);
  }
}

function parseDatabaseUrl(databaseUrl: string): DbInfo {
  const parsed = new URL(databaseUrl);
  const host = parsed.hostname;
  const user = decodeURIComponent(parsed.username);
  const isLocal =
    ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host.toLowerCase()) ||
    databaseUrl.includes("127.0.0.1:54321") ||
    databaseUrl.includes("127.0.0.1:54322") ||
    databaseUrl.includes("localhost:54321") ||
    databaseUrl.includes("localhost:54322");
  const detectedProjectRef =
    [host, user].find((part) => part.includes(EXPECTED_PROJECT_REF)) ?? null;

  return { host, isLocal, detectedProjectRef };
}

function migrationPath(item: MigrationPlanItem): string {
  return path.join(INTERNAL_ROOT, "supabase", "migrations", item.fileName);
}

function printPlan(): void {
  console.log("Targeted VIZA migration plan");
  console.log(`Expected project ref: ${EXPECTED_PROJECT_REF}`);
  console.log("Files to apply, in order:");
  PLAN.forEach((item, index) => {
    console.log(`${index + 1}. ${item.fileName}`);
    console.log(`   ${item.purpose}`);
  });
  console.log("");
  console.log("Excluded: legacy medical/lab/prescription/vector migrations.");
  console.log("No secret values are printed.");
}

function readPlanSql(): string[] {
  return PLAN.map((item) => {
    const filePath = migrationPath(item);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing migration file: ${path.relative(INTERNAL_ROOT, filePath)}`);
    }
    return fs.readFileSync(filePath, "utf8");
  });
}

async function applyPlan(client: PgClient): Promise<void> {
  const sqlFiles = readPlanSql();
  await client.query("BEGIN");
  try {
    for (let index = 0; index < PLAN.length; index += 1) {
      console.log(`Applying ${PLAN[index]?.fileName}`);
      await client.query(sqlFiles[index] ?? "");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function main(): Promise<boolean> {
  const shouldApply = process.argv.includes("--apply");
  printPlan();

  if (!shouldApply) {
    console.log("Dry plan only. Re-run with `-- --apply` to apply this plan.");
    console.log(
      "Manual SQL bundle: supabase/manual/viza_required_schema.sql"
    );
    return true;
  }

  loadKnownEnvFiles();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Value was not printed.");
    return false;
  }

  const dbInfo = parseDatabaseUrl(databaseUrl);
  if (dbInfo.isLocal && process.env.ALLOW_LOCAL_SUPABASE !== "true") {
    console.error(
      "DATABASE_URL points to local Supabase. Set ALLOW_LOCAL_SUPABASE=true only for explicit local testing."
    );
    return false;
  }

  if (!dbInfo.detectedProjectRef) {
    console.warn(
      `Remote database host is ${dbInfo.host}, but project ref ${EXPECTED_PROJECT_REF} was not detectable. Confirm the dashboard project before continuing.`
    );
  } else {
    console.log(`Detected expected project ref ${EXPECTED_PROJECT_REF}.`);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: dbInfo.isLocal ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await applyPlan(client);
    console.log("Targeted VIZA migrations applied. Running db:verify...");
  } catch (error) {
    console.error(
      `Targeted VIZA migration failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }

  return runVerification();
}

if (isDirectRun()) {
  main()
    .then((ok) => {
      process.exitCode = ok ? 0 : 1;
    })
    .catch((error) => {
      console.error(
        `Targeted VIZA migration failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
      process.exitCode = 1;
    });
}
