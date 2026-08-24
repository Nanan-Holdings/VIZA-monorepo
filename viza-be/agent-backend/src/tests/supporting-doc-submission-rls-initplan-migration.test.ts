import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0182_supporting_doc_submission_rls_initplan.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
	new URL(
		"../../../../viza-fe/internal-website/supabase/migrations/20260824055000_supporting_doc_submission_rls_initplan.sql",
		import.meta.url,
	),
);
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";
const preHash = "0c1f144a5f4ed2d63e7cbe75cbdee0a425444763f84353d8dde8fb9a7a3ad6d4";
const postHash = "8c0df2ed0556d31617abbdee9ca003d8346949fafa4e18a3a49f94fa98f4e7f5";

describe("supporting-document submission RLS init-plan migration", () => {
	it("ships a byte-identical canonical migration and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(existsSync(mirrorPath)).toBe(true);
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("alters only the production-confirmed SELECT policy", () => {
		expect(canonicalSql.match(/ALTER POLICY\s+"supporting_doc_submission_select_own"/gi)).toHaveLength(1);
		expect(canonicalSql.match(/ALTER POLICY/gi)).toHaveLength(1);
		expect(canonicalSql).toMatch(/FROM\s+public\.applications\s+a/gi);
		expect(canonicalSql).toMatch(/JOIN\s+public\.applicant_profiles\s+p/gi);
		expect(canonicalSql).toMatch(/p\.auth_user_id\s*=\s*\(select auth\.uid\(\)\)/gi);
		expect(canonicalSql).not.toMatch(/p\.auth_user_id\s*=\s*auth\.uid\(\)/i);
		expect(canonicalSql).not.toMatch(/\b(?:CREATE|DROP)\s+POLICY\b/i);
	});

	it("pins policy identity, hashes, RLS state, count, and relation ACL", () => {
		expect(canonicalSql).toMatch(new RegExp(preHash, "i"));
		expect(canonicalSql).toMatch(new RegExp(postHash, "i"));
		expect(canonicalSql).toMatch(/policy\.oid\s*=\s*v_policy_oid/i);
		expect(canonicalSql).toMatch(/relation\.oid\s*=\s*v_relation_oid/i);
		expect(canonicalSql).toMatch(/relation\.relacl\s+IS NOT DISTINCT FROM v_relation_acl/i);
		expect(canonicalSql).toMatch(/relation\.relrowsecurity\s+IS NOT DISTINCT FROM v_rls_enabled/i);
		expect(canonicalSql).toMatch(/relation\.relforcerowsecurity\s+IS NOT DISTINCT FROM v_rls_forced/i);
		expect(canonicalSql).toMatch(/policy count drifted/i);
	});

	it("changes no rows, ACLs, tables, functions, roles, or CHECK expression", () => {
		expect(canonicalSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
		expect(canonicalSql).not.toMatch(/\b(?:GRANT|REVOKE|ALTER TABLE|CREATE FUNCTION)\b/i);
		expect(canonicalSql).not.toMatch(/ALTER POLICY[\s\S]{0,120}\bTO\b/i);
		expect(canonicalSql).toMatch(/policy\.polwithcheck\s+IS NULL/i);
	});
});
