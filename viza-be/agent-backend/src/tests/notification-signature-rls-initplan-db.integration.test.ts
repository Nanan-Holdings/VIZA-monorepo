import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.NOTIFICATION_SIGNATURE_RLS_INITPLAN_DB_CONFIRM === "local-test";
const databaseUrl =
	process.env.NOTIFICATION_SIGNATURE_RLS_INITPLAN_DATABASE_URL ??
	process.env.DATABASE_URL ??
	"";
const marker = (process.env.NOTIFICATION_SIGNATURE_RLS_INITPLAN_DB_NONPRODUCTION ?? "").toLowerCase();
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
		new URL("../../drizzle/0173_notification_signature_rls_initplan.sql", import.meta.url),
	),
	"utf8",
);

const ownUser = "11111111-1111-4111-8111-111111111111";
const otherUser = "22222222-2222-4222-8222-222222222222";
const ownProfile = "31111111-1111-4111-8111-111111111111";
const otherProfile = "32222222-2222-4222-8222-222222222222";
const expectedPreHash = "25b1a1fe79d4578daaa9ce3a895db3195c732290aa4290acac2e212ea1967fad";
const expectedPostHash = "f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86";

let pool: Pool | undefined;
let client: PoolClient | undefined;
const originalPolicyOids = new Map<string, number>();

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("notification/signature RLS integration client is not initialized");
	return client.query<T>(sql, values);
};

describe.skipIf(!liveGateEnabled)("notification/signature RLS init-plan database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();
		const databaseMarker = await client.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing notification/signature RLS integration DDL: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
			);
		}

		await client.query("BEGIN");
		await client.query("SET LOCAL search_path TO public, extensions");
		const collisions = await client.query<{ relation: string; present: string | null }>(`
			SELECT relation, pg_catalog.to_regclass('public.' || relation)::text AS present
			FROM pg_catalog.unnest(ARRAY[
				'applicant_profiles', 'notification_event_log', 'signature_event'
			]) relation
		`);
		const present = collisions.rows.filter((row) => row.present).map((row) => row.relation);
		if (present.length > 0) {
			throw new Error(`Refusing notification/signature RLS fixture setup: relations exist: ${present.join(", ")}`);
		}

		await client.query(`
			CREATE TABLE public.applicant_profiles (
				id uuid PRIMARY KEY,
				auth_user_id uuid NOT NULL UNIQUE
			);
			CREATE TABLE public.notification_event_log (
				id uuid PRIMARY KEY,
				applicant_id uuid NOT NULL REFERENCES public.applicant_profiles(id),
				label text NOT NULL
			);
			CREATE TABLE public.signature_event (
				id uuid PRIMARY KEY,
				applicant_id uuid NOT NULL REFERENCES public.applicant_profiles(id),
				label text NOT NULL
			);
			ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.notification_event_log ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.signature_event ENABLE ROW LEVEL SECURITY;
			GRANT SELECT ON public.applicant_profiles, public.notification_event_log, public.signature_event
				TO anon, authenticated, service_role;
			CREATE POLICY applicant_profiles_select_own ON public.applicant_profiles
				FOR SELECT TO authenticated USING (auth_user_id = (select auth.uid()));
			CREATE POLICY notification_event_log_select_own ON public.notification_event_log
				FOR SELECT USING (applicant_id IN (
					SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
				));
			CREATE POLICY signature_event_select_own ON public.signature_event
				FOR SELECT USING (applicant_id IN (
					SELECT id FROM applicant_profiles WHERE auth_user_id = auth.uid()
				));
			INSERT INTO public.applicant_profiles(id, auth_user_id) VALUES
				('${ownProfile}', '${ownUser}'),
				('${otherProfile}', '${otherUser}');
			INSERT INTO public.notification_event_log(id, applicant_id, label) VALUES
				('41111111-1111-4111-8111-111111111111', '${ownProfile}', 'own-notification'),
				('42222222-2222-4222-8222-222222222222', '${otherProfile}', 'other-notification');
			INSERT INTO public.signature_event(id, applicant_id, label) VALUES
				('51111111-1111-4111-8111-111111111111', '${ownProfile}', 'own-signature'),
				('52222222-2222-4222-8222-222222222222', '${otherProfile}', 'other-signature');
		`);

		const before = await client.query<{ policy: string; oid: number; usingSha256: string }>(`
			SELECT policy.polname AS policy,
				policy.oid::integer AS oid,
				pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
					pg_catalog.regexp_replace(pg_catalog.pg_get_expr(
						policy.polqual, policy.polrelid
					), '\\s+', '', 'g'), 'UTF8'
				)), 'hex') AS "usingSha256"
			FROM pg_catalog.pg_policy policy
			WHERE policy.polrelid IN (
				'public.notification_event_log'::regclass,
				'public.signature_event'::regclass
			)
			ORDER BY policy.polname
		`);
		expect(before.rows).toHaveLength(2);
		for (const row of before.rows) {
			expect(row.usingSha256).toBe(expectedPreHash);
			originalPolicyOids.set(row.policy, row.oid);
		}
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
			checkSha256: string | null;
			policyCount: number;
			rlsEnabled: boolean;
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
				NULL::text AS "checkSha256",
				(SELECT count(*)::integer FROM pg_catalog.pg_policy sibling
					WHERE sibling.polrelid = policy.polrelid) AS "policyCount",
				relation.relrowsecurity AS "rlsEnabled"
			FROM pg_catalog.pg_policy policy
			JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
			WHERE policy.polrelid IN (
				'public.notification_event_log'::regclass,
				'public.signature_event'::regclass
			)
			ORDER BY relation.relname
		`);

		expect(contracts.rows).toHaveLength(2);
		expect(contracts.rows.map((row) => ({
			...row,
			oid: originalPolicyOids.get(row.policy),
		}))).toEqual(contracts.rows);
		for (const row of contracts.rows) {
			expect(row).toMatchObject({
				oid: originalPolicyOids.get(row.policy),
				command: "SELECT",
				permissive: true,
				roles: ["PUBLIC"],
				usingSha256: expectedPostHash,
				checkSha256: null,
				policyCount: 1,
				rlsEnabled: true,
			});
		}
	});

	it("keeps authenticated rows isolated, anon empty, and service role access intact", async () => {
		await query("SET ROLE authenticated");
		await query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownUser]);
		const ownNotifications = await query<{ label: string }>(
			"SELECT label FROM public.notification_event_log ORDER BY id",
		);
		const ownSignatures = await query<{ label: string }>(
			"SELECT label FROM public.signature_event ORDER BY id",
		);
		expect(ownNotifications.rows).toEqual([{ label: "own-notification" }]);
		expect(ownSignatures.rows).toEqual([{ label: "own-signature" }]);

		await query("RESET ROLE");
		await query("SET ROLE anon");
		const anonNotifications = await query("SELECT id FROM public.notification_event_log");
		const anonSignatures = await query("SELECT id FROM public.signature_event");
		expect(anonNotifications.rows).toEqual([]);
		expect(anonSignatures.rows).toEqual([]);

		await query("RESET ROLE");
		await query("SET ROLE service_role");
		const serviceNotifications = await query<{ label: string }>(
			"SELECT label FROM public.notification_event_log ORDER BY id",
		);
		const serviceSignatures = await query<{ label: string }>(
			"SELECT label FROM public.signature_event ORDER BY id",
		);
		expect(serviceNotifications.rows).toEqual([
			{ label: "own-notification" },
			{ label: "other-notification" },
		]);
		expect(serviceSignatures.rows).toEqual([
			{ label: "own-signature" },
			{ label: "other-signature" },
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
