import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0178_account_action_log_rls_initplan.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
	new URL(
		"../../../../viza-fe/internal-website/supabase/migrations/20260824023800_account_action_log_rls_initplan.sql",
		import.meta.url,
	),
);
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";

describe("account-action-log RLS init-plan migration", () => {
	it("ships a byte-identical canonical and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(existsSync(mirrorPath)).toBe(true);
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("alters only the reviewed two-path SELECT policy", () => {
		expect(canonicalSql.match(/ALTER POLICY\s+"account_action_log_select_own"/gi)).toHaveLength(1);
		expect(canonicalSql.match(/ALTER POLICY/gi)).toHaveLength(1);
		expect(canonicalSql.match(/\buser_id\s*=\s*\(select auth\.uid\(\)\)/gi)).toHaveLength(1);
		expect(canonicalSql.match(/applicant_id\s+IN\s*\(\s*SELECT\s+id\s+FROM\s+public\.applicant_profiles\s+WHERE\s+auth_user_id\s*=\s*\(select auth\.uid\(\)\)\s*\)/gi)).toHaveLength(1);
		expect(canonicalSql.match(/auth\.uid\(\)/gi)).toHaveLength(2);
		expect(canonicalSql).not.toMatch(/\b(?:CREATE|DROP)\s+POLICY\b/i);
	});

	it("changes no data, ACL, table, or function contract", () => {
		expect(canonicalSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
		expect(canonicalSql).not.toMatch(/\b(?:GRANT|REVOKE|ALTER TABLE|CREATE FUNCTION)\b/i);
		expect(canonicalSql).toMatch(/v_policy_oid\s+oid/i);
		expect(canonicalSql).toMatch(/policy\.oid\s*=\s*v_policy_oid/i);
		expect(canonicalSql).toMatch(/relation\.relacl[\s\S]+IS DISTINCT FROM v_relation_acl/i);
		expect(canonicalSql).toMatch(/RAISE EXCEPTION 'account_action_log_select_own policy identity changed/i);
		expect(canonicalSql).toMatch(/RAISE EXCEPTION 'account_action_log ACL changed/i);
	});
});
