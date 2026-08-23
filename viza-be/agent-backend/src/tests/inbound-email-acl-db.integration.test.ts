import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.INBOUND_EMAIL_ACL_DB_CONFIRM === "local-test";
const databaseUrl = process.env.INBOUND_EMAIL_ACL_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.INBOUND_EMAIL_ACL_DB_NONPRODUCTION ?? "").toLowerCase();
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
	fileURLToPath(new URL("../../drizzle/0176_inbound_email_acl.sql", import.meta.url)),
	"utf8",
);

const ownUser = "11111111-1111-4111-8111-111111111111";
const otherUser = "22222222-2222-4222-8222-222222222222";
let pool: Pool | undefined;
let client: PoolClient | undefined;
let policyOid = 0;
let policyHash = "";

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("inbound-email ACL integration client is not initialized");
	return client.query<T>(sql, values);
};

describe.skipIf(!liveGateEnabled)("inbound-email ACL database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();
		const databaseMarker = await client.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing inbound-email ACL integration DDL: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
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
			throw new Error(`Refusing inbound-email ACL fixture setup: relations exist: ${present.join(", ")}`);
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
			GRANT SELECT ON public.applicant_profiles TO authenticated, service_role;
			GRANT ALL ON public.inbound_email TO anon, authenticated, service_role;
			CREATE POLICY applicant_profiles_select_own ON public.applicant_profiles
				FOR SELECT TO authenticated USING (auth_user_id = (select auth.uid()));
			CREATE POLICY inbound_email_select_owning_applicant ON public.inbound_email
				FOR SELECT USING (
					quarantined = FALSE
					AND LOWER(to_addr) IN (
						SELECT LOWER(inbox_alias)
						FROM public.applicant_profiles
						WHERE auth_user_id = (select auth.uid())
							AND inbox_alias IS NOT NULL
							AND inbox_alias_retired_at IS NULL
					)
				);
			INSERT INTO public.applicant_profiles(id, auth_user_id, inbox_alias, inbox_alias_retired_at) VALUES
				('31111111-1111-4111-8111-111111111111', '${ownUser}', 'own@viza.it.com', NULL),
				('32222222-2222-4222-8222-222222222222', '${otherUser}', 'other@viza.it.com', NULL);
			INSERT INTO public.inbound_email(id, to_addr, quarantined, label) VALUES
				('41111111-1111-4111-8111-111111111111', 'own@viza.it.com', false, 'own-active'),
				('41222222-2222-4222-8222-222222222222', 'own@viza.it.com', true, 'own-quarantined'),
				('42222222-2222-4222-8222-222222222222', 'other@viza.it.com', false, 'other-active');
		`);

		const before = await client.query<{ oid: number; policyHash: string }>(`
			SELECT policy.oid::integer AS oid,
				pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
					pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
						policy.polqual, policy.polrelid
					), '\\s+', '', 'g'), 'UTF8'
				)), 'hex') AS "policyHash"
			FROM pg_catalog.pg_policy policy
			WHERE policy.polrelid = 'public.inbound_email'::regclass
				AND policy.polname = 'inbound_email_select_owning_applicant'
		`);
		expect(before.rows).toHaveLength(1);
		policyOid = before.rows[0]?.oid ?? 0;
		policyHash = before.rows[0]?.policyHash ?? "";
		await client.query(migrationSql);
	});

	it("installs the exact least-privilege table ACL and preserves the policy", async () => {
		const privileges = await query<{ role: string; privilege: string }>(`
			SELECT CASE WHEN acl.grantee = 0 THEN 'PUBLIC'
				ELSE pg_catalog.pg_get_userbyid(acl.grantee) END AS role,
				acl.privilege_type AS privilege
			FROM pg_catalog.pg_class relation
			CROSS JOIN LATERAL pg_catalog.aclexplode(
				COALESCE(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
			) acl
			WHERE relation.oid = 'public.inbound_email'::regclass
				AND (acl.grantee = 0 OR pg_catalog.pg_get_userbyid(acl.grantee)
					IN ('anon', 'authenticated', 'service_role'))
			ORDER BY role, privilege
		`);
		expect(privileges.rows.filter((row) => row.role === "PUBLIC")).toEqual([]);
		expect(privileges.rows.filter((row) => row.role === "anon")).toEqual([]);
		expect(privileges.rows.filter((row) => row.role === "authenticated")).toEqual([
			{ role: "authenticated", privilege: "SELECT" },
		]);
		expect(privileges.rows.filter((row) => row.role === "service_role")).toHaveLength(7);

		const after = await query<{ oid: number; policyHash: string; policyCount: number }>(`
			SELECT policy.oid::integer AS oid,
				pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
					pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
						policy.polqual, policy.polrelid
					), '\\s+', '', 'g'), 'UTF8'
				)), 'hex') AS "policyHash",
				(SELECT count(*)::integer FROM pg_catalog.pg_policy sibling
					WHERE sibling.polrelid = policy.polrelid) AS "policyCount"
			FROM pg_catalog.pg_policy policy
			WHERE policy.polrelid = 'public.inbound_email'::regclass
				AND policy.polname = 'inbound_email_select_owning_applicant'
		`);
		expect(after.rows).toEqual([{ oid: policyOid, policyHash, policyCount: 1 }]);
	});

	it("keeps authenticated ownership reads and service operations while denying anonymous access", async () => {
		await query("SET ROLE authenticated");
		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownUser]);
		const ownRows = await query<{ label: string }>(
			"SELECT label FROM public.inbound_email ORDER BY id",
		);
		expect(ownRows.rows).toEqual([{ label: "own-active" }]);
		await query("SAVEPOINT authenticated_write_denied");
		await expect(query("DELETE FROM public.inbound_email WHERE false")).rejects.toMatchObject({
			code: "42501",
		});
		await query("ROLLBACK TO SAVEPOINT authenticated_write_denied");

		await query("RESET ROLE");
		await query("SET ROLE anon");
		await query("SAVEPOINT anonymous_read_denied");
		await expect(query("SELECT id FROM public.inbound_email")).rejects.toMatchObject({
			code: "42501",
		});
		await query("ROLLBACK TO SAVEPOINT anonymous_read_denied");

		await query("RESET ROLE");
		await query("SET ROLE service_role");
		const serviceRows = await query<{ label: string }>(
			"SELECT label FROM public.inbound_email ORDER BY id",
		);
		expect(serviceRows.rows.map((row) => row.label)).toEqual([
			"own-active",
			"own-quarantined",
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
