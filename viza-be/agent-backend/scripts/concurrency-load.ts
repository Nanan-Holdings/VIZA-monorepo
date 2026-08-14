import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type QueryResultRow } from "pg";

import {
	evaluateConcurrencyRun,
	isCompleteConcurrencyMatrix,
	type ConcurrencyRunEvaluation,
	type ConcurrencyRunInput,
} from "./concurrency-load-lib.js";

export const PRODUCTION_PROJECT_REF = "oyjxdzsoejraedqghndi";
export const APPROVED_LOAD_LEVELS = [100, 300, 600, 1000] as const;
export const LOAD_COUNTRIES = [
	"vietnam",
	"singapore",
	"malaysia",
	"thailand",
	"south_korea",
] as const;

const FLOW_KEY_BY_COUNTRY: Record<(typeof LOAD_COUNTRIES)[number], string> = {
	vietnam: "vn_evisa",
	singapore: "sgac",
	malaysia: "mdac",
	thailand: "tdac",
	south_korea: "kr_eform",
};

const POOL_MAX = 10;
const CLAIM_WORKER_COUNT = 10;
const GLOBAL_PROBE_REQUESTS = 40;
const SETTLE_CONCURRENCY = 10;
const CLAIM_LEASE_MS = 10_000;
const CONNECTION_TIMEOUT_MS = 2_000;
const IDLE_TIMEOUT_MS = 30_000;
const QUERY_TIMEOUT_MS = 15_000;
const STATEMENT_TIMEOUT_MS = 15_000;
const LOCK_TIMEOUT_MS = 3_000;
const SLOT_LEASE_MS = 30 * 60 * 1000;
const MAX_CLAIM_WINDOWS = 2_000;
const CLAIM_RETRY_DELAY_MS = 15;

export interface ConcurrencyLoadConfig {
	databaseUrl: string;
	projectRef: string;
	levels: number[];
	matrixComplete: boolean;
	poolMax: number;
	claimWorkerCount: number;
	claimLeaseMs: number;
	connectionTimeoutMs: number;
	queryTimeoutMs: number;
	statementTimeoutMs: number;
	lockTimeoutMs: number;
}

export interface StagingDatabaseMarker {
	ok: boolean;
	environment: string | null;
	projectRef: string | null;
	reason?: "environment_mismatch" | "project_ref_mismatch" | "missing_marker";
}

/** Parse the authoritative marker row without exposing database details. */
export function parseStagingDatabaseMarker(
	row: { environment?: unknown; project_ref?: unknown },
	expectedProjectRef: string,
): StagingDatabaseMarker {
	const environment = typeof row.environment === "string" ? row.environment : null;
	const projectRef = typeof row.project_ref === "string" ? row.project_ref : null;
	if (!environment || !projectRef) {
		return { ok: false, environment, projectRef, reason: "missing_marker" };
	}
	if (environment !== "staging") {
		return { ok: false, environment, projectRef, reason: "environment_mismatch" };
	}
	if (projectRef !== expectedProjectRef) {
		return { ok: false, environment, projectRef, reason: "project_ref_mismatch" };
	}
	return { ok: true, environment, projectRef };
}

export type DatabaseErrorKind =
	| "database_error"
	| "lock_timeout"
	| "connection_exhaustion";

interface ErrorWithCode {
	code?: unknown;
	message?: unknown;
}

interface ApplicantProfileRow extends QueryResultRow {
	id: string;
}

interface SyntheticApplicationRow extends QueryResultRow {
	id: string;
	country: string;
}

interface SyntheticJobRow extends QueryResultRow {
	id: string;
	application_id: string;
	country: string;
}

interface ClaimRow extends QueryResultRow {
	id: string;
	application_id: string;
	country: string;
	flow_key: string | null;
	attempts: number;
	max_attempts: number;
	correlation_id: string | null;
	metadata: Record<string, unknown> | null;
}

interface ClaimResult {
	workerId: string;
	row: ClaimRow | null;
	latencyMs: number;
	errorKind?: DatabaseErrorKind;
}

interface RunningCountSample {
	countryCapOvershoots: number;
	globalSlotOvershoots: number;
}

interface MutableLevelMetrics extends ConcurrencyRunInput {
	claimLatenciesMs: number[];
	successfulClaimLatenciesMs: number[];
	claimedJobs: number;
	diagnostics: string[];
	staleLeaseProbePerformed: boolean;
}

interface LevelResult {
	expectedJobs: number;
	measured: ConcurrencyRunEvaluation;
	staleLeaseProbePerformed: boolean;
	diagnostics: string[];
}

interface CleanupResult {
	passed: boolean;
	applicationsRemaining: number;
	runnerJobsRemaining: number;
	slotsRemaining: number;
	errorCode?: string;
}

interface SummaryDocument {
	runId: string;
	levels: Array<{
		expectedJobs: number;
		measured: Pick<
			ConcurrencyRunEvaluation,
			| "jobs"
			| "claimedJobs"
			| "p95ClaimMs"
			| "duplicateClaims"
			| "countryCapOvershoots"
			| "globalSlotOvershoots"
			| "staleLeaseWrites"
			| "databaseErrors"
			| "lockTimeouts"
			| "connectionExhaustions"
			| "syntheticRowsRemaining"
			| "passed"
			| "failures"
		>;
		staleLeaseProbePerformed: boolean;
		diagnostics: string[];
	}>;
	cleanup: CleanupResult;
	overallFailures: string[];
	passed: boolean;
}

