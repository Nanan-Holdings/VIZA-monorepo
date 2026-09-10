import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";

import { capacityRlsIdentity, setupLocalCapacityRlsFixture } from "./local-capacity-rls-fixture.js";
import { percentile } from "./online-capacity-load-lib.js";

const USERS = 100;
const POOL_MAX = 3;
const RAMP_MS = 30_000;
const STEADY_MS = 300_000;
const PACING_MS = 5_000;
const DEADLINE_MS = 390_000;
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const rounded = (n: number): number => Math.round(n * 100) / 100;

export class LocalRlsDiagnosticError extends Error {
	constructor(readonly code: string) { super(code); }
}

function requireCondition(condition: unknown, code: string): asserts condition {
	if (!condition) throw new LocalRlsDiagnosticError(code);
}

/** Dedicated opt-in URL only. Never fall back to the application's DATABASE_URL. */
export function validateLocalRlsTarget(env: NodeJS.ProcessEnv): string {
	requireCondition(env.ONLINE_CAPACITY_RLS_CONFIRM === "local-test", "confirmation_missing");
	requireCondition(env.ONLINE_CAPACITY_RLS_NONPRODUCTION === "local-test", "nonproduction_marker_missing");
	const raw = env.ONLINE_CAPACITY_RLS_DATABASE_URL;
	requireCondition(raw, "database_url_missing");
	let url: URL;
	try { url = new URL(raw); } catch { throw new LocalRlsDiagnosticError("database_url_invalid"); }
	requireCondition(["postgres:", "postgresql:"].includes(url.protocol), "database_protocol_invalid");
	const hostname = url.hostname.replace(/^\[|\]$/gu, "");
	requireCondition(["127.0.0.1", "::1"].includes(hostname), "database_not_literal_loopback");
	requireCondition(!url.search && !url.hash, "database_options_not_allowed");
	requireCondition(url.pathname === "/capacity_test", "database_name_not_dedicated");
	requireCondition(url.username === "capacity_test" && Boolean(url.password), "database_credentials_not_dedicated");
	requireCondition(Number(url.port) > 0 && Number(url.port) <= 65535, "database_port_required");
	return raw;
}

async function assertCleanSession(client: PoolClient): Promise<void> {
	const result = await client.query<{ clean: boolean }>(`
		SELECT current_user = session_user AND auth.uid() IS NULL
			AND coalesce(current_setting('request.jwt.claim.sub', true), '') = '' AS clean
	`);
	requireCondition(result.rows[0]?.clean === true, "session_identity_leaked");
}

/** One owned client per transaction: never use pool.query for transaction state. */
export async function readOwnedFixture(
	pool: Pool,
	index: number,
	rollback: boolean,
	onAcquired?: (ms: number) => void,
): Promise<void> {
	const acquisitionStartedAt = performance.now();
	const client = await pool.connect();
	onAcquired?.(performance.now() - acquisitionStartedAt);
	let reusable = false;
	try {
		await assertCleanSession(client);
		await client.query("BEGIN READ ONLY");
		await client.query("SET LOCAL ROLE authenticated");
		const identity = capacityRlsIdentity(index);
		await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [identity.userId]);
		const role = await client.query<{ enforced: boolean }>(`
			SELECT current_user = 'authenticated'
				AND NOT rolsuper AND NOT rolbypassrls
				AND row_security_active('public.applicant_profiles')
				AND row_security_active('public.applications')
				AND row_security_active('public.application_documents') AS enforced
			FROM pg_roles WHERE rolname = current_user
		`);
		requireCondition(role.rows[0]?.enforced === true, "rls_not_enforced");
		// No owner WHERE filter: RLS itself must enforce ownership on each table.
		const profiles = await client.query<{ id: string; auth_user_id: string }>("SELECT id, auth_user_id FROM public.applicant_profiles LIMIT 2");
		requireCondition(profiles.rows.length === 1 && profiles.rows[0].id === identity.profileId && profiles.rows[0].auth_user_id === identity.userId, "profile_isolation_failed");
		const applications = await client.query<{ id: string; applicant_id: string }>("SELECT id, applicant_id FROM public.applications ORDER BY id LIMIT 6");
		requireCondition(applications.rows.length === 5 && applications.rows.every(row => row.applicant_id === identity.profileId), "application_isolation_failed");
		const applicationIds = new Set(applications.rows.map(row => row.id));
		const documents = await client.query<{ id: string; application_id: string }>("SELECT id, application_id FROM public.application_documents ORDER BY id LIMIT 26");
		requireCondition(documents.rows.length === 25 && documents.rows.every(row => applicationIds.has(row.application_id)), "document_isolation_failed");
		const foreignIdentity = capacityRlsIdentity(index % USERS + 1);
		const foreign = await client.query("SELECT id FROM public.applications WHERE applicant_id = $1", [foreignIdentity.profileId]);
		requireCondition(foreign.rows.length === 0, "foreign_application_visible");
		await client.query(rollback ? "ROLLBACK" : "COMMIT");
		await assertCleanSession(client);
		reusable = true;
	} finally {
		if (!reusable) {
			await client.query("ROLLBACK").catch(() => undefined);
		}
		// Unexpected SQL/auth state must never be returned to the shared pool.
		client.release(!reusable);
	}
}

