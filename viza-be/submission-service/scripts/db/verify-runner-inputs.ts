import "dotenv/config";
import { verifyTable } from "./verify-queue-schema";

/**
 * MIG-004: verify the application/answer/vault/payment columns the runners
 * read as inputs actually exist. Read-only column probes (see
 * verify-queue-schema.ts). Exits non-zero listing missing columns.
 *
 *   npx ts-node scripts/db/verify-runner-inputs.ts
 *
 * Column list derived from:
 *   - src/applicant-vault.ts → applicant_secret(applicant_id, key, ciphertext),
 *     secret_access_log(applicant_id, key, action, actor)
 *   - src/queue/answers.ts → visa_application_answers(application_id, field_name,
 *     value_text), applicant_profiles, applications
 *   - payment status read by the post-paid enqueue path → order(application_id, status)
 *   - src/payment-routing.ts is in-memory (country/visa_type), no DB columns.
 */

const SPECS = [
  {
    table: "applicant_secret",
    columns: ["applicant_id", "key", "ciphertext"],
  },
  {
    table: "secret_access_log",
    columns: ["applicant_id", "key", "action", "actor"],
  },
  {
    table: "visa_application_answers",
    columns: ["application_id", "field_name", "value_text"],
  },
  {
    table: "applicant_profiles",
    columns: ["id", "full_name", "date_of_birth", "passport_number", "email"],
  },
  {
    table: "applications",
    columns: ["id", "applicant_id", "country"],
  },
  {
    table: "order",
    columns: ["application_id", "status"],
  },
];

async function main(): Promise<void> {
  const allMissing: string[] = [];
  for (const spec of SPECS) {
    const missing = await verifyTable(spec);
    if (missing.length === 0) {
      console.log(`✓ ${spec.table}: all ${spec.columns.length} columns present`);
    } else {
      allMissing.push(...missing);
    }
  }
  if (allMissing.length > 0) {
    console.error(`\n✗ Missing runner-input columns (${allMissing.length}):`);
    for (const m of allMissing) console.error(`  - ${m}`);
    process.exit(1);
  }
  console.log("\n✓ Runner-input schema verification passed.");
}

main().catch((err) => {
  console.error("[verify-runner-inputs] error:", err);
  process.exit(1);
});
