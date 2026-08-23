import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.CONSENT_EVENT_RLS_INITPLAN_DB_CONFIRM === "local-test";
const databaseUrl =
	process.env.CONSENT_EVENT_RLS_INITPLAN_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.CONSENT_EVENT_RLS_INITPLAN_DB_NONPRODUCTION ?? "").toLowerCase();
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
	fileURLToPath(new URL("../../drizzle/0180_consent_event_rls_initplan.sql", import.meta.url)),
	"utf8",
);

const ownUser = "11111111-1111-4111-8111-111111111111";
const otherUser = "22222222-2222-4222-8222-222222222222";
const ownProfile = "31111111-1111-4111-8111-111111111111";
const otherProfile = "32222222-2222-4222-8222-222222222222";
const preHash = "91d4d5f1bd65562b9581892c345fa0b60d0dc1aa398f0b271e86338385060ac8";
const postHash = "71f1513bd40970f7d84c85ec82450b575df8915148b67210085a056186962975";

let pool: Pool | undefined;
let client: PoolClient | undefined;
let originalPolicyOid = 0;
let originalAcl = "";

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("consent-event RLS integration client is not initialized");
	return client.query<T>(sql, values);
};

describe.skipIf(!liveGateEnabled)("consent-event RLS init-plan database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();
		const databaseMarker = await client.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing consent-event RLS integration DDL: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
			);
		}

		await client.query("BEGIN");
		await client.query("SET LOCAL search_path TO public, extensions");
		const collisions = await client.query<{ relation: string; present: string | null }>(`
			SELECT relation, pg_catalog.to_regclass('public.' || relation)::text AS present
			FROM pg_catalog.unnest(ARRAY['applicant_profiles', 'consent_event']) relation
		`);
		const present = collisions.rows.filter((row) => row.present).map((row) => row.relation);
		if (present.length > 0) {
			throw new Error(`Refusing consent-event RLS fixture setup: relations exist: ${present.join(", ")}`);
		}

		await client.query(`
			CREATE TABLE public.applicant_profiles (
				id uuid PRIMARY KEY,
				auth_user_id uuid NOT NULL UNIQUE
			);
			CREATE TABLE public.consent_event (
				id uuid PRIMARY KEY,
				user_id uuid,
				applicant_id uuid REFERENCES public.applicant_profiles(id),
				label text NOT NULL
			);
			ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.consent_event ENABLE ROW LEVEL SECURITY;
			GRANT SELECT ON public.applicant_profiles, public.consent_event
				TO anon, authenticated, service_role;
			CREATE POLICY applicant_profiles_select_own ON public.applicant_profiles
				FOR SELECT TO authenticated USING (auth_user_id = (select auth.uid()));
			CREATE POLICY consent_event_select_own ON public.consent_event
				FOR SELECT USING (
					user_id = auth.uid()
					OR applicant_id IN (
						SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
					)
				);
			INSERT INTO public.applicant_profiles(id, auth_user_id) VALUES
				('${ownProfile}', '${ownUser}'),
				('${otherProfile}', '${otherUser}');
			INSERT INTO public.consent_event(id, user_id, applicant_id, label) VALUES
				('41111111-1111-4111-8111-111111111111', '${ownUser}', NULL, 'own-by-user'),
				('41222222-2222-4222-8222-222222222222', NULL, '${ownProfile}', 'own-by-profile'),
				('42111111-1111-4111-8111-111111111111', '${otherUser}', NULL, 'other-by-user'),
				('42222222-2222-4222-8222-222222222222', NULL, '${otherProfile}', 'other-by-profile'),
				('43333333-3333-4333-8333-333333333333', NULL, NULL, 'unowned');
		`);

		const before = await client.query<{ oid: number; usingSha256: string; acl: string }>(`
			SELECT policy.oid::integer AS oid,
				pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
					pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
						policy.polqual, policy.polrelid
					), '\\s+', '', 'g'), 'UTF8'
				)), 'hex') AS "usingSha256",
				relation.relacl::text AS acl
			FROM pg_catalog.pg_policy policy
			JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
			WHERE policy.polrelid = 'public.consent_event'::regclass
			  AND policy.polname = 'consent_event_select_own'
		`);
		expect(before.rows).toHaveLength(1);
		expect(before.rows[0]?.usingSha256).toBe(preHash);
		originalPolicyOid = before.rows[0]?.oid ?? 0;
		originalAcl = before.rows[0]?.acl ?? "";
		await client.query(migrationSql);
	});

	it("preserves policy identity and the exact production two-path contract", async () => {
		const contract = await query<{
			oid: number;
			command: string;
			permissive: boolean;
			roles: string[];
			usingSha256: string;
			policyCount: number;
			rlsEnabled: boolean;
			acl: string;
		}>(`
			SELECT policy.oid::integer AS oid,
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
			WHERE policy.polrelid = 'public.consent_event'::regclass
			  AND policy.polname = 'consent_event_select_own'
		`);
		expect(contract.rows).toEqual([
			expect.objectContaining({
				oid: originalPolicyOid,
				command: "SELECT",
				permissive: true,
				roles: ["PUBLIC"],
				usingSha256: postHash,
				policyCount: 1,
				rlsEnabled: true,
				acl: originalAcl,
			}),
		]);
	});

	it("keeps both authenticated ownership paths, anon denial, and service visibility", async () => {
		await query("SET ROLE authenticated");
		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownUser]);
		const owned = await query<{ label: string }>("SELECT label FROM public.consent_event ORDER BY id");
		expect(owned.rows.map((row) => row.label)).toEqual(["own-by-user", "own-by-profile"]);

		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [otherUser]);
		const otherOwned = await query<{ label: string }>(
			"SELECT label FROM public.consent_event ORDER BY id",
		);
		expect(otherOwned.rows.map((row) => row.label)).toEqual([
			"other-by-user",
			"other-by-profile",
		]);

		await query("RESET ROLE");
		await query("SELECT set_config('request.jwt.claim.sub', '', true)");
		await query("SET ROLE anon");
		expect((await query("SELECT id FROM public.consent_event")).rows).toEqual([]);

		await query("RESET ROLE");
		await query("SET ROLE service_role");
		const serviceCount = await query<{ count: string }>(
			"SELECT count(*)::text AS count FROM public.consent_event",
		);
		expect(serviceCount.rows[0]?.count).toBe("5");
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
