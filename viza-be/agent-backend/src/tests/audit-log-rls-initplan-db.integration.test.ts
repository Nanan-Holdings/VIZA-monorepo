import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.AUDIT_LOG_RLS_INITPLAN_DB_CONFIRM === "local-test";
const databaseUrl =
	process.env.AUDIT_LOG_RLS_INITPLAN_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.AUDIT_LOG_RLS_INITPLAN_DB_NONPRODUCTION ?? "").toLowerCase();
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
	fileURLToPath(new URL("../../drizzle/0177_audit_log_rls_initplan.sql", import.meta.url)),
	"utf8",
);

const ownUser = "11111111-1111-4111-8111-111111111111";
const otherUser = "22222222-2222-4222-8222-222222222222";
const ownProfile = "31111111-1111-4111-8111-111111111111";
const otherProfile = "32222222-2222-4222-8222-222222222222";
const ownerPolicyPreHash = "25b1a1fe79d4578daaa9ce3a895db3195c732290aa4290acac2e212ea1967fad";
const ownerPolicyPostHash = "f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86";

let pool: Pool | undefined;
let client: PoolClient | undefined;
const originalPolicyOids = new Map<string, number>();
const originalAcls = new Map<string, string>();
const preHashes = new Map<string, string>();
const postHashes = new Map<string, string>();

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("audit-log RLS integration client is not initialized");
	return client.query<T>(sql, values);
};