function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
	const value = env[name]?.trim();
	return value || undefined;
}

function parseConfiguredLevels(raw: string | undefined): number[] {
	if (!raw) return [...APPROVED_LOAD_LEVELS];

	const tokens = raw
		.split(/[\s,]+/u)
		.map((token) => token.trim())
		.filter(Boolean);
	if (tokens.length === 0) {
		throw new Error("CONCURRENCY_LOAD_LEVELS must contain an approved level");
	}

	const levels = tokens.map((token) => Number(token));
	if (
		levels.some(
			(level) =>
				!Number.isInteger(level) ||
				!(APPROVED_LOAD_LEVELS as readonly number[]).includes(level),
		)
	) {
		throw new Error(
			"CONCURRENCY_LOAD_LEVELS must be a comma-separated subset of 100,300,600,1000",
		);
	}

	return [...new Set(levels)].sort((left, right) => left - right);
}

/**
 * Validate every staging guard without creating a pool or touching the file
 * system. This function is intentionally pure and is safe to use in tests.
 */
export function validateConcurrencyLoadGuards(
	env: NodeJS.ProcessEnv = process.env,
): ConcurrencyLoadConfig {
	if (envValue(env, "CONCURRENCY_LOAD_CONFIRM") !== "staging-only") {
		throw new Error("Set CONCURRENCY_LOAD_CONFIRM=staging-only");
	}

	const databaseUrl = envValue(env, "CONCURRENCY_LOAD_DATABASE_URL");
	if (!databaseUrl) {
		throw new Error("CONCURRENCY_LOAD_DATABASE_URL is required");
	}

	const projectRef = envValue(env, "CONCURRENCY_LOAD_PROJECT_REF");
	if (!projectRef) {
		throw new Error("CONCURRENCY_LOAD_PROJECT_REF is required");
	}
	if (!/^[a-z0-9][a-z0-9-]{2,62}$/u.test(projectRef)) {
		throw new Error("CONCURRENCY_LOAD_PROJECT_REF has an invalid format");
	}
	if (projectRef === PRODUCTION_PROJECT_REF) {
		throw new Error("Concurrency load testing is forbidden on production");
	}

	let parsedDatabaseUrl: URL;
	try {
		parsedDatabaseUrl = new URL(databaseUrl);
	} catch {
		throw new Error("CONCURRENCY_LOAD_DATABASE_URL is invalid");
	}
	if (
		parsedDatabaseUrl.protocol !== "postgres:" &&
		parsedDatabaseUrl.protocol !== "postgresql:"
	) {
		throw new Error("CONCURRENCY_LOAD_DATABASE_URL must use postgres://");
	}
	if (!parsedDatabaseUrl.hostname) {
		throw new Error("CONCURRENCY_LOAD_DATABASE_URL must include a hostname");
	}
	const hostname = parsedDatabaseUrl.hostname.toLowerCase();
	const normalizedDatabaseUrl = databaseUrl.toLowerCase();
	if (normalizedDatabaseUrl.includes(PRODUCTION_PROJECT_REF)) {
		throw new Error("Concurrency load testing is forbidden on production");
	}
	const directMatch = hostname.match(/^db\.([a-z0-9][a-z0-9-]{2,62})\.supabase\.co$/u);
	const isDirectBinding = directMatch?.[1] === projectRef;
	const isPoolerHost = hostname.endsWith(".pooler.supabase.com");
	let poolerUsername: string;
	try {
		poolerUsername = decodeURIComponent(parsedDatabaseUrl.username);
	} catch {
		throw new Error("CONCURRENCY_LOAD_DATABASE_URL has an invalid username");
	}
	const isPoolerBinding = isPoolerHost && poolerUsername === `postgres.${projectRef}`;
	if (!isDirectBinding && !isPoolerBinding) {
		throw new Error("CONCURRENCY_LOAD_DATABASE_URL host must match CONCURRENCY_LOAD_PROJECT_REF");
	}
	if (
		directMatch?.[1] === PRODUCTION_PROJECT_REF ||
		poolerUsername === `postgres.${PRODUCTION_PROJECT_REF}`
	) {
		throw new Error("Concurrency load testing is forbidden on production");
	}
	const levels = parseConfiguredLevels(envValue(env, "CONCURRENCY_LOAD_LEVELS"));

	return {
		databaseUrl,
		projectRef,
		levels,
		matrixComplete: isCompleteConcurrencyMatrix(levels),
		poolMax: POOL_MAX,
		claimWorkerCount: CLAIM_WORKER_COUNT,
		claimLeaseMs: CLAIM_LEASE_MS,
		connectionTimeoutMs: CONNECTION_TIMEOUT_MS,
		queryTimeoutMs: QUERY_TIMEOUT_MS,
		statementTimeoutMs: STATEMENT_TIMEOUT_MS,
		lockTimeoutMs: LOCK_TIMEOUT_MS,
	};
}

export function classifyDatabaseError(error: unknown): DatabaseErrorKind {
	const candidate = error as ErrorWithCode;
	const code = typeof candidate.code === "string" ? candidate.code : "";
	const message = typeof candidate.message === "string" ? candidate.message : "";
	const normalizedMessage = message.toLowerCase();

	if (
		code === "55P03" ||
		code === "40P01" ||
		normalizedMessage.includes("lock timeout") ||
		normalizedMessage.includes("deadlock")
	) {
		return "lock_timeout";
	}
	if (
		code === "53300" ||
		code === "57P03" ||
		code === "ECONNREFUSED" ||
		code === "ECONNRESET" ||
		code === "ETIMEDOUT" ||
		normalizedMessage.includes("too many clients") ||
		normalizedMessage.includes("connection exhausted") ||
		normalizedMessage.includes("connection terminated")
	) {
		return "connection_exhaustion";
	}
	return "database_error";
}

