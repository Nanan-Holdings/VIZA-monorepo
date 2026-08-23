import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0173_notification_signature_rls_initplan.sql", import.meta.url),
);
const mirrorDirectory = fileURLToPath(
	new URL("../../../../viza-fe/internal-website/supabase/migrations/", import.meta.url),
);
const mirrorName = existsSync(mirrorDirectory)
	? readdirSync(mirrorDirectory).find((name) =>
		/_notification_signature_rls_initplan\.sql$/i.test(name),
	)
	: undefined;
const mirrorPath = mirrorName ? join(mirrorDirectory, mirrorName) : undefined;
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = mirrorPath && existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";

describe("notification and signature RLS init-plan migration", () => {
	it("ships one byte-identical canonical and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(mirrorPath).toBeDefined();
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("alters only the two reviewed public SELECT policies", () => {
		expect(canonicalSql.match(/ALTER POLICY\s+"notification_event_log_select_own"/gi)).toHaveLength(1);
		expect(canonicalSql.match(/ALTER POLICY\s+"signature_event_select_own"/gi)).toHaveLength(1);
		expect(canonicalSql).toMatch(/ON\s+public\.notification_event_log/i);
		expect(canonicalSql).toMatch(/ON\s+public\.signature_event/i);
		expect(canonicalSql.match(/applicant_id\s+IN\s*\(\s*SELECT\s+id\s+FROM\s+public\.applicant_profiles\s+WHERE\s+auth_user_id\s*=\s*\(select auth\.uid\(\)\)\s*\)/gi)).toHaveLength(2);
		expect(canonicalSql).not.toMatch(/\b(?:CREATE|DROP)\s+POLICY\b/i);
	});

	it("changes no data, grants, tables, or functions", () => {
		expect(canonicalSql.match(/auth\.uid\(\)/gi)).toHaveLength(2);
		expect(canonicalSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
		expect(canonicalSql).not.toMatch(/\b(?:GRANT|REVOKE|ALTER TABLE|CREATE FUNCTION)\b/i);
	});
});
