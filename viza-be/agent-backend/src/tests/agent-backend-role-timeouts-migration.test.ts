import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0160_agent_backend_role_timeouts.sql", import.meta.url),
);
const mirrorDirectory = fileURLToPath(
	new URL("../../../../viza-fe/internal-website/supabase/migrations/", import.meta.url),
);
const mirrorNames = existsSync(mirrorDirectory)
	? readdirSync(mirrorDirectory).filter((name) => /_agent_backend_role_timeouts\.sql$/i.test(name))
	: [];
const mirrorPath = mirrorNames[0] ? join(mirrorDirectory, mirrorNames[0]) : undefined;
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = mirrorPath && existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";

describe("agent-backend role timeout migration", () => {
	it("ships one byte-identical canonical and Supabase CLI mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(mirrorNames).toHaveLength(1);
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("sets only the two evidence-backed postgres role defaults", () => {
		expect(canonicalSql).toMatch(
			/ALTER ROLE postgres SET statement_timeout = '30s';/i,
		);
		expect(canonicalSql).toMatch(
			/ALTER ROLE postgres SET idle_in_transaction_session_timeout = '30s';/i,
		);
		expect(canonicalSql).not.toMatch(/ALTER ROLE postgres SET (?:lock_timeout|idle_session_timeout)/i);
		expect(canonicalSql).not.toMatch(/ALTER SYSTEM/i);
	});

	it("fails closed unless maintenance has switched to the postgres role", () => {
		expect(canonicalSql).toMatch(/current_user\s*<>\s*'postgres'/i);
		expect(canonicalSql).toMatch(/must run after SET ROLE postgres/i);
	});

	it("records the reconnect and exact multi-connection postflight contract", () => {
		expect(canonicalSql).toMatch(/defaults apply only to new database sessions/i);
		expect(canonicalSql).toMatch(
			/POSTFLIGHT-CONTRACT: recycle=application_pool,supavisor_backend; new_connection_samples=3/i,
		);
		expect(canonicalSql).toMatch(/recycle[^\n]*application pool[^\n]*Supavisor backend connections/i);
		expect(canonicalSql).toMatch(/at least three new connections/i);
		expect(canonicalSql).toMatch(/SHOW statement_timeout/i);
		expect(canonicalSql).toMatch(/SHOW idle_in_transaction_session_timeout/i);
		expect(canonicalSql).toMatch(/pg_roles[^\n]*rolconfig/i);
		expect(canonicalSql).toMatch(/do not restart (?:PostgreSQL|the database)/i);
	});

	it("does not mutate application data or terminate live sessions", () => {
		expect(canonicalSql).not.toMatch(
			/\b(?:CREATE|DROP|TRUNCATE|DELETE|INSERT|UPDATE)\s+(?:TABLE|FROM|INTO|public\.)/i,
		);
		expect(canonicalSql).not.toMatch(/pg_(?:terminate|cancel)_backend/i);
	});
});
