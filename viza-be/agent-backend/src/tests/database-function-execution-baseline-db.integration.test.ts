import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.DATABASE_FUNCTION_BASELINE_DB_CONFIRM === "local-test";
const databaseUrl = process.env.DATABASE_FUNCTION_BASELINE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.DATABASE_FUNCTION_BASELINE_DB_NONPRODUCTION ?? "").toLowerCase();
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
	fileURLToPath(
		new URL("../../drizzle/0167_database_function_execution_baseline.sql", import.meta.url),
	),
	"utf8",
);

let pool: Pool | undefined;
let client: PoolClient | undefined;
type FunctionIdentity = {
	oid: number;
	source: string;
	volatility: string;
	securityDefiner: boolean;
};
let originalIdentities: Record<string, FunctionIdentity> = {};

const purgeSignatures = [
	"public.purge_old_inbound_email(integer)",
	"public.purge_old_application_answers(integer)",
	"public.purge_old_application_documents(integer)",
	"public.purge_old_submission_artifacts(integer)",
	"public.purge_old_recon_artifacts(integer)",
	"public.purge_old_audit_logs(integer)",
	"public.purge_post_delivery_documents(integer,integer,integer)",
] as const;

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("database function baseline integration client is not initialized");
	return client.query<T>(sql, values);
};

