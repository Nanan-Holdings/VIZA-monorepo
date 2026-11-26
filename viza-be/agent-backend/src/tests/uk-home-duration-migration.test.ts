import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const drizzlePath = fileURLToPath(
  new URL("../../drizzle/0225_uk_home_duration_months_required.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
  new URL(
    "../../../../viza-fe/internal-website/supabase/migrations/20261126090000_uk_home_duration_months_required.sql",
    import.meta.url,
  ),
);

describe("UK home duration month migration", () => {
  it("keeps the frontend mirror byte-identical", () => {
    expect(readFileSync(mirrorPath)).toEqual(readFileSync(drizzlePath));
  });

  it("requires the 0-11 month component observed by UKVI", () => {
    const sql = readFileSync(drizzlePath, "utf8");
    expect(sql).toContain("field_name = 'months_at_address'");
    expect(sql).toContain("required = TRUE");
    expect(sql).toContain("Enter months between 0 and 11");
    expect(sql).toContain("1[01]");
  });
});
