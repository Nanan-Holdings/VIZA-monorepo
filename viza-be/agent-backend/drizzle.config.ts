import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

/**
 * Drizzle Kit Configuration for Supabase
 *
 * This config is ONLY used for drizzle-kit commands:
 *   - `npm run db:generate` - Generate migration files
 *   - `npm run db:push` - Push schema to database
 *
 * For runtime database operations, you can use either:
 *   1. Supabase Client (supabase-client.ts) - Uses REST API, no DATABASE_URL needed
 *   2. Drizzle ORM (db/index.ts) - Direct PostgreSQL, requires DATABASE_URL
 *
 * To get DATABASE_URL:
 *   1. Supabase Dashboard → Settings → Database → Connection String
 *   2. Copy URI with "Use connection pooling" enabled
 *   3. Replace [YOUR-PASSWORD] with your database password
 *
 * Format: postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	console.error(`
╔═══════════════════════════════════════════════════════════════════╗
║  DATABASE_URL required for drizzle-kit commands                  ║
╚═══════════════════════════════════════════════════════════════════╝

This error only affects schema migrations (drizzle-kit).
For regular database operations, use Supabase Client (supabase-client.ts).

To enable migrations, add DATABASE_URL to .env:
  
  1. Go to: Supabase Dashboard → Settings → Database
  2. Under "Connection string", click "URI" tab  
  3. Check "Use connection pooling"
  4. Copy and replace [YOUR-PASSWORD] with your database password
  5. Add to .env:
     DATABASE_URL=postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres

Alternative: Run migrations manually in Supabase SQL Editor (see database/migrations/*.sql)
	`);
	throw new Error("DATABASE_URL is required for drizzle-kit");
}

// Supabase project: https://oyjxdzsoejraedqghndi.supabase.co
// DATABASE_URL format: postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
export default {
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: connectionString,
	},
} satisfies Config;
