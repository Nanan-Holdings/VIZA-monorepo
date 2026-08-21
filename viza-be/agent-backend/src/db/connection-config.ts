import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { performance } from "node:perf_hooks";
import type { PoolConfig } from "pg";
import { SUPABASE_PRODUCTION_CA_PEM } from "./supabase-production-ca.js";

export const VIZA_PRODUCTION_PROJECT_REF = "oyjxdzsoejraedqghndi";
export const VIZA_PRODUCTION_SHARED_POOLER_HOST =
	"aws-1-ap-south-1.pooler.supabase.com";
export const SUPABASE_PRODUCTION_CA_SHA256 =
	"700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7";

const SUPABASE_SHARED_POOLER_SUFFIX = ".pooler.supabase.com";
const SUPABASE_DIRECT_HOST_PATTERN = /^db\.([a-z0-9]{20})\.supabase\.co$/u;
const SUPABASE_SHARED_USERNAME_PATTERN = /^postgres\.([a-z0-9]{20})$/u;
const TLS_CONNECTION_PARAMETERS = [
	"sslmode",
	"sslcert",
	"sslkey",
	"sslrootcert",
	"sslpassword",
	"sslsni",
] as const;
const OVERRIDDEN_CONNECTION_PARAMETERS = [
	"application_name",
	"fallback_application_name",
	"statement_timeout",
	"query_timeout",
	"idle_in_transaction_session_timeout",
] as const;

export type QueryResultStatus = "ok" | "error";
export type SafeParameterType =
	| "array"
	| "bigint"
	| "boolean"
	| "buffer"
	| "date"
	| "function"
	| "null"
	| "number"
	| "object"
	| "string"
	| "symbol"
	| "undefined";

export interface SafeQueryTelemetry {
	fingerprint: string;
	parameterCount: number;
	parameterTypes: SafeParameterType[];
	durationMs: number;
	result: QueryResultStatus;
}

export interface PinnedCaLoadOptions {
	readFile?: () => string;
}

export interface DatabasePoolConfig extends PoolConfig {
	connectionString: string;
	max: number;
	application_name: string;
	connectionTimeoutMillis: number;
	idleTimeoutMillis: number;
}

export interface DatabaseRuntimeGuardExpectations {
	maximumStatementTimeoutMs: number;
	maximumIdleInTransactionTimeoutMs: number;
}

export interface DatabaseRuntimeGuardResult {
	statementTimeoutMs: number;
	idleInTransactionTimeoutMs: number;
}

interface QueryTarget {
	query: unknown;
}

function normalizePem(pem: string): string {
	return pem.replaceAll("\r\n", "\n");
}

export function loadPinnedSupabaseCa(
	options: PinnedCaLoadOptions = {},
): string {
	const pem = normalizePem((options.readFile ?? (() => SUPABASE_PRODUCTION_CA_PEM))());
	const actualHash = createHash("sha256").update(pem, "utf8").digest("hex");
	if (
		actualHash !== SUPABASE_PRODUCTION_CA_SHA256 ||
		!pem.startsWith("-----BEGIN CERTIFICATE-----\n") ||
		!pem.endsWith("-----END CERTIFICATE-----\n")
	) {
		throw new Error("Pinned Supabase CA asset failed integrity validation.");
	}
	return pem;
}

function requireDatabaseUrl(value: string | undefined): URL {
	if (!value?.trim()) {
		throw new Error(
			"DATABASE_URL is required and must use the Supabase transaction pooler.",
		);
	}

	let databaseUrl: URL;
	try {
		databaseUrl = new URL(value);
	} catch {
		throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
	}
	if (databaseUrl.protocol !== "postgres:" && databaseUrl.protocol !== "postgresql:") {
		throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
	}
	return databaseUrl;
}

function isSupabaseHost(hostname: string): boolean {
	return (
		hostname.endsWith(SUPABASE_SHARED_POOLER_SUFFIX) ||
		SUPABASE_DIRECT_HOST_PATTERN.test(hostname)
	);
}

