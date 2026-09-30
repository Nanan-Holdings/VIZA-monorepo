import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
  new URL("../../drizzle/0207_preserve_ds160_proof_stale_results.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
  new URL(
    "../../../../viza-fe/internal-website/supabase/migrations/20260930102445_preserve_ds160_proof_stale_results.sql",
    import.meta.url,
  ),
);
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";

// Behavioral SQL assertions live in stale-queue-maintenance.fixture.sql.
describe("stale submission queue maintenance migration", () => {
  it("ships one byte-identical canonical and Supabase CLI mirror", () => {
    expect(existsSync(canonicalPath)).toBe(true);
    expect(existsSync(mirrorPath)).toBe(true);
    expect(mirrorSql).toBe(canonicalSql);
  });

});
