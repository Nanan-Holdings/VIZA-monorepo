import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PoolClient } from "pg";

/**
 * Minimal local-only RLS fixture for the capacity diagnostic.
 * It intentionally does not model the complete production schema.
 */
const APPLICATIONS_PER_USER = 5;
const DOCUMENTS_PER_APPLICATION = 5;
const SYNTHETIC_LABEL = "synthetic";
const INSERT_CHUNK_SIZE = 1_000;

export interface LocalCapacityRlsFixtureSummary {
	migrationSha256: string;
	profiles: number;
	applications: number;
	documents: number;
}

function assertPositiveIndex(index: number): void {
	if (!Number.isSafeInteger(index) || index < 1) {
		throw new RangeError("Capacity RLS identity index must be a positive integer.");
	}
}

function deterministicUuid(kind: string, key: string | number): string {
	const digest = createHash("md5")
		.update(`viza-local-capacity-rls:${kind}:${key}`, "utf8")
		.digest();
	// Keep deterministic IDs valid as UUIDs while retaining the md5-derived value.
	digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x30;
	digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80;
	const hex = digest.toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function capacityRlsIdentity(index: number): {
	userId: string;
	profileId: string;
} {
	assertPositiveIndex(index);
	return {
		userId: deterministicUuid("user", index),
		profileId: deterministicUuid("profile", index),
	};
}

function capacityApplicationId(userIndex: number, applicationIndex: number): string {
	return deterministicUuid("application", `${userIndex}:${applicationIndex}`);
}

function capacityDocumentId(
	userIndex: number,
	applicationIndex: number,
	documentIndex: number,
): string {
	return deterministicUuid(
		"document",
		`${userIndex}:${applicationIndex}:${documentIndex}`,
	);
}

function buildInsertStatement(
	table: string,
	columns: readonly string[],
	rows: readonly (readonly string[])[],
): { text: string; values: string[] } {
	if (rows.length === 0) {
		throw new Error("Capacity RLS fixture cannot insert an empty row batch.");
	}

	const values: string[] = [];
	const placeholders = rows.map((row, rowIndex) => {
		if (row.length !== columns.length) {
			throw new Error("Capacity RLS fixture row shape does not match its columns.");
		}
		const rowPlaceholders = row.map((_value, columnIndex) => {
			values.push(row[columnIndex] as string);
			return `$${rowIndex * columns.length + columnIndex + 1}`;
		});
		return `(${rowPlaceholders.join(", ")})`;
	});

	return {
		text: `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${placeholders.join(",\n")}`,
		values,
	};
}

async function insertRows(
	client: PoolClient,
	table: string,
	columns: readonly string[],
	rows: readonly (readonly string[])[],
): Promise<void> {
	for (let offset = 0; offset < rows.length; offset += INSERT_CHUNK_SIZE) {
		const batch = rows.slice(offset, offset + INSERT_CHUNK_SIZE);
		const statement = buildInsertStatement(table, columns, batch);
		await client.query(statement.text, statement.values);
	}
}

async function assertLocalDatabase(client: PoolClient): Promise<void> {
	const environment = await client.query<{ environment: string | null }>(
		"SELECT current_setting('app.viza_environment', true) AS environment",
	);
	if (environment.rows[0]?.environment !== "local-test") {
		throw new Error("Refusing capacity RLS fixture: database is not marked local-test.");
	}

	const version = await client.query<{ serverVersionNum: string }>(
		"SELECT current_setting('server_version_num') AS \"serverVersionNum\"",
	);
	const serverVersionNum = Number(version.rows[0]?.serverVersionNum);
	if (
		!Number.isFinite(serverVersionNum) ||
		Math.floor(serverVersionNum / 10_000) !== 17
	) {
		throw new Error("Refusing capacity RLS fixture: PostgreSQL 17 is required.");
	}

	const publicSchema = await client.query<{ exists: boolean }>(
		"SELECT pg_catalog.to_regnamespace('public') IS NOT NULL AS exists",
	);
	if (!publicSchema.rows[0]?.exists) {
		throw new Error("Refusing capacity RLS fixture: public schema is missing.");
	}

	const publicObjects = await client.query<{ identity: string }>(`
		SELECT namespace.nspname || '.' || relation.relname AS identity
		FROM pg_catalog.pg_class relation
		JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
		WHERE namespace.nspname = 'public'
		UNION ALL
		SELECT namespace.nspname || '.' || procedure.proname AS identity
		FROM pg_catalog.pg_proc procedure
		JOIN pg_catalog.pg_namespace namespace ON namespace.oid = procedure.pronamespace
		WHERE namespace.nspname = 'public'
		UNION ALL
		SELECT namespace.nspname || '.' || type.typname AS identity
		FROM pg_catalog.pg_type type
		JOIN pg_catalog.pg_namespace namespace ON namespace.oid = type.typnamespace
		WHERE namespace.nspname = 'public'
	`);
	if (publicObjects.rows.length > 0) {
		throw new Error("Refusing capacity RLS fixture: a public fixture object already exists.");
	}

	const authSchema = await client.query<{ exists: boolean }>(`
		SELECT EXISTS (
			SELECT 1
			FROM pg_catalog.pg_namespace
			WHERE nspname = 'auth'
		) AS exists
	`);
	if (authSchema.rows[0]?.exists) {
		throw new Error("Refusing capacity RLS fixture: auth schema already exists.");
	}

	const roleCollisions = await client.query<{ rolname: string }>(`
		SELECT rolname
		FROM pg_catalog.pg_roles
		WHERE rolname IN ('anon', 'authenticated')
	`);
	if (roleCollisions.rows.length > 0) {
		throw new Error("Refusing capacity RLS fixture: a fixture role already exists.");
	}
}

async function createRolesAndAuthUid(client: PoolClient): Promise<void> {
	await client.query("CREATE SCHEMA auth");
	await client.query(
		"CREATE ROLE authenticated NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS",
	);
	await client.query(
		"CREATE ROLE anon NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS",
	);
	await client.query(`
		CREATE FUNCTION auth.uid()
		RETURNS uuid
		LANGUAGE sql
		STABLE
		SECURITY INVOKER
		AS $function$
			SELECT NULLIF(
				pg_catalog.current_setting('request.jwt.claim.sub', true),
				''
			)::uuid;
		$function$
	`);
	await client.query("REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC");
	await client.query("GRANT USAGE ON SCHEMA auth TO anon, authenticated");
	await client.query("GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated");
}

async function createFixtureTablesAndPolicies(client: PoolClient): Promise<void> {
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

		GRANT USAGE ON SCHEMA public TO anon, authenticated;
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
	`);
}

function buildSyntheticRows(users: number): {
	profiles: string[][];
	applications: string[][];
	documents: string[][];
} {
	const profiles: string[][] = [];
	const applications: string[][] = [];
	const documents: string[][] = [];
	const seenIds = new Set<string>();

	const addUniqueId = (id: string): string => {
		if (seenIds.has(id)) {
			throw new Error("Capacity RLS fixture generated a duplicate synthetic ID.");
		}
		seenIds.add(id);
		return id;
	};

	for (let userIndex = 1; userIndex <= users; userIndex += 1) {
		const identity = capacityRlsIdentity(userIndex);
		profiles.push([addUniqueId(identity.profileId), identity.userId]);

		for (
			let applicationIndex = 1;
			applicationIndex <= APPLICATIONS_PER_USER;
			applicationIndex += 1
		) {
			const applicationId = addUniqueId(
				capacityApplicationId(userIndex, applicationIndex),
			);
			applications.push([applicationId, identity.profileId, SYNTHETIC_LABEL]);

			for (
				let documentIndex = 1;
				documentIndex <= DOCUMENTS_PER_APPLICATION;
				documentIndex += 1
			) {
				documents.push([
					addUniqueId(
						capacityDocumentId(userIndex, applicationIndex, documentIndex),
					),
					applicationId,
					SYNTHETIC_LABEL,
				]);
			}
		}
	}

	return { profiles, applications, documents };
}

export async function setupLocalCapacityRlsFixture(
	client: PoolClient,
	users: number,
): Promise<LocalCapacityRlsFixtureSummary> {
	if (!Number.isSafeInteger(users) || users < 1) {
		throw new RangeError("Capacity RLS fixture user count must be a positive integer.");
	}

	const migrationSql = await readFile(
		new URL("../drizzle/0168_core_rls_initplan.sql", import.meta.url),
		"utf8",
	);
	const migrationSha256 = createHash("sha256")
		.update(migrationSql, "utf8")
		.digest("hex");
	const rows = buildSyntheticRows(users);

	let transactionActive = false;
	try {
		await client.query("BEGIN");
		transactionActive = true;
		await assertLocalDatabase(client);
		await createRolesAndAuthUid(client);
		await createFixtureTablesAndPolicies(client);
		await insertRows(
			client,
			"public.applicant_profiles",
			["id", "auth_user_id"],
			rows.profiles,
		);
		await insertRows(
			client,
			"public.applications",
			["id", "applicant_id", "label"],
			rows.applications,
		);
		await insertRows(
			client,
			"public.application_documents",
			["id", "application_id", "label"],
			rows.documents,
		);
		// Execute the repository migration itself so the load exercises the audited
		// InitPlan policy definition rather than a copied replacement.
		await client.query(migrationSql);
		await client.query("COMMIT");
		transactionActive = false;

		return {
			migrationSha256,
			profiles: rows.profiles.length,
			applications: rows.applications.length,
			documents: rows.documents.length,
		};
	} catch (error) {
		if (transactionActive) {
			await client.query("ROLLBACK").catch(() => undefined);
		}
		throw error;
	}
}