function assertProductionTransactionPooler(databaseUrl: URL): void {
	const hostname = databaseUrl.hostname.toLowerCase();
	const sharedPooler = hostname.endsWith(SUPABASE_SHARED_POOLER_SUFFIX);
	const directMatch = SUPABASE_DIRECT_HOST_PATTERN.exec(hostname);
	const sharedUserMatch = SUPABASE_SHARED_USERNAME_PATTERN.exec(databaseUrl.username);
	const sharedProjectRef = sharedUserMatch?.[1];
	const dedicatedProjectRef = directMatch?.[1];

	const validSharedPooler =
		sharedPooler &&
		hostname === VIZA_PRODUCTION_SHARED_POOLER_HOST &&
		databaseUrl.port === "6543" &&
		sharedProjectRef === VIZA_PRODUCTION_PROJECT_REF;
	const validDedicatedPooler =
		Boolean(directMatch) &&
		databaseUrl.port === "6543" &&
		databaseUrl.username === "postgres" &&
		dedicatedProjectRef === VIZA_PRODUCTION_PROJECT_REF;

	if (!validSharedPooler && !validDedicatedPooler) {
		throw new Error(
			"Production DATABASE_URL must use VIZA's Supabase transaction pooler on port 6543.",
		);
	}
	if (databaseUrl.pathname !== "/postgres") {
		throw new Error(
			"Production transaction pooler DATABASE_URL must use the /postgres database.",
		);
	}
	if (databaseUrl.search || databaseUrl.hash) {
		throw new Error(
			"Production transaction pooler DATABASE_URL must not contain URL options.",
		);
	}
}

function sanitizeConnectionString(databaseUrl: URL): string {
	const sanitized = new URL(databaseUrl);
	for (const name of TLS_CONNECTION_PARAMETERS) sanitized.searchParams.delete(name);
	for (const name of OVERRIDDEN_CONNECTION_PARAMETERS) {
		sanitized.searchParams.delete(name);
	}
	return sanitized.toString();
}

function readBoundedInteger(
	env: NodeJS.ProcessEnv,
	names: readonly string[],
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	const configured = names
		.map((name) => env[name]?.trim())
		.find((value) => value);
	if (!configured) return fallback;

	const parsed = Number(configured);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

export function buildDatabasePoolConfig(
	env: NodeJS.ProcessEnv,
	loadCa: () => string = loadPinnedSupabaseCa,
): DatabasePoolConfig {
	const databaseUrl = requireDatabaseUrl(env.DATABASE_URL);
	const hostname = databaseUrl.hostname.toLowerCase();
	const production = env.NODE_ENV === "production";
	if (production) assertProductionTransactionPooler(databaseUrl);

	const poolMax = readBoundedInteger(
		env,
		["DB_POOL_MAX", "PG_POOL_MAX", "PGPOOL_MAX", "DATABASE_POOL_MAX"],
		3,
		1,
		20,
	);
	const connectionTimeoutMillis = readBoundedInteger(
		env,
		[
			"DB_CONNECTION_TIMEOUT_MS",
			"DB_POOL_CONNECTION_TIMEOUT_MS",
			"PG_CONNECTION_TIMEOUT_MS",
			"DATABASE_CONNECTION_TIMEOUT_MS",
		],
		2_000,
		250,
		30_000,
	);
	const idleTimeoutMillis = readBoundedInteger(
		env,
		[
			"DB_IDLE_TIMEOUT_MS",
			"DB_POOL_IDLE_TIMEOUT_MS",
			"PG_IDLE_TIMEOUT_MS",
			"DATABASE_IDLE_TIMEOUT_MS",
		],
		30_000,
		1_000,
		300_000,
	);
	const useVerifiedSupabaseTls = isSupabaseHost(hostname);

	return {
		connectionString: sanitizeConnectionString(databaseUrl),
		max: poolMax,
		application_name: "viza-agent-backend",
		connectionTimeoutMillis,
		idleTimeoutMillis,
		...(useVerifiedSupabaseTls
			? { ssl: { ca: loadCa(), rejectUnauthorized: true } }
			: {}),
	};
}

export function readDatabaseRuntimeGuardExpectations(
	env: NodeJS.ProcessEnv,
): DatabaseRuntimeGuardExpectations {
	return {
		maximumStatementTimeoutMs: readBoundedInteger(
			env,
			[
				"DB_STATEMENT_TIMEOUT_MS",
				"DB_POOL_STATEMENT_TIMEOUT_MS",
				"PG_STATEMENT_TIMEOUT_MS",
				"DATABASE_STATEMENT_TIMEOUT_MS",
				"STATEMENT_TIMEOUT_MS",
			],
			30_000,
			1_000,
			60_000,
		),
		maximumIdleInTransactionTimeoutMs: readBoundedInteger(
			env,
			[
				"DB_IDLE_IN_TRANSACTION_TIMEOUT_MS",
				"PG_IDLE_IN_TRANSACTION_TIMEOUT_MS",
				"DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS",
			],
			30_000,
			1_000,
			120_000,
		),
	};
}

function parsePostgresDurationMs(value: unknown): number {
	if (typeof value !== "string") return Number.NaN;
	const match = /^(\d+(?:\.\d+)?)\s*(ms|s|min|h|d)?$/u.exec(value.trim());
	if (!match) return Number.NaN;
	const amount = Number(match[1]);
	const multiplier =
		match[2] === "d"
			? 86_400_000
			: match[2] === "h"
				? 3_600_000
				: match[2] === "min"
					? 60_000
					: match[2] === "s"
						? 1_000
						: 1;
	return amount * multiplier;
}

function assertTimeoutGuard(
	name: string,
	actualMs: number,
	maximumMs: number,
): void {
	if (!Number.isFinite(actualMs) || actualMs <= 0 || actualMs > maximumMs) {
		throw new Error(
			`Database role timeout guard failed for ${name}; expected > 0ms and <= ${maximumMs}ms.`,
		);
	}
}

export async function verifyDatabaseRoleTimeouts(
	query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }>,
	expectations: DatabaseRuntimeGuardExpectations,
): Promise<DatabaseRuntimeGuardResult> {
	await query("BEGIN READ ONLY");
	try {
		const statementResult = await query("SHOW statement_timeout");
		const idleResult = await query("SHOW idle_in_transaction_session_timeout");
		const statementTimeoutMs = parsePostgresDurationMs(
			statementResult.rows[0]?.statement_timeout,
		);
		const idleInTransactionTimeoutMs = parsePostgresDurationMs(
			idleResult.rows[0]?.idle_in_transaction_session_timeout,
		);
		assertTimeoutGuard(
			"statement_timeout",
			statementTimeoutMs,
			expectations.maximumStatementTimeoutMs,
		);
		assertTimeoutGuard(
			"idle_in_transaction_session_timeout",
			idleInTransactionTimeoutMs,
			expectations.maximumIdleInTransactionTimeoutMs,
		);
		return { statementTimeoutMs, idleInTransactionTimeoutMs };
	} finally {
		await query("ROLLBACK");
	}
}

