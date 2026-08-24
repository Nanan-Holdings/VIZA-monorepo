import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const canonicalPath = fileURLToPath(
	new URL("../../drizzle/0170_chat_rls_initplan.sql", import.meta.url),
);
const mirrorDirectory = fileURLToPath(
	new URL("../../../../viza-fe/internal-website/supabase/migrations/", import.meta.url),
);
const mirrorName = existsSync(mirrorDirectory)
	? readdirSync(mirrorDirectory).find((name) => /_chat_rls_initplan\.sql$/i.test(name))
	: undefined;
const mirrorPath = mirrorName ? join(mirrorDirectory, mirrorName) : undefined;
const canonicalSql = existsSync(canonicalPath) ? readFileSync(canonicalPath, "utf8") : "";
const mirrorSql = mirrorPath && existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : "";

const policies = [
	["travel_agent_messages", "travel_agent_messages_owner_all"],
	["travel_agent_sessions", "travel_agent_sessions_owner_all"],
	["travel_user_preferences", "travel_user_preferences_owner_all"],
	["user_chat_sessions", "user_chat_sessions_select"],
	["visa_chat_messages", "visa_chat_messages_insert_own"],
	["visa_chat_messages", "visa_chat_messages_select_own"],
	["visa_chat_sessions", "visa_chat_sessions_insert_own"],
	["visa_chat_sessions", "visa_chat_sessions_select_own"],
	["visa_chat_sessions", "visa_chat_sessions_update_own"],
] as const;

describe("chat RLS init-plan migration", () => {
	it("ships one byte-identical canonical and Supabase mirror", () => {
		expect(existsSync(canonicalPath)).toBe(true);
		expect(mirrorPath).toBeDefined();
		expect(mirrorSql).toBe(canonicalSql);
	});

	it("alters exactly the nine reviewed chat and travel ownership policies", () => {
		const altered = [...canonicalSql.matchAll(/ALTER POLICY\s+"?([a-z_]+)"?\s+ON\s+public\.([a-z_]+)/gi)]
			.map((match) => [match[2], match[1]])
			.sort();
		expect(altered).toEqual([...policies].map((entry) => [...entry]).sort());
	});

	it("wraps all thirteen auth identity calls in scalar select init plans", () => {
		expect([...canonicalSql.matchAll(/auth\.uid\(\)/gi)]).toHaveLength(13);
		expect(canonicalSql.match(/\(select auth\.uid\(\)\)/gi)).toHaveLength(13);
		expect(canonicalSql.replaceAll(/\(select auth\.uid\(\)\)/gi, "")).not.toMatch(/auth\.uid\(\)/i);
	});

	it("does not change policy identity, service policy, or application data", () => {
		expect(canonicalSql).not.toMatch(/user_chat_sessions_service/i);
		expect(canonicalSql).not.toMatch(/\b(?:CREATE|DROP)\s+POLICY\b/i);
		expect(canonicalSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
		expect(canonicalSql).not.toMatch(/\b(?:GRANT|REVOKE|ALTER TABLE)\b/i);
	});
});