function createRunId(): string {
	return `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

function purposeForRun(runId: string): string {
	return `concurrency-load:${runId}`;
}

function recordDatabaseError(
	metrics: MutableLevelMetrics,
	error: unknown,
	context: string,
): void {
	const kind = classifyDatabaseError(error);
	if (kind === "lock_timeout") metrics.lockTimeouts += 1;
	else if (kind === "connection_exhaustion") metrics.connectionExhaustions += 1;
	else metrics.databaseErrors += 1;
	metrics.diagnostics.push(`${context}:${kind}`);
}

function createPool(config: ConcurrencyLoadConfig): Pool {
	const databaseUrl = new URL(config.databaseUrl);
	return new Pool({
		connectionString: config.databaseUrl,
		max: config.poolMax,
		connectionTimeoutMillis: config.connectionTimeoutMs,
		idleTimeoutMillis: IDLE_TIMEOUT_MS,
		query_timeout: config.queryTimeoutMs,
		statement_timeout: config.statementTimeoutMs,
		options: `-c lock_timeout=${config.lockTimeoutMs}ms`,
		ssl:
			(databaseUrl.hostname.endsWith(".supabase.co") ||
				databaseUrl.hostname.endsWith(".pooler.supabase.com"))
			? { rejectUnauthorized: true }
			: undefined,
	});
}

async function assertStagingDatabaseMarker(
	pool: Pool,
	projectRef: string,
): Promise<void> {
	const result = await pool.query<{
		environment: unknown;
		project_ref: unknown;
	}>(
		`SELECT current_setting('app.viza_environment', true) AS environment,
                current_setting('app.viza_project_ref', true) AS project_ref`,
	);
	const marker = parseStagingDatabaseMarker(result.rows[0] ?? {}, projectRef);
	if (!marker.ok) {
		throw new Error("Concurrency load database marker is not the guarded staging project");
	}
}

function sleep(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function assertQueueIsolation(pool: Pool, purpose: string): Promise<void> {
	const syntheticPrefix = `${purpose}:%`;
	const result = await pool.query<{ count: number }>(
		`SELECT COUNT(*)::int AS count
         FROM public.runner_job
         WHERE country = ANY($1::text[])
           AND status IN ('queued', 'running')
           AND NOT (
             COALESCE(metadata->>'concurrency_load_run_id', '') = $2
             OR correlation_id LIKE $3
           )`,
		[LOAD_COUNTRIES, purpose.slice("concurrency-load:".length), syntheticPrefix],
	);
	if (Number(result.rows[0]?.count ?? 0) > 0) {
		throw new Error(
			"Refusing concurrency load: non-synthetic queued/running pool jobs exist",
		);
	}
}

async function assertCapsAvailable(pool: Pool): Promise<void> {
	const result = await pool.query<{
		country: string;
		max_concurrent: number;
		paused: boolean;
	}>(
		`SELECT country, max_concurrent, paused
         FROM public.runner_concurrency_cap
         WHERE country = ANY($1::text[])
         ORDER BY country`,
		[LOAD_COUNTRIES],
	);
	const byCountry = new Map(result.rows.map((row) => [row.country, row]));
	for (const country of LOAD_COUNTRIES) {
		const cap = byCountry.get(country);
		if (!cap || cap.paused || cap.max_concurrent < 1) {
			throw new Error(`Staging runner cap unavailable for ${country}`);
		}
	}
}

async function reserveSyntheticSlots(
	pool: Pool,
	workerIds: readonly string[],
): Promise<number[]> {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const slots = await client.query<{
			slot_number: number;
			owner_machine_id: string | null;
			owner_kind: string | null;
			lease_until: string | null;
		}>(
			`SELECT slot_number, owner_machine_id, owner_kind, lease_until
             FROM public.runner_machine_slot
             ORDER BY slot_number
             FOR UPDATE`,
		);
		if (slots.rows.length < workerIds.length) {
			throw new Error("Staging runner machine slots are incomplete");
		}
		if (
			slots.rows.some(
				(row) =>
					row.owner_machine_id !== null ||
					row.owner_kind !== null ||
					row.lease_until !== null,
			)
		) {
			throw new Error(
				"Refusing concurrency load: runner machine slots are owned by existing work",
			);
		}

		const now = new Date();
		const leaseUntil = new Date(now.getTime() + SLOT_LEASE_MS);
		const selectedSlots: number[] = [];
		for (let index = 0; index < workerIds.length; index += 1) {
			const slotNumber = slots.rows[index]?.slot_number;
			if (slotNumber === undefined) {
				throw new Error("Unable to allocate the fixed synthetic slot set");
			}
			const updated = await client.query<{ slot_number: number }>(
				`UPDATE public.runner_machine_slot
             SET owner_machine_id = $1,
                 owner_kind = 'pool',
                 lease_until = $2,
                 acquired_at = $3,
                 updated_at = $3
             WHERE slot_number = $4
               AND owner_machine_id IS NULL
               AND owner_kind IS NULL
               AND lease_until IS NULL
             RETURNING slot_number`,
				[workerIds[index], leaseUntil, now, slotNumber],
			);
			if (updated.rowCount !== 1) {
				throw new Error("Unable to allocate the fixed synthetic slot set");
			}
			selectedSlots.push(slotNumber);
		}
		await client.query("COMMIT");
		return selectedSlots;
	} catch (error) {
		await client.query("ROLLBACK").catch(() => undefined);
		throw error;
	} finally {
		client.release();
	}
}

async function selectApplicantProfile(pool: Pool): Promise<string> {
	const result = await pool.query<ApplicantProfileRow>(
		`SELECT id
         FROM public.applicant_profiles
         ORDER BY created_at NULLS LAST, id
         LIMIT 1`,
	);
	const profileId = result.rows[0]?.id;
	if (!profileId) {
		throw new Error("No staging applicant profile is available");
	}
	return profileId;
}

async function insertSyntheticBatch(
	pool: Pool,
	applicantId: string,
	purpose: string,
	runId: string,
	level: number,
): Promise<SyntheticJobRow[]> {
	const applicationValues: string[] = [];
	const applicationParameters: unknown[] = [];
	for (let index = 0; index < level; index += 1) {
		const country = LOAD_COUNTRIES[index % LOAD_COUNTRIES.length];
		const offset = index * 4;
		applicationValues.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, 'draft', $${offset + 4})`);
		applicationParameters.push(applicantId, country, "CONCURRENCY_LOAD", purpose);
	}
	const applications = await pool.query<SyntheticApplicationRow>(
		`INSERT INTO public.applications (
           applicant_id, country, visa_type, status, purpose
         ) VALUES ${applicationValues.join(", ")}
         RETURNING id, country`,
		applicationParameters,
	);

	const jobValues: string[] = [];
	const jobParameters: unknown[] = [];
	for (let index = 0; index < applications.rows.length; index += 1) {
		const application = applications.rows[index];
		if (!application) throw new Error("Synthetic application insert returned an incomplete row");
		const country = application.country as (typeof LOAD_COUNTRIES)[number];
		const offset = index * 5;
		const correlationId = `${purpose}:${String(index + 1).padStart(4, "0")}`;
		jobValues.push(
			`($${offset + 1}, $${offset + 2}, $${offset + 3}, 'queued', 0, 3, $${offset + 4}, $${offset + 5}::jsonb, NOW(), NOW())`,
		);
		jobParameters.push(
			application.id,
			country,
			FLOW_KEY_BY_COUNTRY[country],
			correlationId,
			JSON.stringify({
				concurrency_load_run_id: runId,
				concurrency_load_synthetic: true,
				concurrency_load_level: level,
			}),
		);
	}
	const jobs = await pool.query<SyntheticJobRow>(
		`INSERT INTO public.runner_job (
           application_id, country, flow_key, status, attempts, max_attempts,
           correlation_id, metadata, available_at, enqueued_at
         ) VALUES ${jobValues.join(", ")}
         RETURNING id, application_id, country`,
		jobParameters,
	);
	if (jobs.rows.length !== level) {
		throw new Error("Synthetic runner job insert returned an incomplete batch");
	}
	return jobs.rows;
}