export function fingerprintSql(query: string): string {
	return createHash("sha256").update(query, "utf8").digest("hex");
}

function describeParameter(value: unknown): SafeParameterType {
	if (value === null) return "null";
	if (Buffer.isBuffer(value)) return "buffer";
	if (value instanceof Date) return "date";
	if (Array.isArray(value)) return "array";

	const type = typeof value;
	if (
		type === "bigint" ||
		type === "boolean" ||
		type === "function" ||
		type === "number" ||
		type === "string" ||
		type === "symbol" ||
		type === "undefined"
	) {
		return type;
	}
	return "object";
}

export function describeParameterTypes(params: readonly unknown[]): SafeParameterType[] {
	return params.map(describeParameter);
}

export function createSafeQueryTelemetry(
	query: string,
	params: readonly unknown[],
	durationMs: number,
	result: QueryResultStatus,
): SafeQueryTelemetry {
	return {
		fingerprint: fingerprintSql(query),
		parameterCount: params.length,
		parameterTypes: describeParameterTypes(params),
		durationMs: Math.round(durationMs * 100) / 100,
		result,
	};
}

function extractQueryShape(args: readonly unknown[]): {
	query: string;
	params: readonly unknown[];
} | null {
	const first = args[0];
	if (typeof first === "string") {
		return { query: first, params: Array.isArray(args[1]) ? args[1] : [] };
	}
	if (typeof first !== "object" || first === null || !("text" in first)) {
		return null;
	}
	const query = first.text;
	if (typeof query !== "string") return null;
	const params = "values" in first && Array.isArray(first.values) ? first.values : [];
	return { query, params };
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
	return (
		(typeof value === "object" && value !== null && "then" in value &&
			typeof value.then === "function") ||
		(typeof value === "function" && "then" in value && typeof value.then === "function")
	);
}

export function observePoolQueries<T extends QueryTarget>(
	pool: T,
	emitter: EventEmitter,
): T {
	if (typeof pool.query !== "function") {
		throw new Error("Database pool query method is unavailable.");
	}

	const target = pool as unknown as {
		query: (...args: unknown[]) => unknown;
	};
	const originalQuery = target.query.bind(pool);
	target.query = (...originalArgs: unknown[]): unknown => {
		const shape = extractQueryShape(originalArgs);
		if (!shape) return originalQuery(...originalArgs);

		const startedAt = performance.now();
		const emit = (result: QueryResultStatus): void => {
			emitter.emit(
				"db_query",
				createSafeQueryTelemetry(
					shape.query,
					shape.params,
					performance.now() - startedAt,
					result,
				),
			);
		};
		const args = [...originalArgs];
		const lastIndex = args.length - 1;
		const callback = args[lastIndex];
		if (typeof callback === "function") {
			args[lastIndex] = (...callbackArgs: unknown[]): unknown => {
				emit(callbackArgs[0] ? "error" : "ok");
				return callback(...callbackArgs);
			};
		}

		try {
			const result = originalQuery(...args);
			if (!isPromiseLike(result)) return result;
			return Promise.resolve(result).then(
				(value) => {
					emit("ok");
					return value;
				},
				(error: unknown) => {
					emit("error");
					throw error;
				},
			);
		} catch (error) {
			emit("error");
			throw error;
		}
	};

	return pool;
}
