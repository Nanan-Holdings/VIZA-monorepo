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

const pool = new Pool({
	connectionString,
	ssl: connectionString.includes("supabase")
		? { rejectUnauthorized: false }
		: undefined,
});

export const db = drizzle(pool, { schema, logger: new QueryLogger() });