async function claimOne(
	pool: Pool,
	workerId: string,
	leaseMs: number,
	now = new Date(),
	requireSlot = true,
): Promise<ClaimResult> {
	const startedAt = performance.now();
	try {
		const result = await pool.query<ClaimRow>(
			`SELECT *
			 FROM public.claim_runner_pool_job($1, $2, $3, $4)`,
			[workerId, leaseMs, requireSlot, now],
		);
		return {
			workerId,
			row: result.rows[0] ?? null,
			latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
		};
	} catch (error) {
		return {
			workerId,
			row: null,
			latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
			errorKind: classifyDatabaseError(error),
		};
	}
}

async function measureRunningCounts(
	pool: Pool,
	runId: string,
): Promise<RunningCountSample> {
	const countryCounts = await pool.query<{
		country: string;
		running: number;
		max_concurrent: number;
	}>(
		`SELECT cap.country,
                COUNT(rj.id) FILTER (WHERE rj.status = 'running')::int AS running,
                cap.max_concurrent
         FROM public.runner_concurrency_cap AS cap
         LEFT JOIN public.runner_job AS rj
           ON rj.country = cap.country
          AND rj.metadata->>'concurrency_load_run_id' = $1
         WHERE cap.country = ANY($2::text[])
         GROUP BY cap.country, cap.max_concurrent`,
		[runId, LOAD_COUNTRIES],
	);
	const countryCapOvershoots = countryCounts.rows.reduce(
		(total, row) => total + Math.max(0, row.running - row.max_concurrent),
		0,
	);

	const globalCount = await pool.query<{
		running: number;
		active_slots: number;
	}>(
		`SELECT
           COUNT(rj.id) FILTER (WHERE rj.status = 'running')::int AS running,
           (
             SELECT COUNT(*)::int
             FROM public.runner_machine_slot
             WHERE owner_kind = 'pool'
               AND lease_until > NOW()
           ) AS active_slots
         FROM public.runner_job AS rj
         WHERE rj.metadata->>'concurrency_load_run_id' = $1`,
		[runId],
	);
	const globalRow = globalCount.rows[0];
	return {
		countryCapOvershoots,
		globalSlotOvershoots: globalRow
			? Math.max(0, globalRow.running - globalRow.active_slots)
			: 0,
	};
}