async function verifyNegativeControls(pool: Pool): Promise<void> {
	const client = await pool.connect();
	let reusable = false;
	try {
		await assertCleanSession(client);
		await client.query("BEGIN READ ONLY");
		await client.query("SET LOCAL ROLE authenticated");
		for (const table of ["applicant_profiles", "applications", "application_documents"]) {
			const empty = await client.query(`SELECT id FROM public.${table} LIMIT 1`);
			requireCondition(empty.rows.length === 0, "missing_identity_visible");
		}
		await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [capacityRlsIdentity(USERS + 1).userId]);
		for (const table of ["applicant_profiles", "applications", "application_documents"]) {
			const empty = await client.query(`SELECT id FROM public.${table} LIMIT 1`);
			requireCondition(empty.rows.length === 0, "unknown_identity_visible");
		}
		await client.query("ROLLBACK");
		await assertCleanSession(client);
		for (const table of ["applicant_profiles", "applications", "application_documents"]) {
			await client.query("BEGIN READ ONLY");
			await client.query("SET LOCAL ROLE anon");
			let denied = false;
			try { await client.query(`SELECT id FROM public.${table} LIMIT 1`); }
			catch (error) { denied = error !== null && typeof error === "object" && "code" in error && error.code === "42501"; }
			finally { await client.query("ROLLBACK"); }
			requireCondition(denied, "anonymous_read_not_denied");
			await assertCleanSession(client);
		}
		// A transaction which actually errored must also restore role and identity.
		await client.query("BEGIN READ ONLY");
		await client.query("SET LOCAL ROLE authenticated");
		await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [capacityRlsIdentity(1).userId]);
		let errorObserved = false;
		try { await client.query("SELECT 1 / 0"); }
		catch (error) { errorObserved = error !== null && typeof error === "object" && "code" in error && error.code === "22012"; }
		finally { await client.query("ROLLBACK"); }
		requireCondition(errorObserved, "rollback_error_control_failed");
		await assertCleanSession(client);
		reusable = true;
	} finally {
		if (!reusable) await client.query("ROLLBACK").catch(() => undefined);
		client.release(!reusable);
	}
}

