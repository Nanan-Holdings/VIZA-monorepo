import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0174_inbound_email_rls_initplan.sql", import.meta.url),
);
const mirrorDirectory = fileURLToPath(
	new URL("../../../../viza-fe/internal-website/supabase/migrations/", import.meta.url),
);
const mirrorName = existsSync(mirrorDirectory)
	? readdirSync(mirrorDirectory).find((name) => /_inbound_email_rls_initplan\.sql$/i.test(name))
	: undefined;
const mirrorPath = mirrorName ? join(mirrorDirectory, mirrorName) : undefined;
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = mirrorPath && existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";

describe("inbound-email RLS init-plan migration", () => {
	it("ships one byte-identical canonical and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(mirrorPath).toBeDefined();
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("alters only the reviewed applicant-owned SELECT policy", () => {
		expect(canonicalSql.match(/ALTER POLICY\s+"inbound_email_select_owning_applicant"/gi)).toHaveLength(1);
		expect(canonicalSql).toMatch(/ON\s+public\.inbound_email/i);
		expect(canonicalSql).toMatch(/quarantined\s*=\s*(?:false|FALSE)/i);
		expect(canonicalSql).toMatch(/LOWER\(to_addr\)\s+IN\s*\(\s*SELECT\s+LOWER\(inbox_alias\)\s+FROM\s+public\.applicant_profiles/i);
		expect(canonicalSql).toMatch(/auth_user_id\s*=\s*\(select auth\.uid\(\)\)/i);
		expect(canonicalSql).toMatch(/inbox_alias\s+IS\s+NOT\s+NULL/i);
		expect(canonicalSql).toMatch(/inbox_alias_retired_at\s+IS\s+NULL/i);
		expect(canonicalSql).not.toMatch(/\b(?:CREATE|DROP)\s+POLICY\b/i);
	});

	it("changes no data, ACL, tables, functions, or service-role behavior", () => {
		expect(canonicalSql.match(/auth\.uid\(\)/gi)).toHaveLength(1);
		expect(canonicalSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
		expect(canonicalSql).not.toMatch(/\b(?:GRANT|REVOKE|ALTER TABLE|CREATE FUNCTION)\b/i);
	});
});
