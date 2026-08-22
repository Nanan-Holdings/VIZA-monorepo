import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0159_database_performance_indexes.sql", import.meta.url),
);
const mirrorDirectory = fileURLToPath(
	new URL("../../../../viza-fe/internal-website/supabase/migrations/", import.meta.url),
);
const mirrorName = existsSync(mirrorDirectory)
	? readdirSync(mirrorDirectory).find((name) => /_database_performance_indexes\.sql$/i.test(name))
	: undefined;
const mirrorPath = mirrorName ? join(mirrorDirectory, mirrorName) : undefined;
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = mirrorPath && existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";

const executableStatements = canonicalSql
	.replace(/\/\*[\s\S]*?\*\//g, " ")
	.replace(/--[^\r\n]*/g, " ")
	.split(";")
	.map((statement) => statement.trim())
	.filter(Boolean);

describe("database performance indexes migration", () => {
	it("ships one byte-identical canonical and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(mirrorPath).toBeDefined();
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("contains only the three approved online idempotent indexes", () => {
		expect(executableStatements).toHaveLength(3);
		for (const statement of executableStatements) {
			expect(statement).toMatch(/^CREATE INDEX CONCURRENTLY IF NOT EXISTS /i);
		}
		expect(canonicalSql).toMatch(
			/CREATE INDEX CONCURRENTLY IF NOT EXISTS submission_queue_application_latest_idx\s+ON public\.submission_queue \(application_id, updated_at DESC, created_at DESC\)/i,
		);
		expect(canonicalSql).toMatch(
			/CREATE INDEX CONCURRENTLY IF NOT EXISTS visa_chunks_document_id_idx\s+ON public\.visa_chunks \(document_id\)/i,
		);
		expect(canonicalSql).toMatch(
			/CREATE INDEX CONCURRENTLY IF NOT EXISTS pii_access_log_application_id_idx\s+ON public\.pii_access_log \(application_id\)/i,
		);
	});

	it("does not mutate rows or remove existing indexes", () => {
		expect(canonicalSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|REINDEX|ALTER)\b/i);
		expect(canonicalSql).not.toMatch(/\bBEGIN\b|\bCOMMIT\b|\bROLLBACK\b/i);
	});
});
