import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0190_public_status_aggregate_once.sql", import.meta.url),
);
const baselinePath = fileURLToPath(
	new URL("../../drizzle/0150_public_status_tracking.sql", import.meta.url),
);
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const baselineSql = existsSync(baselinePath) ? readFileSync(baselinePath, "utf8") : "";

const databaseUrl = process.env.PUBLIC_STATUS_AGGREGATE_DATABASE_URL?.trim() ?? "";
const confirm = process.env.PUBLIC_STATUS_AGGREGATE_DB_CONFIRM === "local-test";
const nonProductionMarker = (
	process.env.PUBLIC_STATUS_AGGREGATE_DB_NONPRODUCTION?.trim() ?? ""
).toLowerCase();
const allowedMarkerValues = new Set([
	"1",
	"true",
	"local",
	"local-test",
	"non-production",
]);
const allowedDatabaseEnvironments = new Set([
	"local",
	"local-test",
	"test",
	"development",
]);

function isLoopbackDatabaseUrl(value: string): boolean {
	try {
		const host = new URL(value).hostname.toLowerCase();
		return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
	} catch {
		return false;
	}
}

const liveGateEnabled = Boolean(databaseUrl)
	&& confirm
	&& isLoopbackDatabaseUrl(databaseUrl)
	&& allowedMarkerValues.has(nonProductionMarker);
const anyGateInputProvided = Boolean(
	databaseUrl || process.env.PUBLIC_STATUS_AGGREGATE_DB_CONFIRM || nonProductionMarker,
);
if (anyGateInputProvided && !liveGateEnabled) {
	throw new Error(
		"Public status aggregate DB integration requires a dedicated loopback "
		+ "PUBLIC_STATUS_AGGREGATE_DATABASE_URL, PUBLIC_STATUS_AGGREGATE_DB_CONFIRM=local-test, "
		+ "and a non-production marker",
	);
}

const fixtureTables = [
	"portal_health",
	"portal_health_checks",
	"status_incidents",
] as const;
const fixtureRoles = ["anon", "authenticated", "service_role"] as const;
const functionSignature = "public.get_public_portal_status(integer)";
const referenceFunctionSignature = "public.get_public_portal_status_reference(integer)";
const suiteLockName = "viza-public-status-aggregate-once-integration";

type JsonObject = Record<string, unknown>;
type FunctionPair = { baseline: unknown; current: unknown };
type FunctionPairRow = FunctionPair;
type FunctionMetadata = {
	oid: string;
	owner: string;
	security_definer: boolean;
	config: string[] | null;
	volatility: string;
	identity_args: string;
	result_type: string;
	acl: string[];
	definition: string;
};

let pool: Pool | undefined;
let suiteLockClient: PoolClient | undefined;
let fixtureOwned = false;
const createdRoles = new Set<string>();

