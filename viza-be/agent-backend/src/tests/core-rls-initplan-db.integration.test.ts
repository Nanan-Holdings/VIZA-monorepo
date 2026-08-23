import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.CORE_RLS_INITPLAN_DB_CONFIRM === "local-test";
const databaseUrl = process.env.CORE_RLS_INITPLAN_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.CORE_RLS_INITPLAN_DB_NONPRODUCTION ?? "").toLowerCase();
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
	fileURLToPath(new URL("../../drizzle/0168_core_rls_initplan.sql", import.meta.url)),
	"utf8",
);

const ownUser = "11111111-1111-4111-8111-111111111111";
const otherUser = "22222222-2222-4222-8222-222222222222";
const ownProfile = "31111111-1111-4111-8111-111111111111";
const otherProfile = "32222222-2222-4222-8222-222222222222";
const ownApplication = "41111111-1111-4111-8111-111111111111";
const otherApplication = "42222222-2222-4222-8222-222222222222";
const ownDocument = "51111111-1111-4111-8111-111111111111";
const otherDocument = "52222222-2222-4222-8222-222222222222";

const expectedPostMigrationHashes: Record<string, [string | null, string | null]> = {
	applicant_profiles_insert_own: [null, "395001fc5fa67b0b0a69cf3aecfd369149ddef1a8c00eb6268fd895330eb2b6b"],
	applicant_profiles_select_own: ["395001fc5fa67b0b0a69cf3aecfd369149ddef1a8c00eb6268fd895330eb2b6b", null],
	applicant_profiles_update_own: ["395001fc5fa67b0b0a69cf3aecfd369149ddef1a8c00eb6268fd895330eb2b6b", "395001fc5fa67b0b0a69cf3aecfd369149ddef1a8c00eb6268fd895330eb2b6b"],
	application_documents_delete_own: ["bf2366686b415d0aed45d3f473b698f5323e1c4be0c548f5365c4d495ea86a2a", null],
	application_documents_insert_own: [null, "bf2366686b415d0aed45d3f473b698f5323e1c4be0c548f5365c4d495ea86a2a"],
	application_documents_select_own: ["bf2366686b415d0aed45d3f473b698f5323e1c4be0c548f5365c4d495ea86a2a", null],
	application_documents_update_own: ["bf2366686b415d0aed45d3f473b698f5323e1c4be0c548f5365c4d495ea86a2a", "bf2366686b415d0aed45d3f473b698f5323e1c4be0c548f5365c4d495ea86a2a"],
	applications_insert_own: [null, "f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86"],
	applications_select_own: ["f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86", null],
	applications_update_own: ["f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86", "f4e3e33d2585cbb579e477f7f118f0b5b80ac10bea6a0dbb5fa875089f38aa86"],
	submission_queue_insert_own: [null, "bf2366686b415d0aed45d3f473b698f5323e1c4be0c548f5365c4d495ea86a2a"],
};

let pool: Pool | undefined;
let client: PoolClient | undefined;
let originalPolicyOids: Record<string, number> = {};

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
) => {
	if (!client) throw new Error("core RLS init-plan integration client is not initialized");
	return client.query<T>(sql, values);
};

async function expectRlsDenied(sql: string, values: unknown[] = []) {
	await query("SAVEPOINT expected_rls_denial");
	await expect(query(sql, values)).rejects.toMatchObject({ code: "42501" });
	await query("ROLLBACK TO SAVEPOINT expected_rls_denial");
}

