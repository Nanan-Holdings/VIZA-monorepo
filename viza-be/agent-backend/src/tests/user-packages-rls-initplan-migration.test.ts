import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0171_user_packages_rls_initplan.sql", import.meta.url),
);
const mirrorDirectory = fileURLToPath(
	new URL("../../../../viza-fe/internal-website/supabase/migrations/", import.meta.url),
);
const mirrorName = existsSync(mirrorDirectory)
	? readdirSync(mirrorDirectory).find((name) => /_user_packages_rls_initplan\.sql$/i.test(name))
	: undefined;
const mirrorPath = mirrorName ? join(mirrorDirectory, mirrorName) : undefined;
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = mirrorPath && existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";

describe("user packages RLS init-plan migration", () => {
	it("ships one byte-identical canonical and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(mirrorPath).toBeDefined();
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("alters only the reviewed authenticated SELECT policy", () => {
		expect(canonicalSql.match(/ALTER POLICY\s+"user_packages_select"/gi)).toHaveLength(1);
		expect(canonicalSql).toMatch(/ON\s+public\.user_packages/i);
		expect(canonicalSql).toMatch(/USING\s*\(\s*\(select auth\.uid\(\)\)\s*=\s*auth_user_id\s*\)/i);
		expect(canonicalSql).not.toMatch(/\b(?:CREATE|DROP)\s+POLICY\b/i);
	});

	it("changes no data, grants, tables, or functions", () => {
		expect(canonicalSql.match(/auth\.uid\(\)/gi)).toHaveLength(1);
		expect(canonicalSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
		expect(canonicalSql).not.toMatch(/\b(?:GRANT|REVOKE|ALTER TABLE|CREATE FUNCTION)\b/i);
	});
});