async function countSyntheticRows(
	pool: Pool,
	purpose: string,
): Promise<{ queuedOrRunning: number; allJobs: number }> {
	const result = await pool.query<{
		queued_or_running: number;
		all_jobs: number;
	}>(
		`SELECT
           (
             SELECT COUNT(*)::int
             FROM public.runner_job AS rj
             JOIN public.applications AS a ON a.id = rj.application_id
             WHERE a.purpose = $1
               AND rj.status IN ('queued', 'running')
           ) AS queued_or_running,
           (
             SELECT COUNT(*)::int
             FROM public.runner_job AS rj
             JOIN public.applications AS a ON a.id = rj.application_id
             WHERE a.purpose = $1
           ) AS all_jobs`,
		[purpose],
	);
	return {
		queuedOrRunning: Number(result.rows[0]?.queued_or_running ?? 0),
		allJobs: Number(result.rows[0]?.all_jobs ?? 0),
	};
}

async function countSyntheticIds(
	pool: Pool,
	jobIds: readonly string[],
	applicationIds: readonly string[],
): Promise<number> {
	if (jobIds.length === 0 && applicationIds.length === 0) return 0;
	const result = await pool.query<{ jobs: number; applications: number }>(
		`SELECT
           (SELECT COUNT(*)::int FROM public.runner_job WHERE id = ANY($1::uuid[])) AS jobs,
           (SELECT COUNT(*)::int FROM public.applications WHERE id = ANY($2::uuid[])) AS applications`,
		[jobIds, applicationIds],
	);
	return Number(result.rows[0]?.jobs ?? 0) + Number(result.rows[0]?.applications ?? 0);
}

async function cleanupLevelSyntheticData(
	pool: Pool,
	jobIds: readonly string[],
	applicationIds: readonly string[],
): Promise<number> {
	if (jobIds.length > 0) {
		await pool.query(
			"DELETE FROM public.runner_job WHERE id = ANY($1::uuid[])",
			[jobIds],
		);
	}
	if (applicationIds.length > 0) {
		await pool.query(
			"DELETE FROM public.applications WHERE id = ANY($1::uuid[])",
			[applicationIds],
		);
	}
	return countSyntheticIds(pool, jobIds, applicationIds);
}

async function restoreUnexpectedClaim(
	pool: Pool,
	claim: ClaimResult,
	metrics: MutableLevelMetrics,
): Promise<void> {
	if (!claim.row) return;
	try {
		const restored = await pool.query(
			`UPDATE public.runner_job
         SET status = 'queued',
             leased_by = NULL,
             leased_until = NULL,
             started_at = NULL,
             finished_at = NULL,
             last_error = NULL,
             available_at = clock_timestamp()
         WHERE id = $1
           AND status = 'running'
           AND leased_by = $2
           AND leased_until > clock_timestamp()`,
			[claim.row.id, claim.workerId],
		);
		if ((restored.rowCount ?? 0) !== 1) {
			metrics.staleLeaseWrites += 1;
			metrics.diagnostics.push("claim:unexpected_restore_failed");
		}
	} catch (error) {
		recordDatabaseError(metrics, error, "unexpected_restore");
		metrics.staleLeaseWrites += 1;
	}
}

async function settleClaim(
	pool: Pool,
	claim: ClaimResult,
): Promise<number> {
	if (!claim.row) return 0;
	const result = await pool.query(
		`SELECT * FROM public.complete_runner_pool_job($1, $2, clock_timestamp())`,
		[claim.row.id, claim.workerId],
	);
	return result.rowCount ?? 0;
}

async function settleClaimsBounded(
	pool: Pool,
	claims: readonly ClaimResult[],
	metrics: MutableLevelMetrics,
): Promise<void> {
	for (let offset = 0; offset < claims.length; offset += SETTLE_CONCURRENCY) {
		const window = claims.slice(offset, offset + SETTLE_CONCURRENCY);
		const outcomes = await Promise.all(
			window.map(async (claim) => {
				try {
					return await settleClaim(pool, claim);
				} catch (error) {
					recordDatabaseError(metrics, error, "settle");
					return 0;
				}
			}),
		);
		for (const settledRows of outcomes) {
			if (settledRows !== 1) metrics.staleLeaseWrites += 1;
		}
	}
}

