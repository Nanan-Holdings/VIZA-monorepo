import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Logger as DrizzleLogger } from "drizzle-orm/logger";
import { EventEmitter } from "events";

// Event emitter for broadcasting database queries to debug UI
export const dbLogEmitter = new EventEmitter();

class QueryLogger implements DrizzleLogger {
	logQuery(query: string, params: unknown[]): void {
		dbLogEmitter.emit("db_query", {
			query: query.substring(0, 500),
			params: params.slice(0, 5),
			timestamp: Date.now(),
		});
	}
}

// Get project root and load .env.local (with .env as fallback)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../../.env.local") });
dotenv.config({ path: join(__dirname, "../../.env") });

// Use DATABASE_URL from environment (supports both direct and pooled connections)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error(
		"DATABASE_URL is required. Get your database connection string from:\n" +
		"Supabase Dashboard → Project Settings → Database → Connection String\n" +
		"Use either 'Direct connection' or 'Transaction pooler' depending on your needs."
	);
}

function readBoundedInteger(
	names: readonly string[],
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	const configured = names
		.map((name) => process.env[name]?.trim())
		.find((value) => value);
	if (!configured) return fallback;

	const parsed = Number(configured);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

// Keep the pool finite and fail fast under connection/query pressure. Every
// timeout is clamped to a positive upper bound so an accidental `0` or an
// unreasonably large deployment value cannot restore unbounded work.
const poolMax = readBoundedInteger(
	["DB_POOL_MAX", "PG_POOL_MAX", "PGPOOL_MAX", "DATABASE_POOL_MAX"],
	20,
	1,
	100,
);
const connectionTimeoutMillis = readBoundedInteger(
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
const queryTimeoutMillis = readBoundedInteger(
	[
		"DB_QUERY_TIMEOUT_MS",
		"DB_POOL_QUERY_TIMEOUT_MS",
		"PG_QUERY_TIMEOUT_MS",
		"DATABASE_QUERY_TIMEOUT_MS",
		"QUERY_TIMEOUT_MS",
	],
	30_000,
	1_000,
	60_000,
);
const statementTimeoutMillis = readBoundedInteger(
	[
		"DB_STATEMENT_TIMEOUT_MS",
		"DB_POOL_STATEMENT_TIMEOUT_MS",
		"PG_STATEMENT_TIMEOUT_MS",
		"DATABASE_STATEMENT_TIMEOUT_MS",
		"STATEMENT_TIMEOUT_MS",
	],
	queryTimeoutMillis,
	1_000,
	60_000,
);

const pool = new Pool({
	connectionString,
	max: poolMax,
	connectionTimeoutMillis,
	idleTimeoutMillis,
	query_timeout: queryTimeoutMillis,
	statement_timeout: statementTimeoutMillis,
	ssl: connectionString.includes("supabase")
		? { rejectUnauthorized: false }
		: undefined,
});

export const db = drizzle(pool, { schema, logger: new QueryLogger() });
