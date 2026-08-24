import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0181_applicant_single_path_rls_initplan.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
	new URL(
		"../../../../viza-fe/internal-website/supabase/migrations/20260824051000_applicant_single_path_rls_initplan.sql",
		import.meta.url,
	),
);
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";
const preHash = "25b1a1fe79d4578daaa9ce3a895db3195c732290aa4290acac2e212ea1967fad";
const postHash = "f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86";

const policyNames = [
	"applicant_secret_select_own",
	"notification_preferences_select_own",
	"notification_preferences_upsert_own",
	"staff_chat_thread_select_own",
];

describe("applicant single-path RLS init-plan migration", () => {
	it("ships a byte-identical canonical migration and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(existsSync(mirrorPath)).toBe(true);
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("alters only the four production-confirmed policies", () => {
		for (const policyName of policyNames) {
			expect(canonicalSql.match(new RegExp(`ALTER POLICY\\s+"${policyName}"`, "gi"))).toHaveLength(1);
		}
		expect(canonicalSql.match(/ALTER POLICY/gi)).toHaveLength(4);
		expect(canonicalSql.match(/auth_user_id\s*=\s*\(select auth\.uid\(\)\)/gi)).toHaveLength(5);
		expect(canonicalSql).not.toMatch(/auth_user_id\s*=\s*auth\.uid\(\)/i);
		expect(canonicalSql).not.toMatch(/\b(?:CREATE|DROP)\s+POLICY\b/i);
	});

	it("pins policy identity, expression hashes, RLS state, and relation ACLs", () => {
		expect(canonicalSql).toMatch(new RegExp(preHash, "i"));
		expect(canonicalSql).toMatch(new RegExp(postHash, "i"));
		expect(canonicalSql).toMatch(/policy\.oid\s*=\s*v_policy_oid/i);
		expect(canonicalSql).toMatch(/relation\.relacl\s+IS NOT DISTINCT FROM v_relation_acl/i);
		expect(canonicalSql).toMatch(/relation\.relrowsecurity\s+IS NOT DISTINCT FROM v_rls_enabled/i);
		expect(canonicalSql).toMatch(/relation\.relforcerowsecurity\s+IS NOT DISTINCT FROM v_rls_forced/i);
		expect(canonicalSql).toMatch(/policy count drifted/i);
	});

	it("changes no rows, ACLs, tables, functions, or policy roles", () => {
		expect(canonicalSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
		expect(canonicalSql).not.toMatch(/\b(?:GRANT|REVOKE|ALTER TABLE|CREATE FUNCTION)\b/i);
		expect(canonicalSql).not.toMatch(/ALTER POLICY[\s\S]{0,120}\bTO\b/i);
	});
});