async function runStaleLeaseProbe(
	pool: Pool,
	claim: ClaimResult,
	purpose: string,
	metrics: MutableLevelMetrics,
	workerIds: readonly string[],
	expectedJobIds: ReadonlySet<string>,
	claimedJobIds: Set<string>,
): Promise<void> {
	if (!claim.row) return;
	const oldOwner = claim.workerId;
	const newOwner = workerIds.find((workerId) => workerId !== oldOwner);
	if (!newOwner) {
		metrics.staleLeaseWrites += 1;
		return;
	}
	const probeStart = Date.now();
	let takeover: ClaimResult | null = null;
	for (const offsetMs of [CLAIM_LEASE_MS + 1, CLAIM_LEASE_MS + 16_000, CLAIM_LEASE_MS + 32_000]) {
		const candidate = await claimOne(
			pool,
			newOwner,
			CLAIM_LEASE_MS,
			new Date(probeStart + offsetMs),
		);
		if (candidate.errorKind) {
			recordDatabaseError(metrics, candidate.errorKind, "stale_claim");
			continue;
		}
		if (!candidate.row) continue;
		if (expectedJobIds.has(candidate.row.id) && !claimedJobIds.has(candidate.row.id)) {
			claimedJobIds.add(candidate.row.id);
			metrics.claimedJobs += 1;
			metrics.successfulClaimLatenciesMs.push(candidate.latencyMs);
		}
		if (candidate.row.id === claim.row.id) {
			takeover = candidate;
			break;
		}
		// The recovery poll may return another synthetic row first. Settle it
		// through the same fenced RPC before retrying the probe timestamp.
		if (
			candidate.row.metadata?.concurrency_load_run_id !==
			purpose.slice("concurrency-load:".length)
		) {
			metrics.databaseErrors += 1;
			metrics.diagnostics.push("stale_claim:unexpected_job");
			continue;
		}
		try {
			if ((await settleClaim(pool, candidate)) !== 1) metrics.staleLeaseWrites += 1;
		} catch (error) {
			recordDatabaseError(metrics, error, "stale_settle");
		}
	}
	if (!takeover?.row) {
		metrics.staleLeaseWrites += 1;
		try {
			if ((await settleClaim(pool, claim)) !== 1) metrics.staleLeaseWrites += 1;
		} catch (error) {
			recordDatabaseError(metrics, error, "stale_original_settle");
		}
		return;
	}

	// Old owner must be fenced out after the real claim RPC reassigns the lease.
	const staleWrite = await pool.query(
		`SELECT * FROM public.complete_runner_pool_job($1, $2, clock_timestamp())`,
		[claim.row.id, oldOwner],
	);
	if ((staleWrite.rowCount ?? 0) !== 0) metrics.staleLeaseWrites += staleWrite.rowCount ?? 0;
	try {
		if ((await settleClaim(pool, takeover)) !== 1) metrics.staleLeaseWrites += 1;
	} catch (error) {
		recordDatabaseError(metrics, error, "stale_new_owner_settle");
	}
}

function createLevelMetrics(jobs: number): MutableLevelMetrics {
	return {
		jobs,
		duplicateClaims: 0,
		countryCapOvershoots: 0,
		globalSlotOvershoots: 0,
		staleLeaseWrites: 0,
		databaseErrors: 0,
		lockTimeouts: 0,
		connectionExhaustions: 0,
		claimLatenciesMs: [],
		successfulClaimLatenciesMs: [],
		syntheticRowsRemaining: jobs,
		claimedJobs: 0,
		diagnostics: [],
		staleLeaseProbePerformed: false,
	};
}

async function runLevel(
	pool: Pool,
	config: ConcurrencyLoadConfig,
	applicantId: string,
	purpose: string,
	runId: string,
	level: number,
	workerIds: readonly string[],
): Promise<LevelResult> {
	const metrics = createLevelMetrics(level);
	await assertQueueIsolation(pool, purpose);
	const jobs = await insertSyntheticBatch(pool, applicantId, purpose, runId, level);
	const expectedJobIds = new Set(jobs.map((job) => job.id));
	const claimedJobIds = new Set<string>();
	const applicationIds = jobs.map((job) => job.application_id);
	let windows = 0;
	let probedClaimId: string | undefined;

	while (metrics.syntheticRowsRemaining > 0 && windows < MAX_CLAIM_WINDOWS) {
		windows += 1;
		await assertQueueIsolation(pool, purpose);
		const requestWorkers =
			windows === 1
				? Array.from(
						{ length: GLOBAL_PROBE_REQUESTS },
						(_, index) => workerIds[index % workerIds.length] as string,
					)
				: workerIds;
		const claims = await Promise.all(
			requestWorkers.map((workerId) => claimOne(pool, workerId, config.claimLeaseMs)),
		);
		for (const claim of claims) {
			metrics.claimLatenciesMs.push(claim.latencyMs);
			if (claim.errorKind) {
				if (claim.errorKind === "lock_timeout") metrics.lockTimeouts += 1;
				else if (claim.errorKind === "connection_exhaustion") {
					metrics.connectionExhaustions += 1;
				} else {
					metrics.databaseErrors += 1;
				}
				metrics.diagnostics.push(`claim:${claim.errorKind}`);
			}
		}

		const returnedClaims = claims.filter((claim) => claim.row !== null);
		for (const claim of returnedClaims) {
			const jobId = claim.row?.id;
			if (!jobId || !expectedJobIds.has(jobId)) {
				await restoreUnexpectedClaim(pool, claim, metrics);
				metrics.databaseErrors += 1;
				metrics.diagnostics.push("claim:unexpected_job");
				throw new Error("Claim returned a non-synthetic runner job");
			}
			metrics.successfulClaimLatenciesMs.push(claim.latencyMs);
			if (claimedJobIds.has(jobId)) metrics.duplicateClaims += 1;
			else {
				claimedJobIds.add(jobId);
				metrics.claimedJobs += 1;
			}
		}

		if (returnedClaims.length > 0) {
			try {
				const sample = await measureRunningCounts(pool, runId);
				metrics.countryCapOvershoots += sample.countryCapOvershoots;
				metrics.globalSlotOvershoots += sample.globalSlotOvershoots;
			} catch (error) {
				recordDatabaseError(metrics, error, "measure");
			}

			for (const claim of returnedClaims) {
				if (!claim.row || !expectedJobIds.has(claim.row.id)) continue;
				if (!metrics.staleLeaseProbePerformed) {
					probedClaimId = claim.row.id;
					try {
						await runStaleLeaseProbe(
							pool,
							claim,
							purpose,
							metrics,
							workerIds,
							expectedJobIds,
							claimedJobIds,
						);
						metrics.staleLeaseProbePerformed = true;
					} catch (error) {
						recordDatabaseError(metrics, error, "stale_lease_probe");
						metrics.staleLeaseProbePerformed = true;
					}
				}
			}
			const claimsToSettle = returnedClaims.filter(
				(candidate) => candidate.row !== null && candidate.row.id !== probedClaimId,
			);
			await settleClaimsBounded(pool, claimsToSettle, metrics);
		}

		try {
			const remaining = await countSyntheticRows(pool, purpose);
			metrics.syntheticRowsRemaining = remaining.queuedOrRunning;
			if (remaining.queuedOrRunning === 0) break;
		} catch (error) {
			recordDatabaseError(metrics, error, "count");
			metrics.syntheticRowsRemaining = level;
			break;
		}

		if (returnedClaims.length === 0) await sleep(CLAIM_RETRY_DELAY_MS);
	}

	if (!metrics.staleLeaseProbePerformed) {
		metrics.staleLeaseWrites += 1;
		metrics.diagnostics.push("stale_lease_probe:not_performed");
	}
	try {
		const remaining = await countSyntheticRows(pool, purpose);
		metrics.syntheticRowsRemaining = remaining.queuedOrRunning;
	} catch (error) {
		recordDatabaseError(metrics, error, "final_count");
		metrics.syntheticRowsRemaining = level;
	}
	try {
		metrics.syntheticRowsRemaining = await cleanupLevelSyntheticData(
			pool,
			jobs.map((job) => job.id),
			applicationIds,
		);
	} catch (error) {
		recordDatabaseError(metrics, error, "level_cleanup");
		metrics.syntheticRowsRemaining = level;
	}

	const measured = evaluateConcurrencyRun(metrics);
	return {
		expectedJobs: level,
		measured,
		staleLeaseProbePerformed: metrics.staleLeaseProbePerformed,
		diagnostics: metrics.diagnostics.slice(),
	};
}

