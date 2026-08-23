import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.USER_PACKAGES_RLS_INITPLAN_DB_CONFIRM === "local-test";
const databaseUrl =
	process.env.USER_PACKAGES_RLS_INITPLAN_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.USER_PACKAGES_RLS_INITPLAN_DB_NONPRODUCTION ?? "").toLowerCase();
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
	fileURLToPath(new URL("../../drizzle/0171_user_packages_rls_initplan.sql", import.meta.url)),
	"utf8",
);

const ownUser = "11111111-1111-4111-8111-111111111111";
const otherUser = "22222222-2222-4222-8222-222222222222";
const expectedPostHash = "2be57c38df7ccb57585e26e8063a9915959f6814c740ec2f581dd7830759c312";

let pool: Pool | undefined;
let client: PoolClient | undefined;
let originalPolicyOid = 0;

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("user packages RLS integration client is not initialized");
	return client.query<T>(sql, values);
};

describe.skipIf(!liveGateEnabled)("user packages RLS init-plan database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();
		const databaseMarker = await client.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing user packages RLS integration DDL: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
			);
		}

		await client.query("BEGIN");
		const collision = await client.query<{ present: string | null }>(
			"SELECT pg_catalog.to_regclass('public.user_packages')::text AS present",
		);
		if (collision.rows[0]?.present) {
			throw new Error("Refusing user packages RLS fixture setup: public.user_packages exists");
		}
		await client.query(`
			CREATE TABLE public.user_packages (
				id uuid PRIMARY KEY,
				auth_user_id uuid NOT NULL,
				label text NOT NULL
			);
			ALTER TABLE public.user_packages ENABLE ROW LEVEL SECURITY;
			GRANT SELECT ON public.user_packages TO authenticated, service_role;
			CREATE POLICY user_packages_select ON public.user_packages
				FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
			INSERT INTO public.user_packages(id, auth_user_id, label) VALUES
				('31111111-1111-4111-8111-111111111111', '${ownUser}', 'own'),
				('32222222-2222-4222-8222-222222222222', '${otherUser}', 'other');
		`);
		const before = await client.query<{ oid: number }>(`
			SELECT policy.oid::integer AS oid
			FROM pg_catalog.pg_policy policy
			WHERE policy.polrelid = 'public.user_packages'::regclass
			  AND policy.polname = 'user_packages_select'
		`);
		originalPolicyOid = before.rows[0]?.oid ?? 0;
		await client.query(migrationSql);
	});

	it("preserves the policy identity and exact optimized contract", async () => {
		const contract = await query<{
			oid: number;
			command: string;
			permissive: boolean;
			roles: string[];
			usingSha256: string;
			policyCount: number;
		}>(`
			SELECT policy.oid::integer AS oid,
				CASE policy.polcmd WHEN 'r' THEN 'SELECT' ELSE policy.polcmd::text END AS command,
				policy.polpermissive AS permissive,
				ARRAY(SELECT role.rolname::text FROM pg_catalog.pg_roles role
					WHERE role.oid = ANY(policy.polroles) ORDER BY role.rolname)::text[] AS roles,
				pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
					pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
						policy.polqual, policy.polrelid
					), '\\s+', '', 'g'), 'UTF8'
				)), 'hex') AS "usingSha256",
				(SELECT count(*)::integer FROM pg_catalog.pg_policy sibling
					WHERE sibling.polrelid = policy.polrelid) AS "policyCount"
			FROM pg_catalog.pg_policy policy
			WHERE policy.polrelid = 'public.user_packages'::regclass
			  AND policy.polname = 'user_packages_select'
		`);
		expect(contract.rows).toEqual([{
			oid: originalPolicyOid,
			command: "SELECT",
			permissive: true,
			roles: ["authenticated"],
			usingSha256: expectedPostHash,
			policyCount: 1,
		}]);
	});

	it("keeps authenticated rows isolated and service role access intact", async () => {
		await query("SET ROLE authenticated");
		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownUser]);
		const ownRows = await query<{ label: string }>(
			"SELECT label FROM public.user_packages ORDER BY id",
		);
		expect(ownRows.rows).toEqual([{ label: "own" }]);

		await query("RESET ROLE");
		await query("SET ROLE service_role");
		const serviceRows = await query<{ label: string }>(
			"SELECT label FROM public.user_packages ORDER BY id",
		);
		expect(serviceRows.rows).toEqual([{ label: "own" }, { label: "other" }]);
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
