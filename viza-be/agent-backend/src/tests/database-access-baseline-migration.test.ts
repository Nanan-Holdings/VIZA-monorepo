import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0158_database_access_baseline.sql", import.meta.url),
);
const mirrorDirectory = fileURLToPath(
	new URL("../../../../viza-fe/internal-website/supabase/migrations/", import.meta.url),
);
const mirrorName = existsSync(mirrorDirectory)
	? readdirSync(mirrorDirectory).find((name) => /_database_access_baseline\.sql$/i.test(name))
	: undefined;
const mirrorPath = mirrorName ? join(mirrorDirectory, mirrorName) : undefined;
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = mirrorPath && existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";

describe("database access baseline migration", () => {
	it("ships one byte-identical canonical and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(mirrorPath).toBeDefined();
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("makes future public objects deny-by-default for API roles", () => {
		for (const kind of ["TABLES", "SEQUENCES", "FUNCTIONS"]) {
			expect(canonicalSql).toMatch(
				new RegExp(
					`ALTER DEFAULT PRIVILEGES[\\s\\S]*?REVOKE ALL ON ${kind} FROM PUBLIC, anon, authenticated, service_role`,
					"i",
				),
			);
		}
		expect(canonicalSql).toMatch(/FOR ROLE supabase_admin[\s\S]*?REVOKE ALL ON TABLES/i);
		expect(canonicalSql).toMatch(/FOR ROLE supabase_admin[\s\S]*?REVOKE ALL ON SEQUENCES/i);
		expect(canonicalSql).toMatch(/FOR ROLE supabase_admin[\s\S]*?REVOKE ALL ON FUNCTIONS/i);
	});

	it("installs application translations with authenticated ownership RLS", () => {
		expect(canonicalSql).toMatch(/CREATE TABLE IF NOT EXISTS public\.application_translations/i);
		expect(canonicalSql).toMatch(/ALTER TABLE public\.application_translations ENABLE ROW LEVEL SECURITY/i);
		expect(canonicalSql).toMatch(
			/CREATE POLICY application_translations_select_own[\s\S]*?FOR SELECT TO authenticated[\s\S]*?auth\.uid\(\)/i,
		);
		expect(canonicalSql).toMatch(
			/CREATE POLICY application_translations_insert_own[\s\S]*?FOR INSERT TO authenticated[\s\S]*?WITH CHECK[\s\S]*?auth\.uid\(\)/i,
		);
		expect(canonicalSql).toMatch(
			/CREATE POLICY application_translations_update_own[\s\S]*?FOR UPDATE TO authenticated[\s\S]*?USING[\s\S]*?WITH CHECK[\s\S]*?auth\.uid\(\)/i,
		);
		expect(canonicalSql).toMatch(
			/REVOKE ALL ON TABLE public\.application_translations[\s\S]*?FROM PUBLIC, anon, authenticated, service_role[\s\S]*?GRANT SELECT, INSERT, UPDATE ON TABLE public\.application_translations TO authenticated[\s\S]*?GRANT ALL ON TABLE public\.application_translations TO service_role/i,
		);
	});

	it("keeps encrypted and operational tables service-role-only", () => {
		for (const table of [
			"ds160_live_sessions",
			"takeover_session",
			"takeover_action_log",
			"application_inbox_aliases",
		]) {
			expect(canonicalSql).toMatch(
				new RegExp(
					`REVOKE ALL ON TABLE public\\.${table}[\\s\\S]*?FROM PUBLIC, anon, authenticated, service_role[\\s\\S]*?GRANT (?:ALL|SELECT, INSERT, UPDATE, DELETE) ON TABLE public\\.${table} TO service_role`,
					"i",
				),
			);
		}
		expect(canonicalSql).toMatch(
			/REVOKE ALL ON SEQUENCE public\.takeover_action_log_id_seq[\s\S]*?GRANT USAGE, SELECT ON SEQUENCE public\.takeover_action_log_id_seq TO service_role/i,
		);
	});

	it("turns users into an own-row authenticated lookup", () => {
		expect(canonicalSql).toMatch(/ALTER TABLE public\.users ENABLE ROW LEVEL SECURITY/i);
		expect(canonicalSql).toMatch(
			/CREATE POLICY users_select_own[\s\S]*?FOR SELECT TO authenticated[\s\S]*?id = \(SELECT auth\.uid\(\)\)/i,
		);
		expect(canonicalSql).toMatch(
			/REVOKE ALL ON TABLE public\.users[\s\S]*?FROM PUBLIC, anon, authenticated, service_role[\s\S]*?GRANT SELECT ON TABLE public\.users TO authenticated[\s\S]*?GRANT ALL ON TABLE public\.users TO service_role/i,
		);
	});

	it("makes queue depth an invoker view visible only to service role", () => {
		expect(canonicalSql).toMatch(
			/ALTER VIEW public\.runner_queue_depth SET \(security_invoker = true\)/i,
		);
		expect(canonicalSql).toMatch(
			/REVOKE ALL ON TABLE public\.runner_queue_depth[\s\S]*?FROM PUBLIC, anon, authenticated, service_role[\s\S]*?GRANT SELECT ON TABLE public\.runner_queue_depth TO service_role/i,
		);
	});

	it("hardens the service-only SECURITY DEFINER RPC without changing its signature", () => {
		expect(canonicalSql).toMatch(
			/CREATE OR REPLACE FUNCTION public\.commit_travel_agent_turn\(\s*p_session_id text,\s*p_user_id uuid,\s*p_external_message_id text,\s*p_expected_state_version bigint,\s*p_user_content text,\s*p_assistant_content text,\s*p_state_json jsonb,\s*p_memory_summary text,\s*p_openai_response_id text,\s*p_pending_actions_json jsonb,\s*p_response_json jsonb\s*\) RETURNS jsonb[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/i,
		);
		expect(canonicalSql).toMatch(/public\.travel_agent_sessions%ROWTYPE/i);
		expect(canonicalSql).toMatch(/FROM public\.travel_agent_messages/i);
		expect(canonicalSql).toMatch(/UPDATE public\.travel_agent_sessions/i);
		expect(canonicalSql).toMatch(/INSERT INTO public\.travel_agent_messages/i);
		expect(canonicalSql).toMatch(
			/REVOKE ALL ON FUNCTION public\.commit_travel_agent_turn\([\s\S]*?FROM PUBLIC, anon, authenticated, service_role[\s\S]*?GRANT EXECUTE ON FUNCTION public\.commit_travel_agent_turn\([\s\S]*?TO service_role/i,
		);
	});

	it("pins the other confirmed SECURITY DEFINER search paths without replacing them", () => {
		for (const signature of [
			"record_portal_health_check",
			"get_public_portal_status",
			"save_catalogue_draft",
			"publish_catalogue_entry",
			"retire_catalogue_entry",
		]) {
			expect(canonicalSql).toMatch(
				new RegExp(`ALTER FUNCTION public\\.${signature}\\([\\s\\S]*?SET search_path = ''`, "i"),
			);
		}
	});

	it("contains no table drop, rename, or customer-data rewrite", () => {
		expect(canonicalSql).not.toMatch(/DROP\s+TABLE|ALTER\s+TABLE[\s\S]*?RENAME\s+TO/i);
		const executableMigrationSql = canonicalSql.replace(/AS \$\$[\s\S]*?\$\$;/gi, "");
		expect(executableMigrationSql).not.toMatch(
			/\b(?:DELETE|TRUNCATE|UPDATE)\s+(?:FROM\s+)?public\./i,
		);
	});
});