async function cleanupSyntheticData(
	pool: Pool,
	purpose: string,
	workerIds: readonly string[],
): Promise<CleanupResult> {
	let errorCode: string | undefined;
	const runCleanupStep = async (step: () => Promise<unknown>): Promise<void> => {
		let lastError: unknown;
		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				await step();
				return;
			} catch (error) {
				lastError = error;
				await sleep(25 * (attempt + 1));
			}
		}
		if (!errorCode && lastError) errorCode = classifyDatabaseError(lastError);
	};

	// Every cleanup item is independent: a failed job delete must not prevent
	// application, slot, or residue checks from running.
	await runCleanupStep(() =>
		pool.query(
			`DELETE FROM public.runner_job
         WHERE application_id IN (
           SELECT id FROM public.applications WHERE purpose = $1
         )`,
			[purpose],
		),
	);
	await runCleanupStep(() => pool.query("DELETE FROM public.applications WHERE purpose = $1", [purpose]));
	await runCleanupStep(() =>
		pool.query(
			`UPDATE public.runner_machine_slot
         SET owner_machine_id = NULL,
             owner_kind = NULL,
             lease_until = NULL,
             acquired_at = NULL,
             updated_at = NOW()
         WHERE owner_machine_id = ANY($1::text[])`,
			[workerIds],
		),
	);

	let applicationsRemaining = 0;
	let runnerJobsRemaining = 0;
	let slotsRemaining = 0;
	await runCleanupStep(async () => {
		const applications = await pool.query<{ count: number }>(
			"SELECT COUNT(*)::int AS count FROM public.applications WHERE purpose = $1",
			[purpose],
		);
		applicationsRemaining = Number(applications.rows[0]?.count ?? 0);
	});
	await runCleanupStep(async () => {
		const jobs = await pool.query<{ count: number }>(
			`SELECT COUNT(*)::int AS count
         FROM public.runner_job
         WHERE correlation_id LIKE $1`,
			[`${purpose}:%`],
		);
		runnerJobsRemaining = Number(jobs.rows[0]?.count ?? 0);
	});
	await runCleanupStep(async () => {
		const slots = await pool.query<{ count: number }>(
			`SELECT COUNT(*)::int AS count
         FROM public.runner_machine_slot
         WHERE owner_machine_id = ANY($1::text[])`,
			[workerIds],
		);
		slotsRemaining = Number(slots.rows[0]?.count ?? 0);
	});

	return {
		passed:
			!errorCode &&
			applicationsRemaining === 0 &&
			runnerJobsRemaining === 0 &&
			slotsRemaining === 0,
		applicationsRemaining,
		runnerJobsRemaining,
		slotsRemaining,
		...(errorCode ? { errorCode } : {}),
	};
}

function summaryLevel(level: LevelResult): SummaryDocument["levels"][number] {
	const measured = level.measured;
	return {
		expectedJobs: level.expectedJobs,
		measured: {
			jobs: measured.jobs,
			claimedJobs: measured.claimedJobs,
			p95ClaimMs: measured.p95ClaimMs,
			duplicateClaims: measured.duplicateClaims,
			countryCapOvershoots: measured.countryCapOvershoots,
			globalSlotOvershoots: measured.globalSlotOvershoots,
			staleLeaseWrites: measured.staleLeaseWrites,
			databaseErrors: measured.databaseErrors,
			lockTimeouts: measured.lockTimeouts,
			connectionExhaustions: measured.connectionExhaustions,
			syntheticRowsRemaining: measured.syntheticRowsRemaining,
			passed: measured.passed,
			failures: measured.failures,
		},
		staleLeaseProbePerformed: level.staleLeaseProbePerformed,
		diagnostics: level.diagnostics,
	};
}