describe.skipIf(!liveGateEnabled)("audit-log RLS init-plan database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();
		const databaseMarker = await client.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing audit-log RLS integration DDL: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
			);
		}

		await client.query("BEGIN");
		await client.query("SET LOCAL search_path TO public, extensions");
		const collisions = await client.query<{ relation: string; present: string | null }>(`
			SELECT relation, pg_catalog.to_regclass('public.' || relation)::text AS present
			FROM pg_catalog.unnest(ARRAY[
				'applicant_profiles', 'secret_access_log', 'pii_access_log'
			]) relation
		`);
		const present = collisions.rows.filter((row) => row.present).map((row) => row.relation);
		if (present.length > 0) {
			throw new Error(`Refusing audit-log RLS fixture setup: relations exist: ${present.join(", ")}`);
		}

		await client.query(`
			CREATE TABLE public.applicant_profiles (
				id uuid PRIMARY KEY,
				auth_user_id uuid NOT NULL UNIQUE
			);
			CREATE TABLE public.secret_access_log (
				id uuid PRIMARY KEY,
				applicant_id uuid NOT NULL REFERENCES public.applicant_profiles(id),
				label text NOT NULL
			);
			CREATE TABLE public.pii_access_log (
				id uuid PRIMARY KEY,
				applicant_id uuid NOT NULL REFERENCES public.applicant_profiles(id),
				label text NOT NULL
			);
			ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.secret_access_log ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.pii_access_log ENABLE ROW LEVEL SECURITY;
			GRANT SELECT ON public.applicant_profiles, public.secret_access_log, public.pii_access_log
				TO anon, authenticated, service_role;
			CREATE POLICY applicant_profiles_select_own ON public.applicant_profiles
				FOR SELECT TO authenticated USING (auth_user_id = (select auth.uid()));
			CREATE POLICY secret_access_log_select_own ON public.secret_access_log
				FOR SELECT USING (applicant_id IN (
					SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
				));
			CREATE POLICY pii_access_log_select_own ON public.pii_access_log
				FOR SELECT USING (applicant_id IN (
					SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
				));
			INSERT INTO public.applicant_profiles(id, auth_user_id) VALUES
				('${ownProfile}', '${ownUser}'),
				('${otherProfile}', '${otherUser}');
			INSERT INTO public.secret_access_log(id, applicant_id, label) VALUES
				('41111111-1111-4111-8111-111111111111', '${ownProfile}', 'own-secret'),
				('42222222-2222-4222-8222-222222222222', '${otherProfile}', 'other-secret');
			INSERT INTO public.pii_access_log(id, applicant_id, label) VALUES
				('51111111-1111-4111-8111-111111111111', '${ownProfile}', 'own-pii'),
				('52222222-2222-4222-8222-222222222222', '${otherProfile}', 'other-pii');
		`);

		const before = await client.query<{
			tableName: string;
			policy: string;
			oid: number;
			usingSha256: string;
			acl: string;
		}>(`
			SELECT relation.relname AS "tableName",
				policy.polname AS policy,
				policy.oid::integer AS oid,
				pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
					pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
						policy.polqual, policy.polrelid
					), '\\s+', '', 'g'), 'UTF8'
				)), 'hex') AS "usingSha256",
				relation.relacl::text AS acl
			FROM pg_catalog.pg_policy policy
			JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
			WHERE policy.polrelid IN (
				'public.secret_access_log'::regclass,
				'public.pii_access_log'::regclass
			)
			ORDER BY relation.relname
		`);
		expect(before.rows).toHaveLength(2);
		for (const row of before.rows) {
			originalPolicyOids.set(row.policy, row.oid);
			originalAcls.set(row.tableName, row.acl);
			preHashes.set(row.policy, row.usingSha256);
			expect(row.usingSha256).toBe(ownerPolicyPreHash);
		}
		expect(new Set(preHashes.values())).toEqual(new Set([ownerPolicyPreHash]));
		await client.query(migrationSql);
	});

	it("preserves both policy identities and exact optimized contracts", async () => {
		const contracts = await query<{
			tableName: string;
			policy: string;
			oid: number;
			command: string;
			permissive: boolean;
			roles: string[];
			usingSha256: string;
			policyCount: number;
			rlsEnabled: boolean;
			acl: string;
		}>(`
			SELECT relation.relname AS "tableName",
				policy.polname AS policy,
				policy.oid::integer AS oid,
				CASE policy.polcmd WHEN 'r' THEN 'SELECT' ELSE policy.polcmd::text END AS command,
				policy.polpermissive AS permissive,
				ARRAY(
					SELECT CASE WHEN role_oid = 0 THEN 'PUBLIC' ELSE role.rolname END
					FROM pg_catalog.unnest(policy.polroles) role_oid
					LEFT JOIN pg_catalog.pg_roles role ON role.oid = role_oid
					ORDER BY CASE WHEN role_oid = 0 THEN 'PUBLIC' ELSE role.rolname END
				)::text[] AS roles,
				pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
					pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
						policy.polqual, policy.polrelid
					), '\\s+', '', 'g'), 'UTF8'
				)), 'hex') AS "usingSha256",
				(SELECT count(*)::integer FROM pg_catalog.pg_policy sibling
					WHERE sibling.polrelid = policy.polrelid) AS "policyCount",
				relation.relrowsecurity AS "rlsEnabled",
				relation.relacl::text AS acl
			FROM pg_catalog.pg_policy policy
			JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
			WHERE policy.polrelid IN (
				'public.secret_access_log'::regclass,
				'public.pii_access_log'::regclass
			)
			ORDER BY relation.relname
		`);

		expect(contracts.rows).toHaveLength(2);
		for (const row of contracts.rows) {
			expect(row).toMatchObject({
				oid: originalPolicyOids.get(row.policy),
				command: "SELECT",
				permissive: true,
				roles: ["PUBLIC"],
				policyCount: 1,
				rlsEnabled: true,
				acl: originalAcls.get(row.tableName),
				usingSha256: ownerPolicyPostHash,
			});
			postHashes.set(row.policy, row.usingSha256);
			expect(row.usingSha256).not.toBe(preHashes.get(row.policy));
		}
		expect(new Set(postHashes.values())).toEqual(new Set([ownerPolicyPostHash]));
	});

	it("keeps authenticated ownership, anon denial, and service-role visibility unchanged", async () => {
		await query("SET ROLE authenticated");
		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownUser]);
		const ownSecret = await query<{ label: string }>("SELECT label FROM public.secret_access_log ORDER BY id");
		const ownPii = await query<{ label: string }>("SELECT label FROM public.pii_access_log ORDER BY id");
		expect(ownSecret.rows).toEqual([{ label: "own-secret" }]);
		expect(ownPii.rows).toEqual([{ label: "own-pii" }]);

		await query("RESET ROLE");
		await query("SELECT set_config('request.jwt.claim.sub', '', true)");
		await query("SET ROLE anon");
		for (const table of ["secret_access_log", "pii_access_log"]) {
			const rows = await query(`SELECT id FROM public.${table}`);
			expect(rows.rows).toEqual([]);
		}

		await query("RESET ROLE");
		await query("SET ROLE service_role");
		for (const [table, count] of [
			["secret_access_log", 2],
			["pii_access_log", 2],
		] as const) {
			const rows = await query<{ count: string }>(`SELECT count(*)::text AS count FROM public.${table}`);
			expect(rows.rows[0]?.count).toBe(String(count));
		}
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
