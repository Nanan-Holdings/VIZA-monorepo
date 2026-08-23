import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0167_database_function_execution_baseline.sql", import.meta.url),
);
const mirrorDirectory = fileURLToPath(
	new URL("../../../../viza-fe/internal-website/supabase/migrations/", import.meta.url),
);
const mirrorName = existsSync(mirrorDirectory)
	? readdirSync(mirrorDirectory).find((name) =>
		/_database_function_execution_baseline\.sql$/i.test(name),
	)
	: undefined;
const mirrorPath = mirrorName ? join(mirrorDirectory, mirrorName) : undefined;
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = mirrorPath && existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";

const purgeFunctions = [
	"purge_old_inbound_email",
	"purge_old_application_answers",
	"purge_old_application_documents",
	"purge_old_submission_artifacts",
	"purge_old_recon_artifacts",
	"purge_old_audit_logs",
	"purge_post_delivery_documents",
] as const;

describe("database function execution baseline migration", () => {
	it("ships one byte-identical canonical and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(mirrorPath).toBeDefined();
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("pins all nine Advisor findings to a fixed trusted search path", () => {
		for (const functionName of [...purgeFunctions, "iso_week_start", "match_visa_chunks"]) {
			expect(canonicalSql).toMatch(
				new RegExp(
					`ALTER FUNCTION public\\.${functionName}\\([\\s\\S]*?SET search_path = pg_catalog, public`,
					"i",
				),
			);
		}
	});

	it("keeps destructive retention helpers service-role-only", () => {
		for (const functionName of purgeFunctions) {
			expect(canonicalSql).toMatch(
				new RegExp(
					`REVOKE ALL ON FUNCTION public\\.${functionName}\\([\\s\\S]*?FROM PUBLIC, anon, authenticated, service_role[\\s\\S]*?GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*?TO service_role`,
					"i",
				),
			);
		}
	});

	it("keeps vector retrieval authenticated and service-only", () => {
		expect(canonicalSql).toMatch(
			/REVOKE ALL ON FUNCTION public\.match_visa_chunks\([\s\S]*?FROM PUBLIC, anon, authenticated, service_role[\s\S]*?GRANT EXECUTE ON FUNCTION public\.match_visa_chunks\([\s\S]*?TO authenticated, service_role/i,
		);
	});

	it("preserves function bodies, identities, and application data", () => {
		expect(canonicalSql).not.toMatch(/CREATE(?: OR REPLACE)? FUNCTION|DROP FUNCTION/i);
		expect(canonicalSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
	});
});