export async function runLocalRlsDiagnostic(env: NodeJS.ProcessEnv) {
	const startedAt = performance.now();
	const durations: number[] = [];
	const acquisitionDurations: number[] = [];
	const failures = new Set<string>();
	let fixture: Awaited<ReturnType<typeof setupLocalCapacityRlsFixture>> | null = null;
	let pool: Pool | undefined;
	let aborted = false;
	let negativeControlsPassed = false;
	let completedUsers = 0;
	let rampCycles = 0;
	let steadyCycles = 0;
	let successes = 0;
	let errors = 0;
	let commits = 0;
	let rollbacks = 0;
	let peakConnections = 0;
	let peakWaiting = 0;
	let poolErrors = 0;
	let steadyStartedAt = 0;
	let steadyEndedAt = 0;
	let sampler: ReturnType<typeof setInterval> | undefined;
	let progress: ReturnType<typeof setInterval> | undefined;
	let usersDone: Promise<void> | undefined;
	let releaseSteady = (): void => undefined;
	const elapsed = (): number => performance.now() - startedAt;
	const sample = (): void => {
		if (!pool) return;
		peakConnections = Math.max(peakConnections, pool.totalCount);
		peakWaiting = Math.max(peakWaiting, pool.waitingCount);
	};
	const executeCycle = async (index: number, rollback: boolean, phase: "ramp" | "steady"): Promise<void> => {
		if (phase === "ramp") rampCycles += 1; else steadyCycles += 1;
		const begin = performance.now();
		try {
			requireCondition(pool, "pool_missing");
			const request = readOwnedFixture(pool, index, rollback, duration => { acquisitionDurations.push(duration); sample(); });
			sample();
			await request;
			successes += 1;
			if (rollback) rollbacks += 1; else commits += 1;
		} catch (error) {
			errors += 1;
			aborted = true;
			failures.add(error instanceof LocalRlsDiagnosticError ? error.code : "transaction_failed");
		} finally { durations.push(performance.now() - begin); sample(); }
	};
	let deadline: ReturnType<typeof setTimeout> | undefined;
	try {
		const databaseUrl = validateLocalRlsTarget(env);
		pool = new Pool({ connectionString: databaseUrl, max: POOL_MAX, connectionTimeoutMillis: 2_000, query_timeout: 5_000, idleTimeoutMillis: 5_000 });
		pool.on("error", () => { poolErrors += 1; aborted = true; failures.add("pool_error"); });
		const setupClient = await pool.connect();
		let setupComplete = false;
		try { fixture = await setupLocalCapacityRlsFixture(setupClient, USERS); setupComplete = true; }
		finally {
			if (!setupComplete) await setupClient.query("ROLLBACK").catch(() => undefined);
			setupClient.release(!setupComplete);
		}
		await verifyNegativeControls(pool);
		await readOwnedFixture(pool, 1, false);
		await readOwnedFixture(pool, 2, true);
		negativeControlsPassed = true;
		process.stdout.write("RLS_FIXTURE_AND_ISOLATION_CONTROLS_PASS\n");
		const steadyBarrier = new Promise<void>(resolve => { releaseSteady = resolve; });
		let ready = 0;
		let rampReady = (): void => undefined;
		const allRamped = new Promise<void>(resolve => { rampReady = resolve; });
		sampler = setInterval(sample, 50);
		progress = setInterval(() => process.stdout.write(`${JSON.stringify({ stage: steadyStartedAt ? "steady" : "ramp", elapsedMs: rounded(elapsed()), completedCycles: successes, errors, peakConnections, peakWaiting })}\n`), 30_000);
		sample();
		usersDone = Promise.all(Array.from({ length: USERS }, (_, offset) => (async () => {
			await delay(Math.floor(RAMP_MS * offset / (USERS - 1)));
			if (!aborted) await executeCycle(offset + 1, offset % 2 === 0, "ramp");
			ready += 1;
			if (ready === USERS) rampReady();
			await steadyBarrier;
			if (aborted) return;
			await delay(Math.floor(PACING_MS * offset / USERS));
			let cycle = 0;
			while (!aborted && performance.now() < steadyStartedAt + STEADY_MS) {
				await executeCycle(offset + 1, cycle++ % 2 === 0, "steady");
				const remaining = steadyStartedAt + STEADY_MS - performance.now();
				if (remaining <= PACING_MS) {
					while (!aborted && performance.now() < steadyStartedAt + STEADY_MS) await delay(Math.max(1, Math.ceil(steadyStartedAt + STEADY_MS - performance.now())));
					break;
				}
				await delay(PACING_MS);
			}
			if (!aborted) completedUsers += 1;
		})())).then(() => undefined);
		const work = (async () => {
			await allRamped;
			if (aborted) { releaseSteady(); await usersDone; return; }
			steadyStartedAt = performance.now();
			releaseSteady();
			await usersDone;
			steadyEndedAt = performance.now();
		})();
		const timeout = new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new LocalRlsDiagnosticError("runtime_deadline")), Math.max(1, DEADLINE_MS - elapsed())); });
		await Promise.race([work, timeout]);
	} catch (error) {
		failures.add(error instanceof LocalRlsDiagnosticError ? error.code : "diagnostic_failed");
	} finally {
		aborted = true;
		releaseSteady();
		if (deadline) clearTimeout(deadline);
		if (steadyStartedAt && !steadyEndedAt) steadyEndedAt = performance.now();
		if (usersDone) await Promise.race([usersDone.catch(() => undefined), delay(6_000)]);
		if (sampler) clearInterval(sampler);
		if (progress) clearInterval(progress);
		if (pool) {
			let closed = false;
			await Promise.race([pool.end().then(() => { closed = true; }).catch(() => undefined), delay(6_000)]);
			if (!closed) failures.add("pool_cleanup_incomplete");
		}
	}
	const steadyElapsedMs = steadyStartedAt ? steadyEndedAt - steadyStartedAt : 0;
	const p95Ms = percentile(durations, 0.95);
	if (!negativeControlsPassed) failures.add("negative_controls_missing");
	if (completedUsers !== USERS || rampCycles !== USERS) failures.add("users_incomplete");
	if (steadyElapsedMs < STEADY_MS) failures.add("duration_incomplete");
	if (errors || poolErrors) failures.add("errors_observed");
	if (p95Ms >= 500) failures.add("transaction_p95_exceeded");
	if (peakConnections > POOL_MAX) failures.add("connection_budget_exceeded");
	if (successes !== acquisitionDurations.length || !commits || !rollbacks) failures.add("transaction_evidence_incomplete");
	return {
		scope: "minimal-business-schema-rls-database-only",
		authenticatedWebsiteCapacityClaim: false, releaseCapacityClaim: false,
		passed: failures.size === 0, failures: [...failures].sort(),
		fixture, negativeControlsPassed, users: USERS, completedUsers,
		maxPoolConnections: POOL_MAX, rampMs: RAMP_MS, steadyTargetMs: STEADY_MS, pacingMs: PACING_MS,
		steadyElapsedMs: rounded(steadyElapsedMs), totalElapsedMs: rounded(elapsed()),
		rampCycles, steadyCycles, successfulCycles: successes, failedCycles: errors, commits, rollbacks,
		// A cycle contains multiple actual SQL statements; do not report it as one query.
		profileReadChecks: successes, applicationReadChecks: successes, documentReadChecks: successes,
		foreignApplicationDenialChecks: successes, sessionResetChecks: successes * 2,
		p50CycleMs: rounded(percentile(durations, 0.5)), p95CycleMs: rounded(p95Ms),
		p99CycleMs: rounded(percentile(durations, 0.99)), maxCycleMs: rounded(Math.max(0, ...durations)),
		p95AcquisitionMs: rounded(percentile(acquisitionDurations, 0.95)),
		peakPoolConnections: peakConnections, peakPoolWaiting: peakWaiting, poolErrors,
		// Queue peaks are diagnostic only here; this is not the website release gate.
	};
}

