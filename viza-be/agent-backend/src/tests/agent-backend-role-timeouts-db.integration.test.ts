import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.AGENT_BACKEND_ROLE_TIMEOUTS_DB_CONFIRM === "local-test";
const databaseUrl =
	process.env.AGENT_BACKEND_ROLE_TIMEOUTS_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.AGENT_BACKEND_ROLE_TIMEOUTS_DB_NONPRODUCTION ?? "").toLowerCase();
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
	fileURLToPath(new URL("../../drizzle/0160_agent_backend_role_timeouts.sql", import.meta.url)),
	"utf8",
);

const harnessRole = "viza_role_timeout_test_admin";
let pool: Pool | undefined;
let client: PoolClient | undefined;
let originalConfig: string[] | null | undefined;
let originalSuperuser: boolean | undefined;

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("role-timeout integration client is not initialized");
	return client.query<T>(sql, values);
};

describe.skipIf(!liveGateEnabled)("agent-backend role timeout database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();

		const databaseMarker = await query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing role-timeout integration DDL: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
			);
		}

		const bootstrap = await query<{
			current_user: string;
			is_superuser: boolean;
			target_config: string[] | null;
			target_superuser: boolean | null;
		}>(`SELECT
			current_user,
			(SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser,
			(SELECT rolconfig FROM pg_roles WHERE rolname = 'postgres') AS target_config,
			(SELECT rolsuper FROM pg_roles WHERE rolname = 'postgres') AS target_superuser`);
		if (!bootstrap.rows[0]?.is_superuser) {
			throw new Error("Role-timeout integration requires a disposable local superuser bootstrap URL");
		}
		if (bootstrap.rows[0]?.target_superuser == null) {
			throw new Error("Role-timeout integration requires the local postgres role");
		}
		originalConfig = bootstrap.rows[0].target_config;
		originalSuperuser = bootstrap.rows[0].target_superuser;

		await query("BEGIN");
		await query(`CREATE ROLE ${harnessRole} SUPERUSER NOLOGIN`);
		await query(`GRANT ${harnessRole} TO postgres`);
		await query(`SET ROLE ${harnessRole}`);
		await query("ALTER ROLE postgres NOSUPERUSER");
		await query("SET ROLE postgres");

		const executionRole = await query<{ current_user: string; is_superuser: boolean }>(`SELECT
			current_user,
			(SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser`);
		expect(executionRole.rows[0]).toEqual({ current_user: "postgres", is_superuser: false });

		await query(migrationSql);
	});

	it("stores each exact timeout once in postgres.rolconfig", async () => {
		const result = await query<{
			statement_settings: string[];
			idle_transaction_settings: string[];
		}>(`SELECT
			ARRAY(
				SELECT setting
				FROM unnest(COALESCE(rolconfig, ARRAY[]::text[])) AS setting
				WHERE split_part(setting, '=', 1) = 'statement_timeout'
			) AS statement_settings,
			ARRAY(
				SELECT setting
				FROM unnest(COALESCE(rolconfig, ARRAY[]::text[])) AS setting
				WHERE split_part(setting, '=', 1) = 'idle_in_transaction_session_timeout'
			) AS idle_transaction_settings
		FROM pg_roles
		WHERE rolname = 'postgres'`);

		expect(result.rows[0]).toEqual({
			statement_settings: ["statement_timeout=30s"],
			idle_transaction_settings: ["idle_in_transaction_session_timeout=30s"],
		});
	});

	it("is idempotent when the approved batch is replayed", async () => {
		await query(migrationSql);
		const result = await query<{ settings: string[] }>(`SELECT ARRAY(
			SELECT setting
			FROM unnest(COALESCE(rolconfig, ARRAY[]::text[])) AS setting
			WHERE split_part(setting, '=', 1) IN (
				'statement_timeout',
				'idle_in_transaction_session_timeout'
			)
			ORDER BY setting
		) AS settings
		FROM pg_roles
		WHERE rolname = 'postgres'`);
		expect(result.rows[0]?.settings).toEqual([
			"idle_in_transaction_session_timeout=30s",
			"statement_timeout=30s",
		]);
	});

	afterAll(async () => {
		if (client) {
			await client.query(`SET ROLE ${harnessRole}`).catch(() => undefined);
			await client.query("ROLLBACK").catch(() => undefined);
			await client.query("RESET ROLE").catch(() => undefined);

			if (originalSuperuser !== undefined) {
				const restored = await client.query<{
					rolconfig: string[] | null;
					rolsuper: boolean;
					harness_exists: boolean;
				}>(`SELECT
					(SELECT rolconfig FROM pg_roles WHERE rolname = 'postgres') AS rolconfig,
					(SELECT rolsuper FROM pg_roles WHERE rolname = 'postgres') AS rolsuper,
					EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${harnessRole}') AS harness_exists`);
				expect(restored.rows[0]).toEqual({
					rolconfig: originalConfig ?? null,
					rolsuper: originalSuperuser,
					harness_exists: false,
				});
			}
			client.release();
		}
		await pool?.end();
	});
});
