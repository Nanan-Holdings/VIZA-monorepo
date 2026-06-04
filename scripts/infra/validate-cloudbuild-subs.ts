import * as fs from "node:fs";
import * as path from "node:path";

/**
 * CI-006: fail the build if any cloudbuild substitution is still the
 * REPLACE_VIA_TRIGGER placeholder (i.e. a real value was never injected by
 * the Cloud Build trigger). Read-only filesystem scan; no secrets touched.
 *
 *   npx tsx scripts/infra/validate-cloudbuild-subs.ts
 */
const REPO_ROOT = path.resolve(__dirname, "../..");
const CLOUDBUILD = path.join(REPO_ROOT, "viza-fe/internal-website/cloudbuild.yaml");
const PLACEHOLDER = "REPLACE_VIA_TRIGGER";

function main(): void {
  if (!fs.existsSync(CLOUDBUILD)) {
    console.error(`[validate-cloudbuild-subs] not found: ${CLOUDBUILD}`);
    process.exit(1);
  }
  const text = fs.readFileSync(CLOUDBUILD, "utf8");
  const offenders: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.includes(PLACEHOLDER)) {
      // Capture the substitution key on the line, e.g. `_FOO: REPLACE_VIA_TRIGGER`.
      const m = /(_[A-Z0-9_]+)\s*:/.exec(line);
      offenders.push(`${m ? m[1] : "?"} (line ${i + 1})`);
    }
  });
  if (offenders.length > 0) {
    console.error(
      `[validate-cloudbuild-subs] ${offenders.length} substitution(s) still ${PLACEHOLDER}:`,
    );
    for (const o of offenders) console.error(`  - ${o}`);
    process.exit(1);
  }
  console.log("[validate-cloudbuild-subs] OK — no placeholder substitutions remain.");
}

main();