async function main(): Promise<void> {
	const hardTimeout = setTimeout(() => { process.stderr.write("LOCAL_RLS_HARD_TIMEOUT\n"); process.exit(1); }, 420_000);
	hardTimeout.unref();
	try {
		const summary = await runLocalRlsDiagnostic(process.env);
		const sourcePaths = [fileURLToPath(import.meta.url), fileURLToPath(new URL("./local-capacity-rls-fixture.ts", import.meta.url))];
		const sourceHashes = await Promise.all(sourcePaths.map(async source => ({ file: path.basename(source), sha256: createHash("sha256").update(await readFile(source)).digest("hex") })));
		const resultDirectory = path.resolve("load-test-results/online-capacity", `local-rls-${new Date().toISOString().replace(/[:.]/gu, "-")}`);
		await mkdir(resultDirectory, { recursive: true });
		await writeFile(path.join(resultDirectory, "summary.json"), `${JSON.stringify({ ...summary, sourceHashes }, null, 2)}\n`, { mode: 0o600 });
		process.stdout.write(`${JSON.stringify({ ...summary, sourceHashes })}\n`);
		process.stdout.write(`LOCAL_RLS_RESULT=${path.join(resultDirectory, "summary.json")}\n`);
		process.exitCode = summary.passed ? 0 : 1;
		if (summary.failures.includes("pool_cleanup_incomplete")) process.exit(1);
	} finally { clearTimeout(hardTimeout); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	void main().catch(() => { process.stderr.write("LOCAL_RLS_DIAGNOSTIC_FAILED\n"); process.exitCode = 1; });
}
