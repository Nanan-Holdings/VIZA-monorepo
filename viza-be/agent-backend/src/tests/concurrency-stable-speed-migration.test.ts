import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0155_concurrency_stable_speed.sql", import.meta.url),
);
const mirrorDirectory = fileURLToPath(
	new URL("../../../../viza-fe/internal-website/supabase/migrations/", import.meta.url),
);
const mirrorName = existsSync(mirrorDirectory)
	? readdirSync(mirrorDirectory).find((name) => /_concurrency_stable_speed\.sql$/i.test(name))
	: undefined;
const mirrorPath = mirrorName ? join(mirrorDirectory, mirrorName) : undefined;
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = mirrorPath && existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";
const renewBody = canonicalSql.match(
	/CREATE OR REPLACE FUNCTION public\.renew_runner_machine_slot\([\s\S]*?\n\$\$;/i,
 )?.[0] ?? "";
const poolHealthBody = canonicalSql.match(
	/CREATE OR REPLACE VIEW public\.runner_pool_concurrency_health[\s\S]*?;/i,
 )?.[0] ?? "";

describe("stable concurrency speed migration", () => {
	it("ships one byte-identical canonical and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(mirrorPath).toBeDefined();
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("renews only the exact live owner using the database clock", () => {
		expect(canonicalSql).toMatch(
			/CREATE OR REPLACE FUNCTION public\.renew_runner_machine_slot\(\s*p_machine_id TEXT,\s*p_kind TEXT,\s*p_lease_seconds INTEGER DEFAULT 1800\s*\)\s*RETURNS TABLE\s*\(\s*slot_number SMALLINT,\s*lease_until TIMESTAMPTZ\s*\)\s*LANGUAGE plpgsql\s*SECURITY INVOKER\s*SET search_path = ''/i,
		);
		expect(renewBody).toMatch(/v_now\s+TIMESTAMPTZ[\s\S]*?clock_timestamp\(\)/i);
		expect(renewBody).toMatch(
			/UPDATE public\.runner_machine_slot[\s\S]*?owner_machine_id\s*=\s*v_machine_id[\s\S]*?owner_kind\s*=\s*v_kind[\s\S]*?lease_until\s*>\s*v_now/i,
		);
		expect(renewBody).toMatch(
			/SELECT[\s\S]*?owner_machine_id\s*=\s*v_machine_id[\s\S]*?owner_kind\s*=\s*v_kind[\s\S]*?FOR UPDATE[\s\S]*?v_now\s*:=\s*pg_catalog\.clock_timestamp\(\)/i,
		);
		expect(renewBody).toMatch(/RETURNING\s+(?:slot\.)?slot_number,\s*(?:slot\.)?lease_until/i);
		expect(renewBody).not.toMatch(/LOCK TABLE|DELETE FROM|INSERT INTO|owner_machine_id\s*=\s*NULL/i);
		expect(canonicalSql).toMatch(
			/REVOKE ALL ON FUNCTION public\.renew_runner_machine_slot\(TEXT, TEXT, INTEGER\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/i,
		);
		expect(canonicalSql).toMatch(
			/GRANT EXECUTE ON FUNCTION public\.renew_runner_machine_slot\(TEXT, TEXT, INTEGER\)\s+TO service_role;/i,
		);
	});

	it("provides service-only six-flow queue health and ten-slot health views", () => {
		expect(canonicalSql).toMatch(
			/CREATE OR REPLACE VIEW public\.runner_pool_concurrency_health\s+WITH \(security_invoker\s*=\s*true\)/i,
		);
		expect(poolHealthBody).toMatch(
			/claimable[\s\S]*scheduled[\s\S]*running[\s\S]*expired_running[\s\S]*capacity_headroom[\s\S]*oldest_claimable_age_seconds/i,
		);
		expect(canonicalSql).toMatch(/vietnam.*vn_prearrival/i);
		expect(canonicalSql).toMatch(/singapore.*sgac/i);
		expect(canonicalSql).toMatch(/malaysia.*mdac/i);
		expect(canonicalSql).toMatch(/thailand.*tdac/i);
		expect(canonicalSql).toMatch(/south_korea.*kr_eform/i);
		expect(canonicalSql).toMatch(/taiwan.*tw_entry_permit/i);
		expect(canonicalSql).toMatch(
			/CREATE OR REPLACE VIEW public\.runner_slot_capacity_health\s+WITH \(security_invoker\s*=\s*true\)[\s\S]*?max_slots[\s\S]*?live_slots[\s\S]*?free_slots[\s\S]*?pool_live_slots[\s\S]*?sticky_live_slots[\s\S]*?expired_owned_slots[\s\S]*?stale_renewal_slots[\s\S]*?invalid_slots[\s\S]*?utilization_percent/i,
		);
		expect(canonicalSql).toMatch(
			/free_slots[\s\S]*?owner_machine_id IS NULL[\s\S]*?owner_kind IS NULL[\s\S]*?lease_until IS NULL/i,
		);
		expect(canonicalSql).toMatch(
			/expired_owned_slots[\s\S]*?owner_machine_id IS NOT NULL[\s\S]*?lease_until IS NULL/i,
		);
		expect(canonicalSql).toMatch(
			/REVOKE ALL ON TABLE public\.runner_pool_concurrency_health\s+FROM PUBLIC, anon, authenticated, service_role;[\s\S]*?GRANT SELECT ON TABLE public\.runner_pool_concurrency_health TO service_role;/i,
		);
		expect(canonicalSql).toMatch(
			/REVOKE ALL ON TABLE public\.runner_slot_capacity_health\s+FROM PUBLIC, anon, authenticated, service_role;[\s\S]*?GRANT SELECT ON TABLE public\.runner_slot_capacity_health TO service_role;/i,
		);
	});

	it("stores only bounded non-PII claim and machine-start metrics behind RLS", () => {
		expect(canonicalSql).toMatch(
			/CREATE TABLE IF NOT EXISTS public\.runner_concurrency_metric[\s\S]*?event_type TEXT NOT NULL[\s\S]*?outcome TEXT NOT NULL[\s\S]*?duration_ms INTEGER[\s\S]*?country TEXT[\s\S]*?machine_kind TEXT[\s\S]*?count INTEGER NOT NULL DEFAULT 1[\s\S]*?recorded_at TIMESTAMPTZ NOT NULL DEFAULT/i,
		);
		expect(canonicalSql).toMatch(
			/CONSTRAINT runner_concurrency_metric_event_type_check\s+CHECK \(event_type IN \('claim', 'machine_start'\)\)/i,
		);
		expect(canonicalSql).toMatch(/ALTER TABLE public\.runner_concurrency_metric ENABLE ROW LEVEL SECURITY/i);
		expect(canonicalSql).toMatch(
			/REVOKE ALL ON TABLE public\.runner_concurrency_metric\s+FROM PUBLIC, anon, authenticated, service_role;[\s\S]*?GRANT SELECT, INSERT ON TABLE public\.runner_concurrency_metric TO service_role;/i,
		);
		expect(canonicalSql).toMatch(/runner_concurrency_metric_recorded_idx/i);
		expect(canonicalSql).toMatch(
			/REVOKE ALL ON SEQUENCE public\.runner_concurrency_metric_id_seq\s+FROM PUBLIC, anon, authenticated, service_role;[\s\S]*?GRANT USAGE, SELECT ON SEQUENCE public\.runner_concurrency_metric_id_seq TO service_role;/i,
		);
		expect(canonicalSql).not.toMatch(/runner_concurrency_metric[\s\S]*(?:applicant|application|email|passport|metadata|jsonb)/i);
	});

	it("does not alter approved caps or the ten logical slot rows", () => {
		expect(canonicalSql).not.toMatch(/INSERT INTO public\.runner_concurrency_cap/i);
		expect(canonicalSql).not.toMatch(/UPDATE public\.runner_concurrency_cap/i);
		expect(canonicalSql).not.toMatch(/INSERT INTO public\.runner_machine_slot/i);
		expect(canonicalSql).not.toMatch(/DELETE FROM public\.runner_machine_slot/i);
	});
});
