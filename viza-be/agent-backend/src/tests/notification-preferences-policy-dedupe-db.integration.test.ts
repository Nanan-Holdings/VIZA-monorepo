import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.NOTIFICATION_POLICY_DEDUPE_DB_CONFIRM === "local-test";
const databaseUrl =
	process.env.NOTIFICATION_POLICY_DEDUPE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.NOTIFICATION_POLICY_DEDUPE_DB_NONPRODUCTION ?? "").toLowerCase();
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
	new URL("../../drizzle/0183_notification_preferences_policy_dedupe.sql", import.meta.url),
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

const ownUser = "11111111-1111-4111-8111-111111111111";
const otherUser = "22222222-2222-4222-8222-222222222222";
const ownProfile = "31111111-1111-4111-8111-111111111111";
const otherProfile = "32222222-2222-4222-8222-222222222222";
const policyHash = "f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86";

let pool: Pool | undefined;
let client: PoolClient | undefined;
let selectPolicyOid = 0;
let upsertPolicyOid = 0;
let relationOid = 0;
let originalAcl = "";

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("notification policy dedupe client is not initialized");
	return client.query<T>(sql, values);
};

const readVisibleLabels = async () =>
	(await query<{ label: string }>(
		"SELECT label FROM public.notification_preferences ORDER BY id",
	)).rows;

