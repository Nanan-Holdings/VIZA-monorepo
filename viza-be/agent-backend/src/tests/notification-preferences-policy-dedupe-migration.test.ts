import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0183_notification_preferences_policy_dedupe.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
	new URL(
		"../../../../viza-fe/internal-website/supabase/migrations/20260824061117_notification_preferences_policy_dedupe.sql",
		import.meta.url,
	),
);
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";
const policyHash = "f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86";

describe("notification preferences policy deduplication migration", () => {
	it("ships a byte-identical canonical migration and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(existsSync(mirrorPath)).toBe(true);
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("drops only the redundant SELECT policy", () => {
		expect(canonicalSql.match(/DROP POLICY\s+"notification_preferences_select_own"/gi)).toHaveLength(1);
		expect(canonicalSql.match(/DROP POLICY/gi)).toHaveLength(1);
		expect(canonicalSql).not.toMatch(/DROP POLICY\s+"notification_preferences_upsert_own"/i);
		expect(canonicalSql).not.toMatch(/\b(?:CREATE|ALTER)\s+POLICY\b/i);
	});

	it("pins both pre-policies and the surviving ALL-policy contract", () => {
		expect(canonicalSql.match(new RegExp(policyHash, "gi"))?.length).toBeGreaterThanOrEqual(5);
		expect(canonicalSql).toMatch(/v_select_policy_oid/i);
		expect(canonicalSql).toMatch(/v_upsert_policy_oid/i);
		expect(canonicalSql).toMatch(/policy\.oid\s*=\s*v_upsert_policy_oid/i);
		expect(canonicalSql).toMatch(/policy\.oid\s*=\s*v_select_policy_oid/i);
		expect(canonicalSql).toMatch(/relation\.relacl\s+IS NOT DISTINCT FROM v_relation_acl/i);
		expect(canonicalSql).toMatch(/policy count drifted/i);
	});

	it("changes no rows, ACLs, tables, functions, or surviving policy roles", () => {
		expect(canonicalSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
		expect(canonicalSql).not.toMatch(/\b(?:GRANT|REVOKE|ALTER TABLE|CREATE FUNCTION)\b/i);
		expect(canonicalSql).not.toMatch(/\bTO\s+(?:anon|authenticated|service_role|PUBLIC)\b/i);
	});
});
