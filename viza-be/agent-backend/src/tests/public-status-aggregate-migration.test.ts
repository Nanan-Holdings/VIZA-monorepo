import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0190_public_status_aggregate_once.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
	new URL(
		"../../../../viza-fe/internal-website/supabase/migrations/20260907001027_public_status_aggregate_once.sql",
		import.meta.url,
	),
);

describe("public status aggregate-once migration", () => {
	it("ships a byte-identical frontend Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(existsSync(mirrorPath)).toBe(true);
		const canonical = readFileSync(canonicalPath, "utf8");
		const mirror = readFileSync(mirrorPath, "utf8");
		expect(mirror).toBe(canonical);
	});

	it("keeps the service-only function contract and hardened namespace", () => {
		const sql = readFileSync(canonicalPath, "utf8");
		expect(sql).toMatch(
			/CREATE OR REPLACE FUNCTION public\.get_public_portal_status\(\s*p_days\s+INTEGER\s+DEFAULT\s+90\s*\)[\s\S]*?RETURNS JSONB/i,
		);
		expect(sql).toMatch(/LANGUAGE SQL[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path\s*=\s*''/i);
		expect(sql).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
	});
});
