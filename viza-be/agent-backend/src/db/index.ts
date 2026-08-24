import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { EventEmitter } from "node:events";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Pool } from "pg";
import {
	buildDatabasePoolConfig,
	observePoolQueries,
	readDatabaseRuntimeGuardExpectations,
	verifyDatabaseRoleTimeoutSamples,
	type SafeQueryTelemetry,
} from "./connection-config.js";
import * as schema from "./schema.js";

// Get project root and load .env.local (with .env as fallback).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../../.env.local") });
dotenv.config({ path: join(__dirname, "../../.env") });

export type DatabasePoolState = "open" | "closing" | "closed" | "error";

export interface DatabasePoolMetrics {
	state: DatabasePoolState;
	maxConnections: number;
	totalConnections: number;
	activeConnections: number;
	idleConnections: number;
	waitingRequests: number;
	utilizationPercent: number;
}

export interface DatabaseQueryMetrics {
	totalQueries: number;
	failedQueries: number;
	slowQueries: number;
	slowThresholdMs: number;
	p95DurationMs: number;
	maxDurationMs: number;
	topSlowFingerprints: Array<{
		fingerprint: string;
		count: number;
		p95DurationMs: number;
	}>;
}

// Event emitter for redacted database telemetry consumed by the debug UI and
// health instrumentation. Events never include SQL text or parameter values.
export const dbLogEmitter = new EventEmitter();

const QUERY_SAMPLE_LIMIT = 1_024;
const FINGERPRINT_LIMIT = 128;
const configuredSlowThreshold = Number(process.env.DB_SLOW_QUERY_MS ?? 500);
const slowQueryThresholdMs =
	Number.isFinite(configuredSlowThreshold) && configuredSlowThreshold >= 100
		? Math.min(30_000, Math.floor(configuredSlowThreshold))
		: 500;
const queryDurations: number[] = [];
const slowFingerprintDurations = new Map<
	string,
	{ count: number; durations: number[] }
>();
let totalQueries = 0;
let failedQueries = 0;
let slowQueries = 0;

function metricPercentile(samples: readonly number[], quantile: number): number {
	if (samples.length === 0) return 0;
	const sorted = [...samples].sort((left, right) => left - right);
	const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
	return Math.round((sorted[Math.max(index, 0)] ?? 0) * 100) / 100;
}

function appendBounded(samples: number[], value: number): void {
	samples.push(value);
	if (samples.length > QUERY_SAMPLE_LIMIT) samples.shift();
}

function isSafeQueryTelemetry(value: unknown): value is SafeQueryTelemetry {
	if (!value || typeof value !== "object") return false;
	const event = value as Partial<SafeQueryTelemetry>;
	return (
		typeof event.fingerprint === "string" &&
		/^[a-f0-9]{64}$/u.test(event.fingerprint) &&
		typeof event.durationMs === "number" &&
		Number.isFinite(event.durationMs) &&
		event.durationMs >= 0 &&
		(event.result === "ok" || event.result === "error")
	);
}

dbLogEmitter.on("db_query", (value: unknown) => {
	if (!isSafeQueryTelemetry(value)) return;
	totalQueries += 1;
	if (value.result === "error") failedQueries += 1;
	appendBounded(queryDurations, value.durationMs);
	if (value.durationMs < slowQueryThresholdMs) return;

	slowQueries += 1;
	let fingerprintState = slowFingerprintDurations.get(value.fingerprint);
	if (!fingerprintState) {
		if (slowFingerprintDurations.size >= FINGERPRINT_LIMIT) {
			const oldest = slowFingerprintDurations.keys().next().value as string | undefined;
			if (oldest) slowFingerprintDurations.delete(oldest);
		}
		fingerprintState = { count: 0, durations: [] };
		slowFingerprintDurations.set(value.fingerprint, fingerprintState);
	}
	fingerprintState.count += 1;
	appendBounded(fingerprintState.durations, value.durationMs);
});

export function getDatabaseQueryMetrics(): DatabaseQueryMetrics {
	const topSlowFingerprints = [...slowFingerprintDurations.entries()]
		.map(([fingerprint, state]) => ({
			fingerprint,
			count: state.count,
			p95DurationMs: metricPercentile(state.durations, 0.95),
		}))
		.sort((left, right) =>
			right.p95DurationMs - left.p95DurationMs || right.count - left.count,
		)
		.slice(0, 10);
	return {
		totalQueries,
		failedQueries,
		slowQueries,
		slowThresholdMs: slowQueryThresholdMs,
		p95DurationMs: metricPercentile(queryDurations, 0.95),
		maxDurationMs: queryDurations.length > 0 ? Math.max(...queryDurations) : 0,
		topSlowFingerprints,
	};
}

const poolConfig = buildDatabasePoolConfig(process.env);
const pool = observePoolQueries(new Pool(poolConfig), dbLogEmitter);
let poolState: DatabasePoolState = "open";
let closePromise: Promise<void> | null = null;

export function getDatabasePoolMetrics(): DatabasePoolMetrics {
	const activeConnections = Math.max(0, pool.totalCount - pool.idleCount);
	return {
		state: poolState,
		maxConnections: poolConfig.max,
		totalConnections: pool.totalCount,
		activeConnections,
		idleConnections: pool.idleCount,
		waitingRequests: pool.waitingCount,
		utilizationPercent:
			Math.round((activeConnections / poolConfig.max) * 10_000) / 100,
	};
}

pool.on("error", (error: Error & { code?: string }) => {
	const event = {
		name: error.name || "Error",
		code: error.code ?? "UNKNOWN",
		timestamp: Date.now(),
		pool: getDatabasePoolMetrics(),
	};
	dbLogEmitter.emit("db_pool_error", event);
	console.error("database_pool_idle_client_error", event);
});

export function closeDatabase(): Promise<void> {
	if (closePromise) return closePromise;
	poolState = "closing";
	closePromise = pool.end().then(
		() => {
			poolState = "closed";
		},
		(error: unknown) => {
			poolState = "error";
			throw error;
		},
	);
	return closePromise;
}

export async function verifyDatabaseRuntimeGuards(): Promise<{
	samplesVerified: number;
	statementTimeoutMs: number;
	idleInTransactionTimeoutMs: number;
} | null> {
	if (process.env.NODE_ENV !== "production") return null;

	return verifyDatabaseRoleTimeoutSamples(
		() => {
			const client = new Client(poolConfig);
			return {
				connect: () => client.connect(),
				query: async (sql) => {
					const result = await client.query<Record<string, unknown>>(sql);
					return { rows: result.rows };
				},
				close: () => client.end(),
			};
		},
		readDatabaseRuntimeGuardExpectations(process.env),
	);
}

export const db = drizzle(pool, { schema });
