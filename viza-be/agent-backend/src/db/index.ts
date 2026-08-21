import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { EventEmitter } from "node:events";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
	buildDatabasePoolConfig,
	observePoolQueries,
} from "./connection-config.js";
import * as schema from "./schema.js";

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

// Event emitter for redacted database telemetry consumed by the debug UI and
// health instrumentation. Events never include SQL text or parameter values.
export const dbLogEmitter = new EventEmitter();

// Get project root and load .env.local (with .env as fallback).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../../.env.local") });
dotenv.config({ path: join(__dirname, "../../.env") });

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

export const db = drizzle(pool, { schema });
