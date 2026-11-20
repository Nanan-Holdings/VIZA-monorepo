import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
  new URL("../../drizzle/0215_uk_account_application_scope.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
  new URL(
    "../../../../viza-fe/internal-website/supabase/migrations/20261120130000_uk_account_application_scope.sql",
    import.meta.url,
  ),
);

describe("UK account application scope migration", () => {
  it("ships a byte-identical frontend Supabase mirror", () => {
    expect(readFileSync(mirrorPath)).toEqual(readFileSync(canonicalPath));
  });

  it("keeps legacy rows unmapped while adding application uniqueness", () => {
    const sql = readFileSync(canonicalPath, "utf8");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS application_id UUID[\s\S]*REFERENCES public\.applications\(id\)/i);
    expect(sql).toMatch(/ADD CONSTRAINT uk_accounts_application_id_key UNIQUE \(application_id\)/i);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uk_accounts_legacy_applicant_email_key[\s\S]*WHERE application_id IS NULL/i);
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS uk_accounts_applicant_id_email_key/i);
    expect(sql).not.toMatch(/UPDATE\s+public?\.uk_accounts[\s\S]*application_id/i);
  });

  it("removes applicant-facing credential policies and keeps service-role-only RLS", () => {
    const sql = readFileSync(canonicalPath, "utf8");
    expect(sql).toMatch(/DROP POLICY IF EXISTS "uk_accounts_select_own"/i);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "uk_accounts_insert_own"/i);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "uk_accounts_update_own"/i);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.uk_accounts FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE ON TABLE public\.uk_accounts TO service_role/i);
  });
});