describe.skipIf(!liveGateEnabled)("core RLS init-plan database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
		client = await pool.connect();
		const databaseMarker = await client.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing core RLS integration DDL: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
			);
		}

		await client.query("BEGIN");
		const collisions = await client.query<{ identity: string }>(`
			SELECT identity
			FROM (VALUES
				('public.applicant_profiles'),
				('public.applications'),
				('public.application_documents'),
				('public.submission_queue')
			) expected(identity)
			WHERE pg_catalog.to_regclass(identity) IS NOT NULL
		`);
		if (collisions.rowCount) {
			throw new Error("Refusing core RLS fixture setup: target public tables already exist");
		}

		await client.query(`
			CREATE TABLE public.applicant_profiles (
				id uuid PRIMARY KEY,
				auth_user_id uuid NOT NULL
			);
			CREATE TABLE public.applications (
				id uuid PRIMARY KEY,
				applicant_id uuid NOT NULL REFERENCES public.applicant_profiles(id),
				label text NOT NULL DEFAULT ''
			);
			CREATE TABLE public.application_documents (
				id uuid PRIMARY KEY,
				application_id uuid NOT NULL REFERENCES public.applications(id),
				label text NOT NULL DEFAULT ''
			);
			CREATE TABLE public.submission_queue (
				id uuid PRIMARY KEY,
				application_id uuid NOT NULL REFERENCES public.applications(id)
			);
			ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
			ALTER TABLE public.submission_queue ENABLE ROW LEVEL SECURITY;
			GRANT SELECT, INSERT, UPDATE ON public.applicant_profiles TO authenticated;
			GRANT SELECT, INSERT, UPDATE ON public.applications TO authenticated;
			GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_documents TO authenticated;
			GRANT INSERT ON public.submission_queue TO authenticated;

			CREATE POLICY applicant_profiles_select_own ON public.applicant_profiles
				FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
			CREATE POLICY applicant_profiles_insert_own ON public.applicant_profiles
				FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
			CREATE POLICY applicant_profiles_update_own ON public.applicant_profiles
				FOR UPDATE TO authenticated
				USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

			CREATE POLICY applications_select_own ON public.applications
				FOR SELECT TO authenticated USING (applicant_id IN (
					SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
				));
			CREATE POLICY applications_insert_own ON public.applications
				FOR INSERT TO authenticated WITH CHECK (applicant_id IN (
					SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
				));
			CREATE POLICY applications_update_own ON public.applications
				FOR UPDATE TO authenticated
				USING (applicant_id IN (
					SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
				))
				WITH CHECK (applicant_id IN (
					SELECT id FROM public.applicant_profiles WHERE auth_user_id = auth.uid()
				));

			CREATE POLICY application_documents_select_own ON public.application_documents
				FOR SELECT TO authenticated USING (application_id IN (
					SELECT a.id FROM public.applications a
					JOIN public.applicant_profiles ap ON ap.id = a.applicant_id
					WHERE ap.auth_user_id = auth.uid()
				));
			CREATE POLICY application_documents_insert_own ON public.application_documents
				FOR INSERT TO authenticated WITH CHECK (application_id IN (
					SELECT a.id FROM public.applications a
					JOIN public.applicant_profiles ap ON ap.id = a.applicant_id
					WHERE ap.auth_user_id = auth.uid()
				));
			CREATE POLICY application_documents_update_own ON public.application_documents
				FOR UPDATE TO authenticated
				USING (application_id IN (
					SELECT a.id FROM public.applications a
					JOIN public.applicant_profiles ap ON ap.id = a.applicant_id
					WHERE ap.auth_user_id = auth.uid()
				))
				WITH CHECK (application_id IN (
					SELECT a.id FROM public.applications a
					JOIN public.applicant_profiles ap ON ap.id = a.applicant_id
					WHERE ap.auth_user_id = auth.uid()
				));
			CREATE POLICY application_documents_delete_own ON public.application_documents
				FOR DELETE TO authenticated USING (application_id IN (
					SELECT a.id FROM public.applications a
					JOIN public.applicant_profiles ap ON ap.id = a.applicant_id
					WHERE ap.auth_user_id = auth.uid()
				));

			CREATE POLICY submission_queue_insert_own ON public.submission_queue
				FOR INSERT TO authenticated WITH CHECK (application_id IN (
					SELECT a.id FROM public.applications a
					JOIN public.applicant_profiles ap ON ap.id = a.applicant_id
					WHERE ap.auth_user_id = auth.uid()
				));

			INSERT INTO public.applicant_profiles(id, auth_user_id) VALUES
				('${ownProfile}', '${ownUser}'),
				('${otherProfile}', '${otherUser}');
			INSERT INTO public.applications(id, applicant_id, label) VALUES
				('${ownApplication}', '${ownProfile}', 'own'),
				('${otherApplication}', '${otherProfile}', 'other');
			INSERT INTO public.application_documents(id, application_id, label) VALUES
				('${ownDocument}', '${ownApplication}', 'own'),
				('${otherDocument}', '${otherApplication}', 'other');
		`);

		const policies = await client.query<{ name: string; oid: number }>(`
			SELECT policy.polname AS name, policy.oid::integer AS oid
			FROM pg_catalog.pg_policy policy
			JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
			JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
			WHERE namespace.nspname = 'public'
				AND relation.relname IN (
					'applicant_profiles', 'applications', 'application_documents', 'submission_queue'
				)
		`);
		originalPolicyOids = Object.fromEntries(policies.rows.map((row) => [row.name, row.oid]));
		await client.query(migrationSql);
		await client.query("SET ROLE authenticated");
		await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownUser]);
	});

	it("preserves all policy identities and replaces per-row auth calls with init plans", async () => {
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
			JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
			JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
			WHERE namespace.nspname = 'public'
				AND relation.relname IN (
					'applicant_profiles', 'applications', 'application_documents', 'submission_queue'
				)
			ORDER BY policy.polname
		`);
		expect(policies.rows).toHaveLength(11);
		for (const policy of policies.rows) {
			expect(policy.oid).toBe(originalPolicyOids[policy.name]);
			expect(policy.expression).toMatch(/SELECT auth\.uid\(\)/i);
			expect([policy.usingSha256, policy.checkSha256]).toEqual(
				expectedPostMigrationHashes[policy.name],
			);
		}
	});

	it("keeps own-row visibility and mutation while hiding other applicants", async () => {
		const profiles = await query<{ id: string }>("SELECT id FROM public.applicant_profiles");
		expect(profiles.rows.map(({ id }) => id)).toEqual([ownProfile]);

		const applications = await query<{ id: string }>("SELECT id FROM public.applications");
		expect(applications.rows.map(({ id }) => id)).toEqual([ownApplication]);

		const documents = await query<{ id: string }>("SELECT id FROM public.application_documents");
		expect(documents.rows.map(({ id }) => id)).toEqual([ownDocument]);

		const ownUpdate = await query<{ id: string }>(
			"UPDATE public.applications SET label = 'updated' WHERE id = $1 RETURNING id",
			[ownApplication],
		);
		expect(ownUpdate.rows).toEqual([{ id: ownApplication }]);
		const otherUpdate = await query<{ id: string }>(
			"UPDATE public.applications SET label = 'blocked' WHERE id = $1 RETURNING id",
			[otherApplication],
		);
		expect(otherUpdate.rows).toEqual([]);
		await expectRlsDenied(
			"UPDATE public.applicant_profiles SET auth_user_id = $1 WHERE id = $2",
			[otherUser, ownProfile],
		);
		await expectRlsDenied(
			"UPDATE public.applications SET applicant_id = $1 WHERE id = $2",
			[otherProfile, ownApplication],
		);
		await expectRlsDenied(
			"UPDATE public.application_documents SET application_id = $1 WHERE id = $2",
			[otherApplication, ownDocument],
		);

		const ownDelete = await query<{ id: string }>(
			"DELETE FROM public.application_documents WHERE id = $1 RETURNING id",
			[ownDocument],
		);
		expect(ownDelete.rows).toEqual([{ id: ownDocument }]);
		const otherDelete = await query<{ id: string }>(
			"DELETE FROM public.application_documents WHERE id = $1 RETURNING id",
			[otherDocument],
		);
		expect(otherDelete.rows).toEqual([]);
	});

	it("keeps insert checks exact for profiles, applications, documents, and queue rows", async () => {
		await query(
			"INSERT INTO public.applicant_profiles(id, auth_user_id) VALUES ($1, $2)",
			["61111111-1111-4111-8111-111111111111", ownUser],
		);
		await expectRlsDenied(
			"INSERT INTO public.applicant_profiles(id, auth_user_id) VALUES ($1, $2)",
			["62222222-2222-4222-8222-222222222222", otherUser],
		);

		await query(
			"INSERT INTO public.applications(id, applicant_id) VALUES ($1, $2)",
			["71111111-1111-4111-8111-111111111111", ownProfile],
		);
		await expectRlsDenied(
			"INSERT INTO public.applications(id, applicant_id) VALUES ($1, $2)",
			["72222222-2222-4222-8222-222222222222", otherProfile],
		);

		await query(
			"INSERT INTO public.application_documents(id, application_id) VALUES ($1, $2)",
			["81111111-1111-4111-8111-111111111111", ownApplication],
		);
		await expectRlsDenied(
			"INSERT INTO public.application_documents(id, application_id) VALUES ($1, $2)",
			["82222222-2222-4222-8222-222222222222", otherApplication],
		);

		await query(
			"INSERT INTO public.submission_queue(id, application_id) VALUES ($1, $2)",
			["91111111-1111-4111-8111-111111111111", ownApplication],
		);
		await expectRlsDenied(
			"INSERT INTO public.submission_queue(id, application_id) VALUES ($1, $2)",
			["92222222-2222-4222-8222-222222222222", otherApplication],
		);
		const queueRows = await query<{ id: string }>("SELECT id FROM public.submission_queue");
		expect(queueRows.rows).toEqual([]);
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
