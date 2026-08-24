import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.APPLICANT_SINGLE_PATH_RLS_INITPLAN_DB_CONFIRM === "local-test";
const databaseUrl =
	process.env.APPLICANT_SINGLE_PATH_RLS_INITPLAN_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.APPLICANT_SINGLE_PATH_RLS_INITPLAN_DB_NONPRODUCTION ?? "").toLowerCase();
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
		new URL("../../drizzle/0181_applicant_single_path_rls_initplan.sql", import.meta.url),
	),
	"utf8",
);

const ownUser = "11111111-1111-4111-8111-111111111111";
const otherUser = "22222222-2222-4222-8222-222222222222";
const ownProfile = "31111111-1111-4111-8111-111111111111";
const otherProfile = "32222222-2222-4222-8222-222222222222";
const preHash = "25b1a1fe79d4578daaa9ce3a895db3195c732290aa4290acac2e212ea1967fad";
const postHash = "f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86";

const expectedPolicies = [
	["applicant_secret", "applicant_secret_select_own", "SELECT", postHash, null],
	["notification_preferences", "notification_preferences_select_own", "SELECT", postHash, null],
	["notification_preferences", "notification_preferences_upsert_own", "ALL", postHash, postHash],
	["staff_chat_thread", "staff_chat_thread_select_own", "SELECT", postHash, null],
] as const;

let pool: Pool | undefined;
let client: PoolClient | undefined;
const originalPolicyOids = new Map<string, number>();
const originalAcls = new Map<string, string>();

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("applicant single-path RLS integration client is not initialized");
	return client.query<T>(sql, values);
};

const expectStatementDenied = async (sql: string, values: unknown[] = []) => {
	await query("SAVEPOINT expected_denial");
	try {
		await query(sql, values);
		throw new Error("statement unexpectedly succeeded");
	} catch (error) {
		await query("ROLLBACK TO SAVEPOINT expected_denial");
		expect(error).toMatchObject({ code: "42501" });
	} finally {
		await query("RELEASE SAVEPOINT expected_denial");
	}
};

