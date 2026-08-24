import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.SUPPORTING_DOC_RLS_INITPLAN_DB_CONFIRM === "local-test";
const databaseUrl =
	process.env.SUPPORTING_DOC_RLS_INITPLAN_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.SUPPORTING_DOC_RLS_INITPLAN_DB_NONPRODUCTION ?? "").toLowerCase();
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
const migrationPath = fileURLToPath(
	new URL("../../drizzle/0182_supporting_doc_submission_rls_initplan.sql", import.meta.url),
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

const ownUser = "11111111-1111-4111-8111-111111111111";
const otherUser = "22222222-2222-4222-8222-222222222222";
const ownProfile = "31111111-1111-4111-8111-111111111111";
const otherProfile = "32222222-2222-4222-8222-222222222222";
const ownApplication = "41111111-1111-4111-8111-111111111111";
const otherApplication = "42222222-2222-4222-8222-222222222222";
const preHash = "0c1f144a5f4ed2d63e7cbe75cbdee0a425444763f84353d8dde8fb9a7a3ad6d4";
const postHash = "8c0df2ed0556d31617abbdee9ca003d8346949fafa4e18a3a49f94fa98f4e7f5";

let pool: Pool | undefined;
let client: PoolClient | undefined;
let originalPolicyOid = 0;
let originalRelationOid = 0;
let originalAcl = "";

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("supporting-document RLS integration client is not initialized");
	return client.query<T>(sql, values);
};

