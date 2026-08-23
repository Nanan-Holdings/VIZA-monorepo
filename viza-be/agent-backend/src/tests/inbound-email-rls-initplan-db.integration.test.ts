import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.INBOUND_EMAIL_RLS_INITPLAN_DB_CONFIRM === "local-test";
const databaseUrl =
	process.env.INBOUND_EMAIL_RLS_INITPLAN_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.INBOUND_EMAIL_RLS_INITPLAN_DB_NONPRODUCTION ?? "").toLowerCase();
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
	fileURLToPath(new URL("../../drizzle/0174_inbound_email_rls_initplan.sql", import.meta.url)),
	"utf8",
);

const ownUser = "11111111-1111-4111-8111-111111111111";
const otherUser = "22222222-2222-4222-8222-222222222222";
const ownProfile = "31111111-1111-4111-8111-111111111111";
const retiredProfile = "31222222-2222-4222-8222-222222222222";
const otherProfile = "32222222-2222-4222-8222-222222222222";
const expectedPreHash = "53620884b11312437e65785cdc5445b1ed50036f0fcdb2b096db2502288786c6";
const expectedPostHash = "ecb33803f6cb8934051ad83203bedb9a0d5421a5f7114329c219f0d2093460c8";

let pool: Pool | undefined;
let client: PoolClient | undefined;
let originalPolicyOid = 0;
let originalAcl = "";

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("inbound-email RLS integration client is not initialized");
	return client.query<T>(sql, values);
};

describe.skipIf(!liveGateEnabled)("inbound-email RLS init-plan database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();
		const databaseMarker = await client.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing inbound-email RLS integration DDL: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
			);
		}

		await client.query("BEGIN");
		await client.query("SET LOCAL search_path TO public, extensions");
		const collisions = await client.query<{ relation: string; present: string | null }>(`
			SELECT relation, pg_catalog.to_regclass('public.' || relation)::text AS present
			FROM pg_catalog.unnest(ARRAY['applicant_profiles', 'inbound_email']) relation
		`);
		const present = collisions.rows.filter((row) => row.present).map((row) => row.relation);
		if (present.length > 0) {
			throw new Error(`Refusing inbound-email RLS fixture setup: relations exist: ${present.join(", ")}`);
		}

		await client.query(`
			CREATE TABLE public.applicant_profiles (
				id uuid PRIMARY KEY,
				auth_user_id uuid NOT NULL,
				inbox_alias text,
				inbox_alias_retired_at timestamptz
			);
			CREATE TABLE public.inbound_email (
				id uuid PRIMARY KEY,
				to_addr text NOT NULL,
				quarantined boolean NOT NULL DEFAULT false,
				label text NOT NULL
			);
			ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.inbound_email ENABLE ROW LEVEL SECURITY;
			GRANT SELECT ON public.applicant_profiles, public.inbound_email TO anon, authenticated, service_role;
			CREATE POLICY applicant_profiles_select_own ON public.applicant_profiles
				FOR SELECT TO authenticated USING (auth_user_id = (select auth.uid()));
			CREATE POLICY inbound_email_select_owning_applicant ON public.inbound_email
				FOR SELECT USING (
					quarantined = FALSE
					AND LOWER(to_addr) IN (
						SELECT LOWER(inbox_alias)
						FROM applicant_profiles
						WHERE auth_user_id = auth.uid()
							AND inbox_alias IS NOT NULL
							AND inbox_alias_retired_at IS NULL
					)
				);
			INSERT INTO public.applicant_profiles(id, auth_user_id, inbox_alias, inbox_alias_retired_at) VALUES
				('${ownProfile}', '${ownUser}', 'own@viza.it.com', NULL),
				('${retiredProfile}', '${ownUser}', 'retired@viza.it.com', clock_timestamp()),
				('${otherProfile}', '${otherUser}', 'other@viza.it.com', NULL);
			INSERT INTO public.inbound_email(id, to_addr, quarantined, label) VALUES
				('41111111-1111-4111-8111-111111111111', 'own@viza.it.com', false, 'own-active'),
				('41222222-2222-4222-8222-222222222222', 'own@viza.it.com', true, 'own-quarantined'),
				('41333333-3333-4333-8333-333333333333', 'retired@viza.it.com', false, 'own-retired'),
				('42222222-2222-4222-8222-222222222222', 'other@viza.it.com', false, 'other-active');
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
			WHERE policy.polrelid = 'public.inbound_email'::regclass
				AND policy.polname = 'inbound_email_select_owning_applicant'
		`);
		expect(before.rows).toHaveLength(1);
		expect(before.rows[0]?.usingSha256).toBe(expectedPreHash);
		originalPolicyOid = before.rows[0]?.oid ?? 0;
		originalAcl = before.rows[0]?.acl ?? "";
		await client.query(migrationSql);
	});

	it("preserves policy identity and the exact optimized contract", async () => {
		const contract = await query<{
			oid: number;
			command: string;
			permissive: boolean;
			roles: string[];
			usingSha256: string;
			checkSha256: string | null;
			policyCount: number;
			rlsEnabled: boolean;
			forceRls: boolean;
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
				NULL::text AS "checkSha256",
				(SELECT count(*)::integer FROM pg_catalog.pg_policy sibling
					WHERE sibling.polrelid = policy.polrelid) AS "policyCount",
				relation.relrowsecurity AS "rlsEnabled",
				relation.relforcerowsecurity AS "forceRls",
				relation.relacl::text AS acl
			FROM pg_catalog.pg_policy policy
			JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
			WHERE policy.polrelid = 'public.inbound_email'::regclass
				AND policy.polname = 'inbound_email_select_owning_applicant'
		`);

		expect(contract.rows).toEqual([
			expect.objectContaining({
				oid: originalPolicyOid,
				command: "SELECT",
				permissive: true,
				roles: ["PUBLIC"],
				usingSha256: expectedPostHash,
				checkSha256: null,
				policyCount: 1,
				rlsEnabled: true,
				forceRls: false,
				acl: originalAcl,
			}),
		]);
	});

	it("keeps active owners isolated while quarantine, retirement, anon, and service behavior stay intact", async () => {
		await query("SET ROLE authenticated");
		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownUser]);
		const ownRows = await query<{ label: string }>(
			"SELECT label FROM public.inbound_email ORDER BY id",
		);
		expect(ownRows.rows).toEqual([{ label: "own-active" }]);

		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [otherUser]);
		const otherRows = await query<{ label: string }>(
			"SELECT label FROM public.inbound_email ORDER BY id",
		);
		expect(otherRows.rows).toEqual([{ label: "other-active" }]);

		await query("RESET ROLE");
		await query("SET ROLE anon");
		const anonRows = await query("SELECT id FROM public.inbound_email");
		expect(anonRows.rows).toEqual([]);

		await query("RESET ROLE");
		await query("SET ROLE service_role");
		const serviceRows = await query<{ label: string }>(
			"SELECT label FROM public.inbound_email ORDER BY id",
		);
		expect(serviceRows.rows.map((row) => row.label)).toEqual([
			"own-active",
			"own-quarantined",
			"own-retired",
			"other-active",
		]);
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
