import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.DATABASE_ACCESS_BASELINE_DB_CONFIRM === "local-test";
const databaseUrl = process.env.DATABASE_ACCESS_BASELINE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.DATABASE_ACCESS_BASELINE_DB_NONPRODUCTION ?? "").toLowerCase();
const allowedMarkers = new Set(["local", "local-test", "test", "development"]);
const localHost = (() => {
	try {
		const host = new URL(databaseUrl).hostname.toLowerCase();
		return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "supabase";
	} catch {
		return false;
	}
})();
const liveGateEnabled = Boolean(databaseUrl) && confirm && localHost && allowedMarkers.has(marker);
const migrationSql = readFileSync(
	fileURLToPath(new URL("../../drizzle/0158_database_access_baseline.sql", import.meta.url)),
	"utf8",
);

let pool: Pool | undefined;
let client: PoolClient | undefined;

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("database access baseline integration client is not initialized");
	return client.query<T>(sql, values);
};

describe.skipIf(!liveGateEnabled)("database access baseline database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();
		const databaseMarker = await client.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing access-baseline integration DDL: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
			);
		}
		await client.query("BEGIN");
		// Keep the suite independently runnable against a disposable PostgreSQL
		// container. Every compatibility object is created inside this transaction
		// and rolled back; an already-migrated local Supabase database keeps its
		// real definitions because every statement is IF NOT EXISTS/OR REPLACE.
		await client.query(`
			CREATE TABLE IF NOT EXISTS public.applicant_profiles (
				id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
				auth_user_id UUID
			);
			CREATE TABLE IF NOT EXISTS public.applications (
				id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
				applicant_id UUID NOT NULL REFERENCES public.applicant_profiles(id)
			);
			CREATE TABLE IF NOT EXISTS public.users (id UUID PRIMARY KEY);
			CREATE TABLE IF NOT EXISTS public.submission_queue (
				id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid()
			);
			CREATE TABLE IF NOT EXISTS public.runner_job (
				id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
				application_id UUID NOT NULL REFERENCES public.applications(id),
				country TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'queued',
				finished_at TIMESTAMPTZ
			);
			CREATE TABLE IF NOT EXISTS public.runner_concurrency_cap (
				country TEXT PRIMARY KEY,
				max_concurrent INTEGER NOT NULL DEFAULT 1,
				paused BOOLEAN NOT NULL DEFAULT FALSE
			);
			CREATE OR REPLACE VIEW public.runner_queue_depth AS
			SELECT cap.country, cap.max_concurrent, cap.paused,
				COALESCE(COUNT(job.id) FILTER (WHERE job.status = 'queued'), 0)::INTEGER AS queued,
				COALESCE(COUNT(job.id) FILTER (WHERE job.status = 'running'), 0)::INTEGER AS running,
				COALESCE(COUNT(job.id) FILTER (
					WHERE job.status = 'failed'
					  AND job.finished_at >= pg_catalog.now() - INTERVAL '24 hours'
				), 0)::INTEGER AS failed_24h
			FROM public.runner_concurrency_cap AS cap
			LEFT JOIN public.runner_job AS job ON job.country = cap.country
			GROUP BY cap.country, cap.max_concurrent, cap.paused;
			CREATE TABLE IF NOT EXISTS public.ds160_live_sessions (
				id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid()
			);
			CREATE TABLE IF NOT EXISTS public.takeover_session (
				id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
				job_id UUID NOT NULL REFERENCES public.runner_job(id),
				application_id UUID NOT NULL REFERENCES public.applications(id),
				applicant_id UUID NOT NULL REFERENCES public.applicant_profiles(id),
				status TEXT NOT NULL DEFAULT 'queued',
				reason TEXT NOT NULL,
				remote_debug_url TEXT NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
			);
			CREATE TABLE IF NOT EXISTS public.takeover_action_log (
				id BIGSERIAL PRIMARY KEY,
				takeover_id UUID NOT NULL REFERENCES public.takeover_session(id),
				action TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS public.application_inbox_aliases (
				application_id UUID PRIMARY KEY REFERENCES public.applications(id),
				applicant_id UUID NOT NULL REFERENCES public.applicant_profiles(id),
				alias TEXT NOT NULL UNIQUE
			);
			CREATE TABLE IF NOT EXISTS public.runner_concurrency_metric (
				id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
				event_type TEXT NOT NULL,
				outcome TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS public.travel_agent_sessions (
				id TEXT PRIMARY KEY,
				user_id UUID NOT NULL,
				state_version BIGINT NOT NULL DEFAULT 0,
				state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
				memory_summary TEXT,
				openai_previous_response_id TEXT,
				pending_actions_json JSONB,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
			);
			CREATE TABLE IF NOT EXISTS public.travel_agent_messages (
				id BIGSERIAL PRIMARY KEY,
				session_id TEXT NOT NULL,
				user_id UUID NOT NULL,
				external_message_id TEXT NOT NULL,
				role TEXT NOT NULL,
				content TEXT NOT NULL,
				openai_response_id TEXT,
				response_json JSONB
			);
			CREATE OR REPLACE FUNCTION public.commit_travel_agent_turn(
				p_session_id text,
				p_user_id uuid,
				p_external_message_id text,
				p_expected_state_version bigint,
				p_user_content text,
				p_assistant_content text,
				p_state_json jsonb,
				p_memory_summary text,
				p_openai_response_id text,
				p_pending_actions_json jsonb,
				p_response_json jsonb
			) RETURNS jsonb
			LANGUAGE sql SECURITY DEFINER SET search_path = public
			AS $$ SELECT '{}'::jsonb $$;
			GRANT EXECUTE ON FUNCTION public.commit_travel_agent_turn(
				text, uuid, text, bigint, text, text, jsonb, text, text, jsonb, jsonb
			) TO PUBLIC, anon, authenticated, service_role;
		`);
		await client.query(migrationSql);
	});

	it("installs RLS and exact table privileges", async () => {
		const result = await query<{
			translations_rls: boolean;
			users_rls: boolean;
			anon_ds160: boolean;
			auth_takeover: boolean;
			service_ds160: boolean;
			auth_translation_select: boolean;
			auth_translation_delete: boolean;
		}>(`SELECT
			(SELECT relrowsecurity FROM pg_class WHERE oid = 'public.application_translations'::regclass) AS translations_rls,
			(SELECT relrowsecurity FROM pg_class WHERE oid = 'public.users'::regclass) AS users_rls,
			has_table_privilege('anon', 'public.ds160_live_sessions', 'SELECT') AS anon_ds160,
			has_table_privilege('authenticated', 'public.takeover_session', 'SELECT') AS auth_takeover,
			has_table_privilege('service_role', 'public.ds160_live_sessions', 'SELECT') AS service_ds160,
			has_table_privilege('authenticated', 'public.application_translations', 'SELECT') AS auth_translation_select,
			has_table_privilege('authenticated', 'public.application_translations', 'DELETE') AS auth_translation_delete`);
		expect(result.rows[0]).toEqual({
			translations_rls: true,
			users_rls: true,
			anon_ds160: false,
			auth_takeover: false,
			service_ds160: true,
			auth_translation_select: true,
			auth_translation_delete: false,
		});
	});

	it("uses invoker view security and service-only RPC execution", async () => {
		const result = await query<{
			view_options: string[] | null;
			anon_commit: boolean;
			auth_commit: boolean;
			service_commit: boolean;
			function_config: string[] | null;
		}>(`SELECT
			(SELECT reloptions FROM pg_class WHERE oid = 'public.runner_queue_depth'::regclass) AS view_options,
			has_function_privilege('anon', 'public.commit_travel_agent_turn(text,uuid,text,bigint,text,text,jsonb,text,text,jsonb,jsonb)', 'EXECUTE') AS anon_commit,
			has_function_privilege('authenticated', 'public.commit_travel_agent_turn(text,uuid,text,bigint,text,text,jsonb,text,text,jsonb,jsonb)', 'EXECUTE') AS auth_commit,
			has_function_privilege('service_role', 'public.commit_travel_agent_turn(text,uuid,text,bigint,text,text,jsonb,text,text,jsonb,jsonb)', 'EXECUTE') AS service_commit,
			(SELECT proconfig FROM pg_proc WHERE oid = 'public.commit_travel_agent_turn(text,uuid,text,bigint,text,text,jsonb,text,text,jsonb,jsonb)'::regprocedure) AS function_config`);
		expect(result.rows[0]?.view_options).toContain("security_invoker=true");
		expect(result.rows[0]?.anon_commit).toBe(false);
		expect(result.rows[0]?.auth_commit).toBe(false);
		expect(result.rows[0]?.service_commit).toBe(true);
		expect(result.rows[0]?.function_config).toContain("search_path=\"\"");
	});

	it("records deny-by-default ACLs for the migration owner", async () => {
		const result = await query<{ object_type: string; grantee: string; privilege_type: string }>(`SELECT
			defaults.defaclobjtype AS object_type,
			COALESCE(grantee_role.rolname, 'PUBLIC') AS grantee,
			acl.privilege_type
		FROM pg_default_acl AS defaults
		CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS acl
		LEFT JOIN pg_roles AS grantee_role ON grantee_role.oid = acl.grantee
		WHERE defaclnamespace = 'public'::regnamespace
		  AND defaclrole = (SELECT oid FROM pg_roles WHERE rolname = current_user)
		  AND defaclobjtype IN ('r', 'S', 'f')
		  AND (acl.grantee = 0 OR grantee_role.rolname IN ('anon', 'authenticated', 'service_role'))
		ORDER BY object_type, grantee, privilege_type`);
		expect(result.rows).toEqual([]);
	});

	afterAll(async () => {
		if (client) {
			await client.query("ROLLBACK").catch(() => undefined);
			client.release();
		}
		await pool?.end();
	});
});
