import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0176_inbound_email_acl.sql", import.meta.url),
);
const mirrorDirectory = fileURLToPath(
	new URL("../../../../viza-fe/internal-website/supabase/migrations/", import.meta.url),
);
const mirrorName = existsSync(mirrorDirectory)
	? readdirSync(mirrorDirectory).find((name) => /_inbound_email_acl\.sql$/iu.test(name))
	: undefined;
const mirrorPath = mirrorName ? join(mirrorDirectory, mirrorName) : undefined;
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = mirrorPath && existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";

describe("inbound-email ACL migration", () => {
	it("ships one byte-identical canonical and Supabase mirror", () => {
		expect(dirname(canonicalPath)).toMatch(/[\\/]drizzle$/u);
		expect(existsSync(canonicalPath)).toBe(true);
		expect(mirrorPath).toBeDefined();
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("removes anonymous and signed-in mutation privileges while preserving owned reads", () => {
		expect(canonicalSql).toMatch(
			/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.inbound_email\s+FROM\s+PUBLIC,\s*anon,\s*authenticated,\s*service_role/iu,
		);
		expect(canonicalSql).toMatch(
			/GRANT\s+SELECT\s+ON\s+TABLE\s+public\.inbound_email\s+TO\s+authenticated/iu,
		);
		expect(canonicalSql).toMatch(
			/GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE,\s*TRUNCATE,\s*REFERENCES,\s*TRIGGER\s+ON\s+TABLE\s+public\.inbound_email\s+TO\s+service_role/iu,
		);
		expect(canonicalSql).not.toMatch(/\bGRANT\b[^;]*\bTO\s+(?:PUBLIC|anon)\b/iu);
	});

	it("changes no rows, policies, tables, functions, or RLS state", () => {
		expect(canonicalSql).not.toMatch(/^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/imu);
		expect(canonicalSql).not.toMatch(/\b(?:CREATE|ALTER|DROP)\s+(?:POLICY|TABLE|FUNCTION)\b/iu);
		expect(canonicalSql).not.toMatch(/\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/iu);
	});
});
