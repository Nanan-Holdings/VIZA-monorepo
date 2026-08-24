import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.CHAT_RLS_INITPLAN_DB_CONFIRM === "local-test";
const databaseUrl = process.env.CHAT_RLS_INITPLAN_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.CHAT_RLS_INITPLAN_DB_NONPRODUCTION ?? "").toLowerCase();
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
	fileURLToPath(new URL("../../drizzle/0170_chat_rls_initplan.sql", import.meta.url)),
	"utf8",
);

const ownUser = "11111111-1111-4111-8111-111111111111";
const otherUser = "22222222-2222-4222-8222-222222222222";
const ownProfile = "31111111-1111-4111-8111-111111111111";
const otherProfile = "32222222-2222-4222-8222-222222222222";
const ownVisaSession = "41111111-1111-4111-8111-111111111111";
const otherVisaSession = "42222222-2222-4222-8222-222222222222";

const targetPolicies = [
	"travel_agent_messages_owner_all",
	"travel_agent_sessions_owner_all",
	"travel_user_preferences_owner_all",
	"user_chat_sessions_select",
	"visa_chat_messages_insert_own",
	"visa_chat_messages_select_own",
	"visa_chat_sessions_insert_own",
	"visa_chat_sessions_select_own",
	"visa_chat_sessions_update_own",
] as const;

const expectedPostMigrationHashes: Record<string, [string | null, string | null]> = {
	travel_agent_messages_owner_all: ["067f2b9c489a616b20dba2a5a889efaf0c73212fd91d16a91767f32a164c6ef3", "067f2b9c489a616b20dba2a5a889efaf0c73212fd91d16a91767f32a164c6ef3"],
	travel_agent_sessions_owner_all: ["2606e408bcb49adc658d735a3e8ffc44dbe639cc0e1976217b3ce768832e7e05", "2606e408bcb49adc658d735a3e8ffc44dbe639cc0e1976217b3ce768832e7e05"],
	travel_user_preferences_owner_all: ["f9f3c147a6d0b8944a388095875c6bb0636aff04869517aaf7bb9efc0dbf8ec1", "f9f3c147a6d0b8944a388095875c6bb0636aff04869517aaf7bb9efc0dbf8ec1"],
	user_chat_sessions_select: ["2be57c38df7ccb57585e26e8063a9915959f6814c740ec2f581dd7830759c312", null],
	visa_chat_messages_insert_own: [null, "7d4586bde32e08a4267f4282fe7a0bd3e2971beee3b8809298df68955de27b03"],
	visa_chat_messages_select_own: ["7d4586bde32e08a4267f4282fe7a0bd3e2971beee3b8809298df68955de27b03", null],
	visa_chat_sessions_insert_own: [null, "f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86"],
	visa_chat_sessions_select_own: ["f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86", null],
	visa_chat_sessions_update_own: ["f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86", "f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86"],
};

let pool: Pool | undefined;
let client: PoolClient | undefined;
let originalPolicyOids: Record<string, number> = {};
let servicePolicyOid = 0;

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("chat RLS init-plan integration client is not initialized");
	return client.query<T>(sql, values);
};

async function expectRlsDenied(sql: string, values: unknown[] = []) {
	await query("SAVEPOINT expected_rls_denial");
	await expect(query(sql, values)).rejects.toMatchObject({ code: "42501" });
	await query("ROLLBACK TO SAVEPOINT expected_rls_denial");
}