describe.skipIf(!liveGateEnabled)("applicant single-path RLS init-plan database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();
		const databaseMarker = await client.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing applicant single-path RLS integration DDL: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
			);
		}

		await client.query("BEGIN");
		await client.query("SET LOCAL search_path TO public, extensions");
		const collisions = await client.query<{ relation: string; present: string | null }>(`
			SELECT relation, pg_catalog.to_regclass('public.' || relation)::text AS present
			FROM pg_catalog.unnest(ARRAY[
				'applicant_profiles',
				'applicant_secret',
				'notification_preferences',
				'staff_chat_thread'
			]) relation
		`);
		const present = collisions.rows.filter((row) => row.present).map((row) => row.relation);
		if (present.length > 0) {
			throw new Error(
				`Refusing applicant single-path RLS fixture setup: relations exist: ${present.join(", ")}`,
			);
		}

		await client.query(`
			CREATE TABLE public.applicant_profiles (
				id uuid PRIMARY KEY,
				auth_user_id uuid NOT NULL UNIQUE
			);
			CREATE TABLE public.applicant_secret (
				id uuid PRIMARY KEY,
				applicant_id uuid NOT NULL REFERENCES public.applicant_profiles(id),
				label text NOT NULL
			);
			CREATE TABLE public.notification_preferences (
				id uuid PRIMARY KEY,
				applicant_id uuid NOT NULL REFERENCES public.applicant_profiles(id),
				label text NOT NULL
			);
			CREATE TABLE public.staff_chat_thread (
				id uuid PRIMARY KEY,
				applicant_id uuid NOT NULL REFERENCES public.applicant_profiles(id),
				label text NOT NULL
			);

			ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.applicant_secret ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.staff_chat_thread ENABLE ROW LEVEL SECURITY;

			GRANT SELECT ON public.applicant_profiles TO authenticated, service_role;
			GRANT ALL ON public.applicant_secret, public.notification_preferences, public.staff_chat_thread
				TO anon, authenticated, service_role;

			CREATE POLICY applicant_profiles_select_own ON public.applicant_profiles
				FOR SELECT TO authenticated USING (auth_user_id = (select auth.uid()));
			CREATE POLICY applicant_secret_select_own ON public.applicant_secret
				FOR SELECT USING (
					applicant_id IN (
						SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
					)
				);
			CREATE POLICY notification_preferences_select_own ON public.notification_preferences
				FOR SELECT USING (
					applicant_id IN (
						SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
					)
				);
			CREATE POLICY notification_preferences_upsert_own ON public.notification_preferences
				FOR ALL USING (
					applicant_id IN (
						SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
					)
				) WITH CHECK (
					applicant_id IN (
						SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
					)
				);
			CREATE POLICY staff_chat_thread_select_own ON public.staff_chat_thread
				FOR SELECT USING (
					applicant_id IN (
						SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
					)
				);

			INSERT INTO public.applicant_profiles(id, auth_user_id) VALUES
				('${ownProfile}', '${ownUser}'),
				('${otherProfile}', '${otherUser}');
			INSERT INTO public.applicant_secret(id, applicant_id, label) VALUES
				('41111111-1111-4111-8111-111111111111', '${ownProfile}', 'own-secret'),
				('42222222-2222-4222-8222-222222222222', '${otherProfile}', 'other-secret');
			INSERT INTO public.notification_preferences(id, applicant_id, label) VALUES
				('51111111-1111-4111-8111-111111111111', '${ownProfile}', 'own-pref'),
				('52222222-2222-4222-8222-222222222222', '${otherProfile}', 'other-pref');
			INSERT INTO public.staff_chat_thread(id, applicant_id, label) VALUES
				('61111111-1111-4111-8111-111111111111', '${ownProfile}', 'own-thread'),
				('62222222-2222-4222-8222-222222222222', '${otherProfile}', 'other-thread');
		`);

		const before = await client.query<{
			tableName: string;
			policyName: string;
			oid: number;
			usingSha256: string | null;
			checkSha256: string | null;
			acl: string;
		}>(`
			SELECT relation.relname AS "tableName",
				policy.polname AS "policyName",
				policy.oid::integer AS oid,
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
				relation.relacl::text AS acl
			FROM pg_catalog.pg_policy policy
			JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
			WHERE relation.relname = ANY(ARRAY[
				'applicant_secret', 'notification_preferences', 'staff_chat_thread'
			])
			ORDER BY relation.relname, policy.polname
		`);
		expect(before.rows).toHaveLength(4);
		for (const row of before.rows) {
			expect(row.usingSha256 ?? row.checkSha256).toBe(preHash);
			originalPolicyOids.set(`${row.tableName}.${row.policyName}`, row.oid);
			originalAcls.set(row.tableName, row.acl);
		}

		await client.query(migrationSql);
	});

	it("preserves policy identities, roles, commands, RLS state, counts, and ACLs", async () => {
		const contracts = await query<{
			tableName: string;
			policyName: string;
			oid: number;
			command: string;
			permissive: boolean;
			roles: string[];
			usingSha256: string | null;
			checkSha256: string | null;
			policyCount: number;
			rlsEnabled: boolean;
			rlsForced: boolean;
			acl: string;
		}>(`
			SELECT relation.relname AS "tableName",
				policy.polname AS "policyName",
				policy.oid::integer AS oid,
				CASE policy.polcmd
					WHEN 'r' THEN 'SELECT'
					WHEN '*' THEN 'ALL'
					ELSE policy.polcmd::text
				END AS command,
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
			WHERE relation.relname = ANY(ARRAY[
				'applicant_secret', 'notification_preferences', 'staff_chat_thread'
			])
			ORDER BY relation.relname, policy.polname
		`);

		expect(contracts.rows).toHaveLength(expectedPolicies.length);
		for (const [tableName, policyName, command, usingSha256, checkSha256] of expectedPolicies) {
			const row = contracts.rows.find(
				(candidate) => candidate.tableName === tableName && candidate.policyName === policyName,
			);
			expect(row).toEqual(
				expect.objectContaining({
					oid: originalPolicyOids.get(`${tableName}.${policyName}`),
					command,
					permissive: true,
					roles: ["PUBLIC"],
					usingSha256,
					checkSha256,
					policyCount: tableName === "notification_preferences" ? 2 : 1,
					rlsEnabled: true,
					rlsForced: false,
					acl: originalAcls.get(tableName),
				}),
			);
		}
	});

	it("preserves authenticated ownership and notification write checks", async () => {
		await query("SET ROLE authenticated");
		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownUser]);

		for (const tableName of [
			"applicant_secret",
			"notification_preferences",
			"staff_chat_thread",
		]) {
			const rows = await query<{ label: string }>(`SELECT label FROM public.${tableName} ORDER BY id`);
			expect(rows.rows).toEqual([{ label: expect.stringMatching(/^own-/) }]);
		}

		await query(
			"INSERT INTO public.notification_preferences(id, applicant_id, label) VALUES ($1, $2, $3)",
			["53333333-3333-4333-8333-333333333333", ownProfile, "own-insert"],
		);
		await expectStatementDenied(
			"INSERT INTO public.notification_preferences(id, applicant_id, label) VALUES ($1, $2, $3)",
			["54444444-4444-4444-8444-444444444444", otherProfile, "other-insert"],
		);
		const ownUpdate = await query(
			"UPDATE public.notification_preferences SET label = 'own-updated' WHERE applicant_id = $1",
			[ownProfile],
		);
		expect(ownUpdate.rowCount).toBe(2);
		const otherUpdate = await query(
			"UPDATE public.notification_preferences SET label = 'other-updated' WHERE applicant_id = $1",
			[otherProfile],
		);
		expect(otherUpdate.rowCount).toBe(0);

		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [otherUser]);
		const otherRows = await query<{ label: string }>(
			"SELECT label FROM public.notification_preferences ORDER BY id",
		);
		expect(otherRows.rows).toEqual([{ label: "other-pref" }]);
	});

	it("keeps anonymous callers denied by RLS and service-role visibility unchanged", async () => {
		await query("RESET ROLE");
		await query("SELECT set_config('request.jwt.claim.sub', '', true)");
		await query("SET ROLE anon");
		expect((await query("SELECT id FROM public.applicant_secret")).rows).toEqual([]);
		expect((await query("SELECT id FROM public.notification_preferences")).rows).toEqual([]);
		expect((await query("SELECT id FROM public.staff_chat_thread")).rows).toEqual([]);

		await query("RESET ROLE");
		await query("SET ROLE service_role");
		for (const tableName of [
			"applicant_secret",
			"notification_preferences",
			"staff_chat_thread",
		]) {
			const result = await query<{ count: string }>(
				`SELECT pg_catalog.count(*)::text AS count FROM public.${tableName}`,
			);
			expect(Number(result.rows[0]?.count ?? "0")).toBeGreaterThanOrEqual(2);
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