describe.skipIf(!liveGateEnabled)("database function execution baseline database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();
		const databaseMarker = await client.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing function-baseline integration DDL: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
			);
		}
		await client.query("BEGIN");
		await client.query("GRANT USAGE, CREATE ON SCHEMA public TO postgres");
		await client.query("SET ROLE postgres");
		await client.query("CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public");
		await client.query(`
			CREATE OR REPLACE FUNCTION public.purge_old_inbound_email(integer) RETURNS integer
			LANGUAGE sql AS $$ SELECT 1 $$;
			CREATE OR REPLACE FUNCTION public.purge_old_application_answers(integer) RETURNS integer
			LANGUAGE sql AS $$ SELECT 1 $$;
			CREATE OR REPLACE FUNCTION public.purge_old_application_documents(integer) RETURNS integer
			LANGUAGE sql AS $$ SELECT 1 $$;
			CREATE OR REPLACE FUNCTION public.purge_old_submission_artifacts(integer) RETURNS integer
			LANGUAGE sql AS $$ SELECT 1 $$;
			CREATE OR REPLACE FUNCTION public.purge_old_recon_artifacts(integer) RETURNS integer
			LANGUAGE sql AS $$ SELECT 1 $$;
			CREATE OR REPLACE FUNCTION public.purge_old_audit_logs(integer) RETURNS integer
			LANGUAGE sql AS $$ SELECT 1 $$;
			CREATE OR REPLACE FUNCTION public.purge_post_delivery_documents(integer, integer, integer)
			RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;
			CREATE OR REPLACE FUNCTION public.iso_week_start(timestamp with time zone)
			RETURNS date LANGUAGE sql IMMUTABLE AS $$ SELECT DATE '2026-01-05' $$;
			CREATE OR REPLACE FUNCTION public.match_visa_chunks(
				public.vector, integer, text, text, text[], real
			) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT 1 $$;
			GRANT EXECUTE ON FUNCTION public.purge_old_inbound_email(integer) TO PUBLIC, anon, authenticated, service_role;
			GRANT EXECUTE ON FUNCTION public.purge_old_application_answers(integer) TO PUBLIC, anon, authenticated, service_role;
			GRANT EXECUTE ON FUNCTION public.purge_old_application_documents(integer) TO PUBLIC, anon, authenticated, service_role;
			GRANT EXECUTE ON FUNCTION public.purge_old_submission_artifacts(integer) TO PUBLIC, anon, authenticated, service_role;
			GRANT EXECUTE ON FUNCTION public.purge_old_recon_artifacts(integer) TO PUBLIC, anon, authenticated, service_role;
			GRANT EXECUTE ON FUNCTION public.purge_old_audit_logs(integer) TO PUBLIC, anon, authenticated, service_role;
			GRANT EXECUTE ON FUNCTION public.purge_post_delivery_documents(integer, integer, integer) TO PUBLIC, anon, authenticated, service_role;
			GRANT EXECUTE ON FUNCTION public.iso_week_start(timestamp with time zone) TO PUBLIC, anon, authenticated, service_role;
			GRANT EXECUTE ON FUNCTION public.match_visa_chunks(public.vector, integer, text, text, text[], real) TO PUBLIC, anon, authenticated, service_role;
		`);
		const identities = await client.query<{
			name: string;
			oid: number;
			source: string;
			volatility: string;
			security_definer: boolean;
		}>(`
			SELECT proname AS name,
				oid::integer AS oid,
				prosrc AS source,
				provolatile::text AS volatility,
				prosecdef AS security_definer
			FROM pg_proc
			WHERE oid = ANY (ARRAY[
				'public.purge_old_inbound_email(integer)'::regprocedure,
				'public.purge_old_application_answers(integer)'::regprocedure,
				'public.purge_old_application_documents(integer)'::regprocedure,
				'public.purge_old_submission_artifacts(integer)'::regprocedure,
				'public.purge_old_recon_artifacts(integer)'::regprocedure,
				'public.purge_old_audit_logs(integer)'::regprocedure,
				'public.purge_post_delivery_documents(integer,integer,integer)'::regprocedure,
				'public.iso_week_start(timestamp with time zone)'::regprocedure,
				'public.match_visa_chunks(public.vector,integer,text,text,text[],real)'::regprocedure
			])
		`);
		originalIdentities = Object.fromEntries(
			identities.rows.map((row) => [
				row.name,
				{
					oid: row.oid,
					source: row.source,
					volatility: row.volatility,
					securityDefiner: row.security_definer,
				},
			]),
		);
		await client.query(migrationSql);
	});

	it("pins all functions without replacing their identities or bodies", async () => {
		const result = await query<{
			name: string;
			oid: number;
			source: string;
			volatility: string;
			security_definer: boolean;
			config: string[] | null;
		}>(`
			SELECT proname AS name,
				oid::integer AS oid,
				prosrc AS source,
				provolatile::text AS volatility,
				prosecdef AS security_definer,
				proconfig AS config
			FROM pg_proc
			WHERE oid = ANY (ARRAY[
				'public.purge_old_inbound_email(integer)'::regprocedure,
				'public.purge_old_application_answers(integer)'::regprocedure,
				'public.purge_old_application_documents(integer)'::regprocedure,
				'public.purge_old_submission_artifacts(integer)'::regprocedure,
				'public.purge_old_recon_artifacts(integer)'::regprocedure,
				'public.purge_old_audit_logs(integer)'::regprocedure,
				'public.purge_post_delivery_documents(integer,integer,integer)'::regprocedure,
				'public.iso_week_start(timestamp with time zone)'::regprocedure,
				'public.match_visa_chunks(public.vector,integer,text,text,text[],real)'::regprocedure
			])
			ORDER BY proname
		`);
		expect(result.rows).toHaveLength(9);
		for (const row of result.rows) {
			expect({
				oid: row.oid,
				source: row.source,
				volatility: row.volatility,
				securityDefiner: row.security_definer,
			}).toEqual(originalIdentities[row.name]);
			expect(row.config).toContain("search_path=pg_catalog, public");
		}
	});

	it("denies destructive helpers to browser roles and retains service execution", async () => {
		for (const signature of purgeSignatures) {
			const result = await query<{
				anon_execute: boolean;
				auth_execute: boolean;
				service_execute: boolean;
			}>(
				`SELECT
					has_function_privilege('anon', $1, 'EXECUTE') AS anon_execute,
					has_function_privilege('authenticated', $1, 'EXECUTE') AS auth_execute,
					has_function_privilege('service_role', $1, 'EXECUTE') AS service_execute`,
				[signature],
			);
			expect(result.rows[0], signature).toEqual({
				anon_execute: false,
				auth_execute: false,
				service_execute: true,
			});
		}
	});

	it("keeps RAG retrieval available only to authenticated and service roles", async () => {
		const result = await query<{ anon_execute: boolean; auth_execute: boolean; service_execute: boolean }>(`
			SELECT
				has_function_privilege('anon', 'public.match_visa_chunks(public.vector,integer,text,text,text[],real)', 'EXECUTE') AS anon_execute,
				has_function_privilege('authenticated', 'public.match_visa_chunks(public.vector,integer,text,text,text[],real)', 'EXECUTE') AS auth_execute,
				has_function_privilege('service_role', 'public.match_visa_chunks(public.vector,integer,text,text,text[],real)', 'EXECUTE') AS service_execute
		`);
		expect(result.rows[0]).toEqual({
			anon_execute: false,
			auth_execute: true,
			service_execute: true,
		});
	});

	afterAll(async () => {
		if (client) {
			await client.query("RESET ROLE").catch(() => undefined);
			await client.query("ROLLBACK").catch(() => undefined);
			client.release();
		}
		await pool?.end();
	});
});