describe.skipIf(!liveGateEnabled)("supporting-document submission RLS init-plan database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();
		const databaseMarker = await client.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing supporting-document RLS integration DDL: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
			);
		}

		await client.query("BEGIN");
		await client.query("SET LOCAL search_path TO public, extensions");
		const collisions = await client.query<{ relation: string; present: string | null }>(`
			SELECT relation, pg_catalog.to_regclass('public.' || relation)::text AS present
			FROM pg_catalog.unnest(ARRAY[
				'applicant_profiles', 'applications', 'supporting_doc_submission'
			]) relation
		`);
		const present = collisions.rows.filter((row) => row.present).map((row) => row.relation);
		if (present.length > 0) {
			throw new Error(
				`Refusing supporting-document RLS fixture setup: relations exist: ${present.join(", ")}`,
			);
		}

		await client.query(`
			CREATE TABLE public.applicant_profiles (
				id uuid PRIMARY KEY,
				auth_user_id uuid NOT NULL UNIQUE
			);
			CREATE TABLE public.applications (
				id uuid PRIMARY KEY,
				applicant_id uuid NOT NULL REFERENCES public.applicant_profiles(id)
			);
			CREATE TABLE public.supporting_doc_submission (
				id uuid PRIMARY KEY,
				application_id uuid NOT NULL REFERENCES public.applications(id),
				label text NOT NULL
			);

			ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.supporting_doc_submission ENABLE ROW LEVEL SECURITY;

			GRANT SELECT ON public.applicant_profiles, public.applications TO authenticated, service_role;
			GRANT ALL ON public.supporting_doc_submission TO anon, authenticated, service_role;

			CREATE POLICY applicant_profiles_select_own ON public.applicant_profiles
				FOR SELECT TO authenticated USING (auth_user_id = (select auth.uid()));
			CREATE POLICY applications_select_own ON public.applications
				FOR SELECT TO authenticated USING (
					applicant_id IN (
						SELECT id FROM public.applicant_profiles
						WHERE auth_user_id = (select auth.uid())
					)
				);
			CREATE POLICY supporting_doc_submission_select_own ON public.supporting_doc_submission
				FOR SELECT USING (
					application_id IN (
						SELECT a.id FROM applications a
						JOIN applicant_profiles p ON p.id = a.applicant_id
						WHERE p.auth_user_id = auth.uid()
					)
				);

			INSERT INTO public.applicant_profiles(id, auth_user_id) VALUES
				('${ownProfile}', '${ownUser}'),
				('${otherProfile}', '${otherUser}');
			INSERT INTO public.applications(id, applicant_id) VALUES
				('${ownApplication}', '${ownProfile}'),
				('${otherApplication}', '${otherProfile}');
			INSERT INTO public.supporting_doc_submission(id, application_id, label) VALUES
				('51111111-1111-4111-8111-111111111111', '${ownApplication}', 'own-document'),
				('52222222-2222-4222-8222-222222222222', '${otherApplication}', 'other-document');
		`);

		const before = await client.query<{
			policyOid: number;
			relationOid: number;
			usingSha256: string;
			acl: string;
		}>(`
			SELECT policy.oid::integer AS "policyOid",
				relation.oid::integer AS "relationOid",
				pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
					pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
						policy.polqual, policy.polrelid
					), '\\s+', '', 'g'), 'UTF8'
				)), 'hex') AS "usingSha256",
				relation.relacl::text AS acl
			FROM pg_catalog.pg_policy policy
			JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
			JOIN pg_catalog.pg_namespace schema_ref ON schema_ref.oid = relation.relnamespace
			WHERE schema_ref.nspname = 'public'
				AND relation.relname = 'supporting_doc_submission'
				AND policy.polname = 'supporting_doc_submission_select_own'
		`);
		expect(before.rows).toHaveLength(1);
		expect(before.rows[0]?.usingSha256).toBe(preHash);
		originalPolicyOid = before.rows[0]?.policyOid ?? 0;
		originalRelationOid = before.rows[0]?.relationOid ?? 0;
		originalAcl = before.rows[0]?.acl ?? "";

		await client.query(migrationSql);
	});

	it("preserves policy and relation identities, ACL, RLS, role, command, and count", async () => {
		const result = await query<{
			policyOid: number;
			relationOid: number;
			command: string;
			permissive: boolean;
			roles: string[];
			usingSha256: string;
			checkSha256: string | null;
			policyCount: number;
			rlsEnabled: boolean;
			rlsForced: boolean;
			acl: string;
		}>(`
			SELECT policy.oid::integer AS "policyOid",
				relation.oid::integer AS "relationOid",
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
				pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
					pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
						policy.polwithcheck, policy.polrelid
					), '\\s+', '', 'g'), 'UTF8'
				)), 'hex') AS "checkSha256",
				(SELECT pg_catalog.count(*)::integer FROM pg_catalog.pg_policy sibling
					WHERE sibling.polrelid = relation.oid) AS "policyCount",
				relation.relrowsecurity AS "rlsEnabled",
				relation.relforcerowsecurity AS "rlsForced",
				relation.relacl::text AS acl
			FROM pg_catalog.pg_policy policy
			JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
			WHERE relation.oid = $1 AND policy.polname = 'supporting_doc_submission_select_own'
		`, [originalRelationOid]);
		expect(result.rows).toEqual([
			expect.objectContaining({
				policyOid: originalPolicyOid,
				relationOid: originalRelationOid,
				command: "SELECT",
				permissive: true,
				roles: ["PUBLIC"],
				usingSha256: postHash,
				checkSha256: null,
				policyCount: 1,
				rlsEnabled: true,
				rlsForced: false,
				acl: originalAcl,
			}),
		]);
	});

	it("preserves authenticated A/B ownership and anonymous denial", async () => {
		await query("SET ROLE authenticated");
		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownUser]);
		expect((await query<{ label: string }>(
			"SELECT label FROM public.supporting_doc_submission ORDER BY id",
		)).rows).toEqual([{ label: "own-document" }]);

		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [otherUser]);
		expect((await query<{ label: string }>(
			"SELECT label FROM public.supporting_doc_submission ORDER BY id",
		)).rows).toEqual([{ label: "other-document" }]);

		await query("RESET ROLE");
		await query("SELECT set_config('request.jwt.claim.sub', '', true)");
		await query("SET ROLE anon");
		expect((await query("SELECT id FROM public.supporting_doc_submission")).rows).toEqual([]);
	});

	it("keeps service-role visibility unchanged", async () => {
		await query("RESET ROLE");
		await query("SET ROLE service_role");
		const result = await query<{ count: string }>(
			"SELECT pg_catalog.count(*)::text AS count FROM public.supporting_doc_submission",
		);
		expect(result.rows).toEqual([{ count: "2" }]);
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
