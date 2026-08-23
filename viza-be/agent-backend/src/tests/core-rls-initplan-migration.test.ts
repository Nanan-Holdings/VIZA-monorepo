import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0168_core_rls_initplan.sql", import.meta.url),
);
const mirrorDirectory = fileURLToPath(
	new URL("../../../../viza-fe/internal-website/supabase/migrations/", import.meta.url),
);
const mirrorName = existsSync(mirrorDirectory)
	? readdirSync(mirrorDirectory).find((name) => /_core_rls_initplan\.sql$/i.test(name))
	: undefined;
const mirrorPath = mirrorName ? join(mirrorDirectory, mirrorName) : undefined;
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = mirrorPath && existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";

const policies = [
	["applicant_profiles", "applicant_profiles_select_own"],
	["applicant_profiles", "applicant_profiles_insert_own"],
	["applicant_profiles", "applicant_profiles_update_own"],
	["applications", "applications_select_own"],
	["applications", "applications_insert_own"],
	["applications", "applications_update_own"],
	["application_documents", "application_documents_select_own"],
	["application_documents", "application_documents_insert_own"],
	["application_documents", "application_documents_update_own"],
	["application_documents", "application_documents_delete_own"],
	["submission_queue", "submission_queue_insert_own"],
] as const;

describe("core RLS init-plan migration", () => {
	it("ships one byte-identical canonical and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(mirrorPath).toBeDefined();
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("alters exactly the eleven reviewed core ownership policies", () => {
		const altered = [...canonicalSql.matchAll(/ALTER POLICY\s+"([^"]+)"\s+ON\s+public\.([a-z_]+)/gi)]
			.map((match) => [match[2], match[1]])
			.sort();
		expect(altered).toEqual([...policies].map((entry) => [...entry]).sort());
	});

	it("wraps every auth.uid call in a scalar select init plan", () => {
		const calls = [...canonicalSql.matchAll(/auth\.uid\(\)/gi)];
		expect(calls).toHaveLength(14);
		expect(canonicalSql.match(/\(select auth\.uid\(\)\)/gi)).toHaveLength(14);
		expect(canonicalSql.replaceAll(/\(select auth\.uid\(\)\)/gi, "")).not.toMatch(/auth\.uid\(\)/i);
	});

	it("preserves policy identity and application data", () => {
		expect(canonicalSql).not.toMatch(/\b(?:CREATE|DROP)\s+POLICY\b/i);
		expect(canonicalSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
		expect(canonicalSql).not.toMatch(/\b(?:GRANT|REVOKE|ALTER TABLE)\b/i);
	});
});