function asObject(value: unknown, label: string): JsonObject {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${label} was not a JSON object`);
	}
	return value as JsonObject;
}

function asArray(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(`${label} was not a JSON array`);
	return value;
}

function field(object: JsonObject, key: string, label: string): unknown {
	if (!(key in object)) throw new Error(`${label} is missing ${key}`);
	return object[key];
}

function stringField(object: JsonObject, key: string, label: string): string {
	const value = field(object, key, label);
	if (typeof value !== "string") throw new Error(`${label}.${key} was not a string`);
	return value;
}

function numberField(object: JsonObject, key: string, label: string): number {
	const value = field(object, key, label);
	if (typeof value !== "number") throw new Error(`${label}.${key} was not a number`);
	return value;
}

function extractBaselineFunction(): string {
	const match = baselineSql.match(
		/CREATE OR REPLACE FUNCTION public\.get_public_portal_status\(p_days INTEGER DEFAULT 90\)[\s\S]*?\n\$\$;/i,
	);
	if (!match) throw new Error("0150 baseline get_public_portal_status definition was not found");
	return match[0]
		.replace(
			/public\.get_public_portal_status\(/i,
			"public.get_public_portal_status_reference(",
		)
		.replace(/SET search_path\s*=\s*public/i, "SET search_path = ''");
}

async function ensureRole(client: PoolClient, role: string): Promise<void> {
	const result = await client.query<{ exists: boolean }>(
		"SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1) AS exists",
		[role],
	);
	if (result.rows[0]?.exists) return;
	if (!fixtureRoles.includes(role as (typeof fixtureRoles)[number])) {
		throw new Error(`unexpected fixture role ${role}`);
	}
	await client.query(`CREATE ROLE "${role}" NOLOGIN`);
	createdRoles.add(role);
}

async function assertFixtureRelationsAbsent(client: PoolClient): Promise<void> {
	const result = await client.query<{ relname: string }>(
		`SELECT c.relname
		 FROM pg_catalog.pg_class AS c
		 JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
		 WHERE n.nspname = 'public'
		   AND c.relname = ANY($1::text[])
		   AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
		 ORDER BY c.relname`,
		[fixtureTables],
	);
	if (result.rows.length > 0) {
		throw new Error(
			`Refusing public status aggregate fixture setup: relations already exist: `
			+ result.rows.map((row) => row.relname).join(", "),
		);
	}
}

async function createFixture(client: PoolClient): Promise<void> {
	if (!canonicalSql) throw new Error("0190 public status aggregate migration is missing");
	await assertFixtureRelationsAbsent(client);
	const existingFunction = await client.query<{
		function_oid: string | null;
		reference_function_oid: string | null;
	}>(
		`SELECT
			to_regprocedure($1)::text AS function_oid,
			to_regprocedure($2)::text AS reference_function_oid`,
		[functionSignature, referenceFunctionSignature],
	);
	const existingFunctionRow = existingFunction.rows[0];
	if (existingFunctionRow?.function_oid || existingFunctionRow?.reference_function_oid) {
		throw new Error(
			"Refusing fixture setup: public status aggregate fixture function already exists",
		);
	}
	for (const role of fixtureRoles) await ensureRole(client, role);

	await client.query("BEGIN");
	try {
		await client.query(`
			CREATE TABLE public.portal_health (
				country TEXT PRIMARY KEY,
				status TEXT NOT NULL,
				http_status INTEGER,
				latency_ms INTEGER,
				note TEXT,
				error TEXT,
				last_run_at TIMESTAMPTZ NOT NULL,
				monitor_type TEXT NOT NULL,
				iso_code TEXT,
				display_name_en TEXT,
				display_name_zh TEXT,
				description_en TEXT,
				description_zh TEXT,
				public_visible BOOLEAN NOT NULL,
				sort_order INTEGER NOT NULL,
				last_ok_at TIMESTAMPTZ,
				last_failure_at TIMESTAMPTZ,
				last_status_changed_at TIMESTAMPTZ NOT NULL,
				consecutive_failures INTEGER NOT NULL,
				consecutive_successes INTEGER NOT NULL
			);
			CREATE TABLE public.portal_health_checks (
				id TEXT PRIMARY KEY,
				monitor_key TEXT NOT NULL,
				status TEXT NOT NULL,
				checked_at TIMESTAMPTZ NOT NULL
			);
			CREATE TABLE public.status_incidents (
				id TEXT PRIMARY KEY,
				monitor_key TEXT NOT NULL,
				status TEXT NOT NULL,
				severity TEXT NOT NULL,
				started_at TIMESTAMPTZ NOT NULL,
				resolved_at TIMESTAMPTZ,
				last_observed_at TIMESTAMPTZ NOT NULL,
				summary_en TEXT NOT NULL,
				summary_zh TEXT NOT NULL
			);
		`);
		await client.query(
			"ALTER TABLE public.portal_health_checks ENABLE ROW LEVEL SECURITY; "
			+ "ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;",
		);
		await client.query(
			"REVOKE ALL ON TABLE public.portal_health_checks, public.status_incidents "
			+ "FROM PUBLIC, anon, authenticated; "
			+ "GRANT ALL ON TABLE public.portal_health_checks, public.status_incidents TO service_role;",
		);
		await client.query(`
			INSERT INTO public.portal_health (
				country, status, http_status, latency_ms, note, error, last_run_at,
				monitor_type, iso_code, display_name_en, display_name_zh,
				description_en, description_zh, public_visible, sort_order,
				last_ok_at, last_failure_at, last_status_changed_at,
				consecutive_failures, consecutive_successes
			) VALUES
				('alpha', 'ok', 200, 120, 'alpha note', NULL, NOW(),
				 'government_portal', 'AA', 'Alpha', '阿尔法', 'Alpha portal', '阿尔法门户', TRUE, 10,
				 NOW(), NULL, NOW(), 0, 3),
				('beta', 'degraded', 200, 5100, 'beta note', 'slow', NOW(),
				 'government_portal', 'BB', 'Beta', '贝塔', 'Beta portal', '贝塔门户', TRUE, 20,
				 NULL, NOW(), NOW(), 2, 0),
				('gamma', 'unknown', NULL, NULL, NULL, NULL, NOW(),
				 'platform', 'CC', 'Gamma', '伽马', 'Gamma platform', '伽马平台', TRUE, 30,
				 NULL, NULL, NOW(), 0, 0),
				('hidden', 'down', 503, NULL, 'hidden failure', 'down', NOW(),
				 'government_portal', 'HH', 'Hidden', '隐藏', 'Hidden portal', '隐藏门户', FALSE, 40,
				 NULL, NOW(), NOW(), 4, 0);
		`);
		await client.query(`
			INSERT INTO public.portal_health_checks (id, monitor_key, status, checked_at) VALUES
				('alpha-now', 'alpha', 'ok', NOW()),
				('alpha-rolling-boundary', 'alpha', 'down', NOW() - INTERVAL '90 days'),
				('alpha-calendar-boundary', 'alpha', 'degraded', NOW() - INTERVAL '89 days'),
				('alpha-thirty', 'alpha', 'unknown', NOW() - INTERVAL '30 days'),
				('alpha-recent', 'alpha', 'ok', NOW() - INTERVAL '29 days' + INTERVAL '1 hour'),
				('alpha-midnight-early', 'alpha', 'down', date_trunc('day', NOW()) - INTERVAL '1 day' + INTERVAL '1 hour'),
				('alpha-midnight-late', 'alpha', 'ok', date_trunc('day', NOW()) - INTERVAL '1 day' + INTERVAL '23 hours'),
				('alpha-future', 'alpha', 'down', NOW() + INTERVAL '1 day'),
				('alpha-old', 'alpha', 'down', NOW() - INTERVAL '91 days'),
				('beta-recent-ok', 'beta', 'ok', NOW() - INTERVAL '1 hour'),
				('beta-recent-degraded', 'beta', 'degraded', NOW() - INTERVAL '2 hours'),
				('hidden-now', 'hidden', 'down', NOW());
			INSERT INTO public.status_incidents (
				id, monitor_key, status, severity, started_at, resolved_at,
				last_observed_at, summary_en, summary_zh
			) VALUES
				('alpha-old-active', 'alpha', 'investigating', 'down', NOW() - INTERVAL '120 days', NULL,
				 NOW(), 'Alpha is unavailable', '阿尔法当前不可用'),
				('beta-active', 'beta', 'investigating', 'degraded', NOW() - INTERVAL '2 days', NULL,
				 NOW(), 'Beta is degraded', '贝塔性能下降'),
				('alpha-resolved', 'alpha', 'resolved', 'down', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days',
				 NOW() - INTERVAL '2 days', 'Alpha was unavailable', '阿尔法曾不可用'),
				('hidden-active', 'hidden', 'investigating', 'down', NOW() - INTERVAL '1 day', NULL,
				 NOW(), 'Hidden is unavailable', '隐藏当前不可用');
		`);
		const referenceFunction = extractBaselineFunction();
		await client.query(referenceFunction);
		await client.query(
			referenceFunction.replace(
				"public.get_public_portal_status_reference(",
				"public.get_public_portal_status(",
			),
		);
		await client.query(
			"REVOKE ALL ON FUNCTION public.get_public_portal_status(INTEGER) "
			+ "FROM PUBLIC, anon, authenticated, service_role; "
			+ "GRANT EXECUTE ON FUNCTION public.get_public_portal_status(INTEGER) TO service_role; "
			+ "ALTER FUNCTION public.get_public_portal_status(INTEGER) SET search_path = '';",
		);
		await client.query("COMMIT");
		fixtureOwned = true;
	} catch (error) {
		await client.query("ROLLBACK").catch(() => undefined);
		throw error;
	}
}

async function readFunctionMetadata(client: PoolClient): Promise<FunctionMetadata> {
	const result = await client.query<FunctionMetadata>(
		`SELECT
			p.oid::text AS oid,
			pg_catalog.pg_get_userbyid(p.proowner) AS owner,
			p.prosecdef AS security_definer,
			p.proconfig AS config,
			p.provolatile AS volatility,
			pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_args,
			pg_catalog.pg_get_function_result(p.oid) AS result_type,
			ARRAY(
				SELECT aclitem::text
				FROM pg_catalog.unnest(COALESCE(p.proacl, ARRAY[]::pg_catalog.aclitem[])) AS aclitem
				ORDER BY aclitem::text
			) AS acl,
			pg_catalog.pg_get_functiondef(p.oid) AS definition
		 FROM pg_catalog.pg_proc AS p
		 WHERE p.oid = $1::pg_catalog.regprocedure`,
		[functionSignature],
	);
	if (result.rows.length !== 1) throw new Error(`${functionSignature} metadata was not found`);
	return result.rows[0];
}

async function assertExecutePrivilege(
	client: PoolClient,
	role: string,
	expected: boolean,
): Promise<void> {
	const result = await client.query<{ allowed: boolean }>(
		"SELECT pg_catalog.has_function_privilege($1, $2, 'EXECUTE') AS allowed",
		[role, functionSignature],
	);
	expect(result.rows[0]?.allowed).toBe(expected);
}

async function compareFunctions(client: PoolClient, days: number | null): Promise<FunctionPair> {
	const result = await client.query<FunctionPairRow>(
		`SELECT
			public.get_public_portal_status_reference($1::integer) AS baseline,
			public.get_public_portal_status($1::integer) AS current`,
		[days],
	);
	if (result.rows.length !== 1) throw new Error("status aggregate comparison returned no row");
	const pair = result.rows[0];
	expect(pair.current).toEqual(pair.baseline);
	return pair;
}

async function cleanupFixture(): Promise<void> {
	if (!suiteLockClient) return;
	if (fixtureOwned) {
		await suiteLockClient.query("DROP FUNCTION IF EXISTS public.get_public_portal_status(INTEGER)");
		await suiteLockClient.query("DROP FUNCTION IF EXISTS public.get_public_portal_status_reference(INTEGER)");
		await suiteLockClient.query(
			"DROP TABLE IF EXISTS public.status_incidents, public.portal_health_checks, public.portal_health",
		);
		fixtureOwned = false;
	}
	for (const role of [...createdRoles].reverse()) {
		await suiteLockClient.query(`DROP ROLE IF EXISTS "${role}"`);
	}
	createdRoles.clear();
}

const integrationSuite = describe.skipIf(!liveGateEnabled);

integrationSuite("public status aggregate real Postgres contract", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		suiteLockClient = await pool.connect();
		const environment = await suiteLockClient.query<{ viza_environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS viza_environment",
		);
		const databaseEnvironment = (environment.rows[0]?.viza_environment ?? "").toLowerCase();
		if (!allowedDatabaseEnvironments.has(databaseEnvironment)) {
			throw new Error(
				`public status aggregate integration requires app.viza_environment in `
				+ `${[...allowedDatabaseEnvironments].join(", ")}`,
			);
		}
		await suiteLockClient.query("SELECT pg_catalog.pg_advisory_lock(hashtext($1))", [suiteLockName]);
		await createFixture(suiteLockClient);
		const before = await readFunctionMetadata(suiteLockClient);
		await suiteLockClient.query(canonicalSql);
		const after = await readFunctionMetadata(suiteLockClient);

		expect(after.oid).toBe(before.oid);
		expect(after.owner).toBe(before.owner);
		expect(after.security_definer).toBe(before.security_definer);
		expect(after.config).toEqual(before.config);
		expect(after.volatility).toBe(before.volatility);
		expect(after.identity_args).toBe(before.identity_args);
		expect(after.result_type).toBe(before.result_type);
		expect(after.acl).toEqual(before.acl);
		await assertExecutePrivilege(suiteLockClient, "anon", false);
		await assertExecutePrivilege(suiteLockClient, "authenticated", false);
		await assertExecutePrivilege(suiteLockClient, "service_role", true);

		await suiteLockClient.query(canonicalSql);
		const rerun = await readFunctionMetadata(suiteLockClient);
		expect(rerun).toEqual(after);
	});

	it("rejects authorization drift without committing the failed migration", async () => {
		if (!suiteLockClient) throw new Error("integration client is not initialized");
		const client = suiteLockClient;
		const before = await readFunctionMetadata(client);
		await client.query("BEGIN");
		try {
			await client.query(
				"REVOKE EXECUTE ON FUNCTION public.get_public_portal_status(INTEGER) FROM service_role",
			);
			await assertExecutePrivilege(client, "service_role", false);
			await expect(client.query(canonicalSql)).rejects.toThrow(
				/body or authorization contract drifted/i,
			);
		} finally {
			await client.query("ROLLBACK").catch(() => undefined);
		}
		const after = await readFunctionMetadata(client);
		expect(after).toEqual(before);
		await assertExecutePrivilege(client, "anon", false);
		await assertExecutePrivilege(client, "authenticated", false);
		await assertExecutePrivilege(client, "service_role", true);
	});

	it("matches the extracted baseline across bounds and database timezones in one transaction", async () => {
		if (!suiteLockClient) throw new Error("integration client is not initialized");
		const client = suiteLockClient;
		try {
			await client.query("BEGIN");
			for (const timezone of ["UTC", "Europe/Warsaw"]) {
				await client.query("SELECT pg_catalog.set_config('TimeZone', $1, true)", [timezone]);
				await client.query(`
					UPDATE public.portal_health_checks
					SET checked_at = CASE id
						WHEN 'alpha-rolling-boundary' THEN NOW() - INTERVAL '90 days'
						WHEN 'alpha-calendar-boundary' THEN CURRENT_DATE - INTERVAL '89 days'
						WHEN 'alpha-midnight-early' THEN CURRENT_DATE - INTERVAL '1 day' + INTERVAL '1 hour'
						WHEN 'alpha-midnight-late' THEN CURRENT_DATE - INTERVAL '1 day' + INTERVAL '23 hours'
						WHEN 'alpha-future' THEN NOW() + INTERVAL '1 day'
						ELSE checked_at
					END
					WHERE id IN (
						'alpha-rolling-boundary', 'alpha-calendar-boundary',
						'alpha-midnight-early', 'alpha-midnight-late', 'alpha-future'
					)
				`);
				const results = new Map<string, FunctionPair>();
				for (const days of [null, -1, 0, 1, 30, 90, 100] as const) {
					const pair = await compareFunctions(client, days);
					results.set(String(days), pair);
				}
				expect(JSON.stringify(results.get("null")?.current))
					.toBe(JSON.stringify(results.get("90")?.current));
				expect(JSON.stringify(results.get("-1")?.current))
					.toBe(JSON.stringify(results.get("0")?.current));
				expect(JSON.stringify(results.get("100")?.current))
					.toBe(JSON.stringify(results.get("90")?.current));
			}
			await client.query("ROLLBACK");
		} finally {
			await client.query("ROLLBACK").catch(() => undefined);
		}
	});

	it("preserves visibility, unknown-state, mixed-state, and incident-window semantics", async () => {
		if (!suiteLockClient) throw new Error("integration client is not initialized");
		const client = suiteLockClient;
		try {
			await client.query("BEGIN");
			await client.query("SELECT pg_catalog.set_config('TimeZone', 'UTC', true)");
			const normal = await compareFunctions(client, 90);
			const normalSnapshot = asObject(normal.baseline, "normal snapshot");
			const normalMonitors = asArray(field(normalSnapshot, "monitors", "normal snapshot"), "monitors");
			const normalMonitorIds = normalMonitors.map((value) =>
				stringField(asObject(value, "monitor"), "id", "monitor"),
			);
			expect(normalMonitorIds).toEqual(["alpha", "beta", "gamma"]);
			const normalSummary = asObject(field(normalSnapshot, "summary", "normal snapshot"), "summary");
			expect(numberField(normalSummary, "monitored", "summary")).toBe(3);
			expect(numberField(normalSummary, "activeIncidents", "summary")).toBe(2);
			const incidents = asArray(field(normalSnapshot, "incidents", "normal snapshot"), "incidents");
			const incidentIds = incidents.map((value) =>
				stringField(asObject(value, "incident"), "id", "incident"),
			);
			expect(incidentIds).toEqual(["beta-active", "alpha-resolved"]);
			expect(incidentIds).not.toContain("alpha-old-active");
			expect(incidentIds).not.toContain("hidden-active");

			await client.query("UPDATE public.portal_health SET public_visible = FALSE");
			const noVisible = await compareFunctions(client, 90);
			const noVisibleSnapshot = asObject(noVisible.baseline, "no-visible snapshot");
			const noVisibleSummary = asObject(
				field(noVisibleSnapshot, "summary", "no-visible snapshot"),
				"summary",
			);
			expect(numberField(noVisibleSummary, "monitored", "summary")).toBe(0);
			expect(stringField(noVisibleSummary, "status", "summary")).toBe("unknown");
			expect(
				asArray(field(noVisibleSnapshot, "monitors", "no-visible snapshot"), "monitors"),
			).toHaveLength(0);
			expect(
				asArray(field(noVisibleSnapshot, "incidents", "no-visible snapshot"), "incidents"),
			).toHaveLength(0);
			await client.query("ROLLBACK");

			await client.query("BEGIN");
			await client.query("SELECT pg_catalog.set_config('TimeZone', 'UTC', true)");
			await client.query("UPDATE public.portal_health SET status = 'unknown' WHERE public_visible");
			const allUnknown = await compareFunctions(client, 90);
			const allUnknownSummary = asObject(
				field(asObject(allUnknown.baseline, "all-unknown snapshot"), "summary", "all-unknown snapshot"),
				"summary",
			);
			expect(stringField(allUnknownSummary, "status", "summary")).toBe("unknown");
			await client.query("ROLLBACK");

			await client.query("BEGIN");
			await client.query("SELECT pg_catalog.set_config('TimeZone', 'UTC', true)");
			await client.query(
				"UPDATE public.portal_health SET status = CASE country WHEN 'alpha' THEN 'ok' ELSE 'unknown' END "
				+ "WHERE public_visible",
			);
			const mixed = await compareFunctions(client, 90);
			const mixedSummary = asObject(
				field(asObject(mixed.baseline, "mixed snapshot"), "summary", "mixed snapshot"),
				"summary",
			);
			expect(stringField(mixedSummary, "status", "summary")).toBe("unknown");
			await client.query("ROLLBACK");
		} finally {
			await client.query("ROLLBACK").catch(() => undefined);
		}
	});

	afterAll(async () => {
		try {
			await cleanupFixture();
		} finally {
			if (suiteLockClient) {
				await suiteLockClient.query(
					"SELECT pg_catalog.pg_advisory_unlock(hashtext($1))",
					[suiteLockName],
				).catch(() => undefined);
				suiteLockClient.release();
				suiteLockClient = undefined;
			}
			if (pool) {
				await pool.end();
				pool = undefined;
			}
		}
	});
});