describe.skipIf(!liveGateEnabled)("chat RLS init-plan database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();
		const databaseMarker = await client.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing chat RLS integration DDL: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
			);
		}

		await client.query("BEGIN");
		const collisions = await client.query<{ identity: string }>(`
			SELECT identity
			FROM (VALUES
				('public.applicant_profiles'),
				('public.travel_agent_sessions'),
				('public.travel_agent_messages'),
				('public.travel_user_preferences'),
				('public.user_chat_sessions'),
				('public.visa_chat_sessions'),
				('public.visa_chat_messages')
			) expected(identity)
			WHERE pg_catalog.to_regclass(identity) IS NOT NULL
		`);
		if (collisions.rowCount) {
			throw new Error("Refusing chat RLS fixture setup: target public tables already exist");
		}

		await client.query(`
			CREATE TABLE public.applicant_profiles (
				id uuid PRIMARY KEY,
				auth_user_id uuid NOT NULL
			);
			CREATE TABLE public.travel_agent_sessions (
				id uuid PRIMARY KEY,
				user_id uuid NOT NULL,
				label text NOT NULL DEFAULT ''
			);
			CREATE TABLE public.travel_agent_messages (
				id uuid PRIMARY KEY,
				user_id uuid NOT NULL,
				label text NOT NULL DEFAULT ''
			);
			CREATE TABLE public.travel_user_preferences (
				id uuid PRIMARY KEY,
				user_id uuid NOT NULL,
				label text NOT NULL DEFAULT ''
			);
			CREATE TABLE public.user_chat_sessions (
				id uuid PRIMARY KEY,
				auth_user_id uuid NOT NULL
			);
			CREATE TABLE public.visa_chat_sessions (
				id uuid PRIMARY KEY,
				applicant_id uuid NOT NULL,
				label text NOT NULL DEFAULT ''
			);
			CREATE TABLE public.visa_chat_messages (
				id uuid PRIMARY KEY,
				session_id uuid NOT NULL,
				label text NOT NULL DEFAULT ''
			);

			ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.travel_agent_sessions ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.travel_agent_messages ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.travel_user_preferences ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.user_chat_sessions ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.visa_chat_sessions ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.visa_chat_messages ENABLE ROW LEVEL SECURITY;

			GRANT SELECT ON public.applicant_profiles TO authenticated;
			GRANT SELECT, INSERT, UPDATE, DELETE ON
				public.travel_agent_sessions,
				public.travel_agent_messages,
				public.travel_user_preferences
				TO authenticated;
			GRANT SELECT ON public.user_chat_sessions TO authenticated;
			GRANT SELECT, INSERT, UPDATE ON public.visa_chat_sessions TO authenticated;
			GRANT SELECT, INSERT ON public.visa_chat_messages TO authenticated;

			CREATE POLICY applicant_profiles_select_own ON public.applicant_profiles
				FOR SELECT TO authenticated USING (auth_user_id = (select auth.uid()));

			CREATE POLICY travel_agent_sessions_owner_all ON public.travel_agent_sessions
				FOR ALL TO authenticated
				USING (EXISTS (
					SELECT 1 FROM public.applicant_profiles
					WHERE applicant_profiles.id = travel_agent_sessions.user_id
						AND applicant_profiles.auth_user_id = auth.uid()
				))
				WITH CHECK (EXISTS (
					SELECT 1 FROM public.applicant_profiles
					WHERE applicant_profiles.id = travel_agent_sessions.user_id
						AND applicant_profiles.auth_user_id = auth.uid()
				));
			CREATE POLICY travel_agent_messages_owner_all ON public.travel_agent_messages
				FOR ALL TO authenticated
				USING (EXISTS (
					SELECT 1 FROM public.applicant_profiles
					WHERE applicant_profiles.id = travel_agent_messages.user_id
						AND applicant_profiles.auth_user_id = auth.uid()
				))
				WITH CHECK (EXISTS (
					SELECT 1 FROM public.applicant_profiles
					WHERE applicant_profiles.id = travel_agent_messages.user_id
						AND applicant_profiles.auth_user_id = auth.uid()
				));
			CREATE POLICY travel_user_preferences_owner_all ON public.travel_user_preferences
				FOR ALL TO authenticated
				USING (EXISTS (
					SELECT 1 FROM public.applicant_profiles
					WHERE applicant_profiles.id = travel_user_preferences.user_id
						AND applicant_profiles.auth_user_id = auth.uid()
				))
				WITH CHECK (EXISTS (
					SELECT 1 FROM public.applicant_profiles
					WHERE applicant_profiles.id = travel_user_preferences.user_id
						AND applicant_profiles.auth_user_id = auth.uid()
				));

			CREATE POLICY user_chat_sessions_select ON public.user_chat_sessions
				FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
			CREATE POLICY user_chat_sessions_service ON public.user_chat_sessions
				FOR ALL TO service_role USING (true);

			CREATE POLICY visa_chat_sessions_select_own ON public.visa_chat_sessions
				FOR SELECT TO authenticated USING (applicant_id IN (
					SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
				));
			CREATE POLICY visa_chat_sessions_insert_own ON public.visa_chat_sessions
				FOR INSERT TO authenticated WITH CHECK (applicant_id IN (
					SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
				));
			CREATE POLICY visa_chat_sessions_update_own ON public.visa_chat_sessions
				FOR UPDATE TO authenticated
				USING (applicant_id IN (
					SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
				))
				WITH CHECK (applicant_id IN (
					SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
				));

			CREATE POLICY visa_chat_messages_select_own ON public.visa_chat_messages
				FOR SELECT TO authenticated USING (session_id IN (
					SELECT vcs.id FROM public.visa_chat_sessions vcs
					JOIN public.applicant_profiles ap ON ap.id = vcs.applicant_id
					WHERE ap.auth_user_id = auth.uid()
				));
			CREATE POLICY visa_chat_messages_insert_own ON public.visa_chat_messages
				FOR INSERT TO authenticated WITH CHECK (session_id IN (
					SELECT vcs.id FROM public.visa_chat_sessions vcs
					JOIN public.applicant_profiles ap ON ap.id = vcs.applicant_id
					WHERE ap.auth_user_id = auth.uid()
				));

			INSERT INTO public.applicant_profiles(id, auth_user_id) VALUES
				('${ownProfile}', '${ownUser}'),
				('${otherProfile}', '${otherUser}');
			INSERT INTO public.travel_agent_sessions(id, user_id, label) VALUES
				('51111111-1111-4111-8111-111111111111', '${ownProfile}', 'own'),
				('52222222-2222-4222-8222-222222222222', '${otherProfile}', 'other');
			INSERT INTO public.travel_agent_messages(id, user_id, label) VALUES
				('61111111-1111-4111-8111-111111111111', '${ownProfile}', 'own'),
				('62222222-2222-4222-8222-222222222222', '${otherProfile}', 'other');
			INSERT INTO public.travel_user_preferences(id, user_id, label) VALUES
				('71111111-1111-4111-8111-111111111111', '${ownProfile}', 'own'),
				('72222222-2222-4222-8222-222222222222', '${otherProfile}', 'other');
			INSERT INTO public.user_chat_sessions(id, auth_user_id) VALUES
				('81111111-1111-4111-8111-111111111111', '${ownUser}'),
				('82222222-2222-4222-8222-222222222222', '${otherUser}');
			INSERT INTO public.visa_chat_sessions(id, applicant_id, label) VALUES
				('${ownVisaSession}', '${ownProfile}', 'own'),
				('${otherVisaSession}', '${otherProfile}', 'other');
			INSERT INTO public.visa_chat_messages(id, session_id, label) VALUES
				('91111111-1111-4111-8111-111111111111', '${ownVisaSession}', 'own'),
				('92222222-2222-4222-8222-222222222222', '${otherVisaSession}', 'other');
		`);

		const policies = await client.query<{ name: string; oid: number }>(`
			SELECT policy.polname AS name, policy.oid::integer AS oid
			FROM pg_catalog.pg_policy policy
			WHERE policy.polname = ANY($1::text[])
		`, [targetPolicies]);
		originalPolicyOids = Object.fromEntries(policies.rows.map((row) => [row.name, row.oid]));
		const servicePolicy = await client.query<{ oid: number }>(`
			SELECT policy.oid::integer AS oid
			FROM pg_catalog.pg_policy policy
			WHERE policy.polname = 'user_chat_sessions_service'
		`);
		servicePolicyOid = servicePolicy.rows[0]?.oid ?? 0;

		await client.query(migrationSql);
		await client.query("SET ROLE authenticated");
		await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownUser]);
	});

	it("preserves policy identities and the service-role policy", async () => {
		const policies = await query<{
			name: string;
			oid: number;
			expression: string;
			usingSha256: string | null;
			checkSha256: string | null;
		}>(`
			SELECT policy.polname AS name,
				policy.oid::integer AS oid,
				concat_ws(' ',
					pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
					pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
				) AS expression,
				CASE WHEN policy.polqual IS NULL THEN NULL ELSE
					pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
						pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
							policy.polqual, policy.polrelid
						), '\\s+', '', 'g'), 'UTF8'
					)), 'hex')
				END AS "usingSha256",
				CASE WHEN policy.polwithcheck IS NULL THEN NULL ELSE
					pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
						pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
							policy.polwithcheck, policy.polrelid
						), '\\s+', '', 'g'), 'UTF8'
					)), 'hex')
				END AS "checkSha256"
			FROM pg_catalog.pg_policy policy
			WHERE policy.polname = ANY($1::text[])
			ORDER BY policy.polname
		`, [targetPolicies]);
		expect(policies.rows).toHaveLength(9);
		for (const policy of policies.rows) {
			expect(policy.oid).toBe(originalPolicyOids[policy.name]);
			expect(policy.expression).toMatch(/SELECT auth\.uid\(\)/i);
			expect([policy.usingSha256, policy.checkSha256]).toEqual(
				expectedPostMigrationHashes[policy.name],
			);
		}

		const servicePolicy = await query<{ oid: number; expression: string }>(`
			SELECT policy.oid::integer AS oid,
				pg_catalog.pg_get_expr(policy.polqual, policy.polrelid) AS expression
			FROM pg_catalog.pg_policy policy
			WHERE policy.polname = 'user_chat_sessions_service'
		`);
		expect(servicePolicy.rows).toEqual([{ oid: servicePolicyOid, expression: "true" }]);
	});

	it("keeps chat and travel rows isolated to their authenticated owner", async () => {
		for (const table of [
			"travel_agent_sessions",
			"travel_agent_messages",
			"travel_user_preferences",
			"user_chat_sessions",
			"visa_chat_sessions",
			"visa_chat_messages",
		]) {
			const rows = await query<{ label?: string }>(
				`SELECT * FROM public.${table} ORDER BY id`,
			);
			expect(rows.rowCount).toBe(1);
			if (table !== "user_chat_sessions") expect(rows.rows[0]?.label).toBe("own");
		}

		for (const [table, ownId, otherId] of [
			["travel_agent_sessions", "51111111-1111-4111-8111-111111111111", "52222222-2222-4222-8222-222222222222"],
			["travel_agent_messages", "61111111-1111-4111-8111-111111111111", "62222222-2222-4222-8222-222222222222"],
			["travel_user_preferences", "71111111-1111-4111-8111-111111111111", "72222222-2222-4222-8222-222222222222"],
		] as const) {
			await expectRlsDenied(
				`UPDATE public.${table} SET user_id = $1 WHERE id = $2`,
				[otherProfile, ownId],
			);
			const hiddenUpdate = await query<{ id: string }>(
				`UPDATE public.${table} SET label = 'blocked' WHERE id = $1 RETURNING id`,
				[otherId],
			);
			expect(hiddenUpdate.rows).toEqual([]);
			const hiddenDelete = await query<{ id: string }>(
				`DELETE FROM public.${table} WHERE id = $1 RETURNING id`,
				[otherId],
			);
			expect(hiddenDelete.rows).toEqual([]);
		}
		await expectRlsDenied(
			"UPDATE public.visa_chat_sessions SET applicant_id = $1 WHERE id = $2",
			[otherProfile, ownVisaSession],
		);
	});

	it("keeps insert checks exact for travel, visa sessions, and visa messages", async () => {
		for (const [table, ownId, otherId] of [
			["travel_agent_sessions", "a1111111-1111-4111-8111-111111111111", "a2222222-2222-4222-8222-222222222222"],
			["travel_agent_messages", "d1111111-1111-4111-8111-111111111111", "d2222222-2222-4222-8222-222222222222"],
			["travel_user_preferences", "e1111111-1111-4111-8111-111111111111", "e2222222-2222-4222-8222-222222222222"],
		] as const) {
			await query(
				`INSERT INTO public.${table}(id, user_id) VALUES ($1, $2)`,
				[ownId, ownProfile],
			);
			await expectRlsDenied(
				`INSERT INTO public.${table}(id, user_id) VALUES ($1, $2)`,
				[otherId, otherProfile],
			);
		}
		await query(
			"INSERT INTO public.visa_chat_sessions(id, applicant_id) VALUES ($1, $2)",
			["b1111111-1111-4111-8111-111111111111", ownProfile],
		);
		await expectRlsDenied(
			"INSERT INTO public.visa_chat_sessions(id, applicant_id) VALUES ($1, $2)",
			["b2222222-2222-4222-8222-222222222222", otherProfile],
		);
		await query(
			"INSERT INTO public.visa_chat_messages(id, session_id) VALUES ($1, $2)",
			["c1111111-1111-4111-8111-111111111111", ownVisaSession],
		);
		await expectRlsDenied(
			"INSERT INTO public.visa_chat_messages(id, session_id) VALUES ($1, $2)",
			["c2222222-2222-4222-8222-222222222222", otherVisaSession],
		);
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