describe.skipIf(!liveGateEnabled)("notification preferences policy deduplication database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();
		const markerResult = await client.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const environment = (markerResult.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(environment)) {
			throw new Error(
				`Refusing notification policy dedupe DDL: database marker ${environment || "<unset>"} is not local/test`,
			);
		}

		await client.query("BEGIN");
		await client.query("SET LOCAL search_path TO public, extensions");
		const collisions = await client.query<{ relation: string; present: string | null }>(`
			SELECT relation, pg_catalog.to_regclass('public.' || relation)::text AS present
			FROM pg_catalog.unnest(ARRAY['applicant_profiles', 'notification_preferences']) relation
		`);
		const present = collisions.rows.filter((row) => row.present).map((row) => row.relation);
		if (present.length > 0) {
			throw new Error(`Refusing notification policy fixture setup: relations exist: ${present.join(", ")}`);
		}

		await client.query(`
			CREATE TABLE public.applicant_profiles (
				id uuid PRIMARY KEY,
				auth_user_id uuid NOT NULL UNIQUE
			);
			CREATE TABLE public.notification_preferences (
				id uuid PRIMARY KEY,
				applicant_id uuid NOT NULL REFERENCES public.applicant_profiles(id),
				label text NOT NULL
			);
			ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
			GRANT SELECT ON public.applicant_profiles TO authenticated, service_role;
			GRANT ALL ON public.notification_preferences TO anon, authenticated, service_role;
			CREATE POLICY applicant_profiles_select_own ON public.applicant_profiles
				FOR SELECT TO authenticated USING (auth_user_id = (select auth.uid()));
			CREATE POLICY notification_preferences_select_own ON public.notification_preferences
				FOR SELECT USING (
					applicant_id IN (
						SELECT id FROM public.applicant_profiles
						WHERE auth_user_id = (select auth.uid())
					)
				);
			CREATE POLICY notification_preferences_upsert_own ON public.notification_preferences
				FOR ALL USING (
					applicant_id IN (
						SELECT id FROM public.applicant_profiles
						WHERE auth_user_id = (select auth.uid())
					)
				) WITH CHECK (
					applicant_id IN (
						SELECT id FROM public.applicant_profiles
						WHERE auth_user_id = (select auth.uid())
					)
				);
			INSERT INTO public.applicant_profiles(id, auth_user_id) VALUES
				('${ownProfile}', '${ownUser}'),
				('${otherProfile}', '${otherUser}');
			INSERT INTO public.notification_preferences(id, applicant_id, label) VALUES
				('41111111-1111-4111-8111-111111111111', '${ownProfile}', 'own-pref'),
				('42222222-2222-4222-8222-222222222222', '${otherProfile}', 'other-pref');
		`);

		const before = await client.query<{
			policyName: string;
			policyOid: number;
			relationOid: number;
			usingSha256: string;
			checkSha256: string | null;
			acl: string;
		}>(`
			SELECT policy.polname AS "policyName",
				policy.oid::integer AS "policyOid",
				relation.oid::integer AS "relationOid",
				pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
					pg_catalog.regexp_replace(pg_catalog.pg_get_expr(policy.polqual, policy.polrelid), '\\s+', '', 'g'), 'UTF8'
				)), 'hex') AS "usingSha256",
				pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
					pg_catalog.regexp_replace(pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid), '\\s+', '', 'g'), 'UTF8'
				)), 'hex') AS "checkSha256",
				relation.relacl::text AS acl
			FROM pg_catalog.pg_policy policy
			JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
			WHERE relation.relname = 'notification_preferences'
			ORDER BY policy.polname
		`);
		expect(before.rows).toHaveLength(2);
		for (const row of before.rows) {
			expect(row.usingSha256).toBe(policyHash);
			if (row.policyName === "notification_preferences_select_own") {
				selectPolicyOid = row.policyOid;
				expect(row.checkSha256).toBeNull();
			} else {
				upsertPolicyOid = row.policyOid;
				expect(row.checkSha256).toBe(policyHash);
			}
			relationOid = row.relationOid;
			originalAcl = row.acl;
		}

		await client.query("SET ROLE authenticated");
		await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownUser]);
		expect(await readVisibleLabels()).toEqual([{ label: "own-pref" }]);
		await client.query("RESET ROLE");
		await client.query(migrationSql);
	});

	it("removes only the redundant policy and preserves the ALL-policy identity and contract", async () => {
		const result = await query<{
			policyOid: number;
			relationOid: number;
			command: string;
			roles: string[];
			usingSha256: string;
			checkSha256: string;
			policyCount: number;
			rlsEnabled: boolean;
			rlsForced: boolean;
			acl: string;
		}>(`
			SELECT policy.oid::integer AS "policyOid",
				relation.oid::integer AS "relationOid",
				CASE policy.polcmd WHEN '*' THEN 'ALL' ELSE policy.polcmd::text END AS command,
				ARRAY(SELECT CASE WHEN role_oid = 0 THEN 'PUBLIC' ELSE role.rolname END
					FROM pg_catalog.unnest(policy.polroles) role_oid
					LEFT JOIN pg_catalog.pg_roles role ON role.oid = role_oid)::text[] AS roles,
				pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
					pg_catalog.regexp_replace(pg_catalog.pg_get_expr(policy.polqual, policy.polrelid), '\\s+', '', 'g'), 'UTF8'
				)), 'hex') AS "usingSha256",
				pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
					pg_catalog.regexp_replace(pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid), '\\s+', '', 'g'), 'UTF8'
				)), 'hex') AS "checkSha256",
				(SELECT pg_catalog.count(*)::integer FROM pg_catalog.pg_policy sibling
					WHERE sibling.polrelid = relation.oid) AS "policyCount",
				relation.relrowsecurity AS "rlsEnabled",
				relation.relforcerowsecurity AS "rlsForced",
				relation.relacl::text AS acl
			FROM pg_catalog.pg_policy policy
			JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
			WHERE relation.oid = $1 AND policy.polname = 'notification_preferences_upsert_own'
		`, [relationOid]);
		expect(result.rows).toEqual([expect.objectContaining({
			policyOid: upsertPolicyOid,
			relationOid,
			command: "ALL",
			roles: ["PUBLIC"],
			usingSha256: policyHash,
			checkSha256: policyHash,
			policyCount: 1,
			rlsEnabled: true,
			rlsForced: false,
			acl: originalAcl,
		})]);
		expect((await query("SELECT 1 FROM pg_catalog.pg_policy WHERE oid = $1", [selectPolicyOid])).rows).toEqual([]);
	});

	it("preserves A/B reads, own writes, cross-user denial, anon denial, and service visibility", async () => {
		await query("SET ROLE authenticated");
		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownUser]);
		expect(await readVisibleLabels()).toEqual([{ label: "own-pref" }]);
		expect((await query("UPDATE public.notification_preferences SET label='own-updated' WHERE applicant_id=$1", [ownProfile])).rowCount).toBe(1);
		expect((await query("UPDATE public.notification_preferences SET label='other-updated' WHERE applicant_id=$1", [otherProfile])).rowCount).toBe(0);

		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [otherUser]);
		expect(await readVisibleLabels()).toEqual([{ label: "other-pref" }]);
		await query("RESET ROLE");
		await query("SELECT set_config('request.jwt.claim.sub', '', true)");
		await query("SET ROLE anon");
		expect(await readVisibleLabels()).toEqual([]);
		await query("RESET ROLE");
		await query("SET ROLE service_role");
		expect((await query<{ count: string }>("SELECT pg_catalog.count(*)::text AS count FROM public.notification_preferences")).rows).toEqual([{ count: "2" }]);
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
