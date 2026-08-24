import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0180_consent_event_rls_initplan.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
	new URL(
		"../../../../viza-fe/internal-website/supabase/migrations/20260824032000_consent_event_rls_initplan.sql",
		import.meta.url,
	),
);
const drizzleHistoryPath = fileURLToPath(
	new URL("../../drizzle/0048_consent_event.sql", import.meta.url),
);
const websiteHistoryPath = fileURLToPath(
	new URL(
		"../../../../viza-fe/internal-website/supabase/migrations/20260531_create_consent_event.sql",
		import.meta.url,
	),
);
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";
const drizzleHistorySql = readFileSync(drizzleHistoryPath, "utf8");
const websiteHistorySql = readFileSync(websiteHistoryPath, "utf8");
const preHash = "91d4d5f1bd65562b9581892c345fa0b60d0dc1aa398f0b271e86338385060ac8";
const postHash = "71f1513bd40970f7d84c85ec82450b575df8915148b67210085a056186962975";

describe("consent-event RLS init-plan migration", () => {
	it("ships a byte-identical canonical and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(existsSync(mirrorPath)).toBe(true);
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("documents the historical ownership split without rewriting history", () => {
		expect(drizzleHistorySql).toMatch(/applicant_id\s+IN[\s\S]+applicant_profiles[\s\S]+auth_user_id\s*=\s*auth\.uid\(\)/i);
		expect(websiteHistorySql).not.toMatch(/applicant_id\s+IN/i);
		expect(canonicalSql).toMatch(/production catalog[\s\S]+91d4d5f1bd65562b9581892c345fa0b60d0dc1aa398f0b271e86338385060ac8/i);
	});

	it("alters only the production-confirmed two-path SELECT policy", () => {
		expect(canonicalSql.match(/ALTER POLICY\s+"consent_event_select_own"/gi)).toHaveLength(1);
		expect(canonicalSql.match(/ALTER POLICY/gi)).toHaveLength(1);
		expect(canonicalSql.match(/\buser_id\s*=\s*\(select auth\.uid\(\)\)/gi)).toHaveLength(1);
		expect(canonicalSql.match(/applicant_id\s+IN\s*\(\s*SELECT\s+id\s+FROM\s+public\.applicant_profiles\s+WHERE\s+auth_user_id\s*=\s*\(select auth\.uid\(\)\)\s*\)/gi)).toHaveLength(1);
		expect(canonicalSql.match(/auth\.uid\(\)/gi)).toHaveLength(2);
		expect(canonicalSql).not.toMatch(/\b(?:CREATE|DROP)\s+POLICY\b/i);
	});

	it("changes no data, ACL, table, function, or policy identity", () => {
		expect(canonicalSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
		expect(canonicalSql).not.toMatch(/\b(?:GRANT|REVOKE|ALTER TABLE|CREATE FUNCTION)\b/i);
		expect(canonicalSql).toMatch(/v_policy_oid\s+oid/i);
		expect(canonicalSql).toMatch(/v_policy_using_sha256\s+text/i);
		expect(canonicalSql).toMatch(/policy drifted before optimization/i);
		expect(canonicalSql).toMatch(new RegExp(preHash, "i"));
		expect(canonicalSql).toMatch(new RegExp(postHash, "i"));
		expect(canonicalSql).toMatch(/policy\.oid\s*=\s*v_policy_oid/i);
		expect(canonicalSql).toMatch(/relation\.relacl[\s\S]+IS DISTINCT FROM v_relation_acl/i);
		expect(canonicalSql).toMatch(/RAISE EXCEPTION 'consent_event_select_own policy identity or contract changed/i);
		expect(canonicalSql).toMatch(/RAISE EXCEPTION 'consent_event ACL changed/i);
	});
});
