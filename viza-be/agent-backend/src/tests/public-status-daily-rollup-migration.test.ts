import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0208_public_status_daily_rollup.sql", import.meta.url),
);
const mirrorPath = fileURLToPath(
	new URL(
		"../../../../viza-fe/internal-website/supabase/migrations/20261019120000_public_status_daily_rollup.sql",
		import.meta.url,
	),
);

describe("public status daily rollup migration", () => {
	it("ships a byte-identical frontend Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(existsSync(mirrorPath)).toBe(true);
		expect(readFileSync(mirrorPath, "utf8")).toBe(readFileSync(canonicalPath, "utf8"));
	});

	it("reads the 90-day window from the rollup, not raw checks", () => {
		const sql = readFileSync(canonicalPath, "utf8");
		const fn = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.get_public_portal_status"));
		expect(fn).toMatch(/FROM public\.portal_health_check_daily/);
		expect(fn).not.toMatch(/FROM public\.portal_health_checks\b/);
	});

	it("keeps the service-only contract and maintains the rollup on insert", () => {
		const sql = readFileSync(canonicalPath, "utf8");
		expect(sql).toMatch(
			/CREATE OR REPLACE FUNCTION public\.get_public_portal_status\(p_days INTEGER DEFAULT 90\)\s*RETURNS JSONB/i,
		);
		expect(sql).toMatch(/LANGUAGE SQL[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/i);
		expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.get_public_portal_status\(INTEGER\) FROM PUBLIC, anon, authenticated/);
		expect(sql).toMatch(/AFTER INSERT ON public\.portal_health_checks\s+REFERENCING NEW TABLE AS new_rows/);
		expect(sql).toMatch(/REVOKE ALL ON TABLE public\.portal_health_check_daily FROM PUBLIC, anon, authenticated/);
		expect(sql).not.toMatch(/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
	});
});