/**
 * Resolve the summary file from the checked-in script location, not from the
 * caller's working directory. The working-directory argument is retained for
 * pure tests that prove both supported invocation directories resolve equally.
 */
export function resolveLoadResultsPath(
	runId: string,
	_workingDirectory = process.cwd(),
	scriptUrl = import.meta.url,
): string {
	if (!/^[a-z0-9][a-z0-9-]{1,63}$/u.test(runId)) {
		throw new Error("Invalid concurrency load run id");
	}
	const scriptDirectory = path.dirname(fileURLToPath(scriptUrl));
	const repositoryRoot = path.resolve(scriptDirectory, "..", "..", "..");
	return path.join(
		repositoryRoot,
		"load-test-results",
		"concurrency",
		runId,
		"summary.json",
	);
}

async function writeSummary(
	runId: string,
	levels: readonly LevelResult[],
	cleanup: CleanupResult,
	overallFailures: readonly string[],
): Promise<void> {
	const summaryPath = resolveLoadResultsPath(runId);
	const outputDirectory = path.dirname(summaryPath);
	const summary: SummaryDocument = {
		runId,
		levels: levels.map(summaryLevel),
		cleanup,
		overallFailures: [...overallFailures],
		passed:
			cleanup.passed &&
			overallFailures.length === 0 &&
			levels.length > 0 &&
			levels.every((level) => level.measured.passed),
	};
	await mkdir(outputDirectory, { recursive: true });
	await writeFile(
		summaryPath,
		`${JSON.stringify(summary, null, 2)}\n`,
		"utf8",
	);
}

function printLevelTable(levels: readonly LevelResult[]): void {
	console.table(
		levels.map((level) => ({
			expected: level.expectedJobs,
			measured: level.measured.jobs,
			claimed: level.measured.claimedJobs,
			p95ClaimMs: level.measured.p95ClaimMs,
			decision: level.measured.passed ? "pass" : "fail",
		})),
	);
}

/**
 * Execute one guarded staging run. Guard validation is the first operation;
 * pool creation and all writes happen only after it succeeds.
 */
export async function runConcurrencyLoad(
	env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
	const config = validateConcurrencyLoadGuards(env);
	const runId = createRunId();
	const purpose = purposeForRun(runId);
	const workerIds = Array.from(
		{ length: config.claimWorkerCount },
		(_, index) => `${purpose}:worker-${String(index + 1).padStart(2, "0")}`,
	);
	const pool = createPool(config);
	const levelResults: LevelResult[] = [];
	const overallFailures: string[] = config.matrixComplete ? [] : ["matrix_incomplete"];
	let writesStarted = false;
	let databaseGuardPassed = false;
	let cleanup: CleanupResult = {
		passed: false,
		applicationsRemaining: 0,
		runnerJobsRemaining: 0,
		slotsRemaining: 0,
		errorCode: "not_started",
	};

	try {
		await assertStagingDatabaseMarker(pool, config.projectRef);
		databaseGuardPassed = true;
		await assertQueueIsolation(pool, purpose);
		await assertCapsAvailable(pool);
		const applicantId = await selectApplicantProfile(pool);
		writesStarted = true;
		await reserveSyntheticSlots(pool, workerIds);

		for (const level of config.levels) {
			const result = await runLevel(
				pool,
				config,
				applicantId,
				purpose,
				runId,
				level,
				workerIds,
			);
			levelResults.push(result);
		}
	} catch (error) {
		const kind = classifyDatabaseError(error);
		levelResults.push({
			expectedJobs: 0,
			measured: evaluateConcurrencyRun({
				jobs: 0,
				duplicateClaims: 0,
				countryCapOvershoots: 0,
				globalSlotOvershoots: 0,
				staleLeaseWrites: 1,
				databaseErrors: kind === "database_error" ? 1 : 0,
				lockTimeouts: kind === "lock_timeout" ? 1 : 0,
				connectionExhaustions: kind === "connection_exhaustion" ? 1 : 0,
				claimLatenciesMs: [],
				successfulClaimLatenciesMs: [],
				syntheticRowsRemaining: 1,
				claimedJobs: 0,
			}),
			staleLeaseProbePerformed: false,
			diagnostics: [`setup:${kind}`],
		});
	} finally {
		if (writesStarted) cleanup = await cleanupSyntheticData(pool, purpose, workerIds);
		await pool.end().catch(() => undefined);
	}

	printLevelTable(levelResults);
	if (!databaseGuardPassed) return 1;
	if (!cleanup.passed && cleanup.errorCode) overallFailures.push("cleanup_failed");
	const passed =
		cleanup.passed &&
		overallFailures.length === 0 &&
		levelResults.length > 0 &&
		levelResults.every((level) => level.measured.passed);
	try {
		await writeSummary(runId, levelResults, cleanup, overallFailures);
	} catch {
		return 1;
	}
	return passed ? 0 : 1;
}

async function main(): Promise<void> {
	try {
		const exitCode = await runConcurrencyLoad();
		process.exitCode = exitCode;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Concurrency load guard failed";
		console.error(message);
		process.exitCode = 1;
	}
}

const entrypoint = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entrypoint && path.resolve(fileURLToPath(import.meta.url)) === entrypoint) {
	void main();
}
