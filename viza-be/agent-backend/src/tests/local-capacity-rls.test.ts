import { describe, expect, it } from "vitest";
import { validateLocalRlsTarget } from "../../scripts/local-capacity-rls.js";

const target = "postgresql://capacity_test:synthetic@127.0.0.1:55432/capacity_test";
const environment = (): NodeJS.ProcessEnv => ({
	ONLINE_CAPACITY_RLS_CONFIRM: "local-test",
	ONLINE_CAPACITY_RLS_NONPRODUCTION: "local-test",
	ONLINE_CAPACITY_RLS_DATABASE_URL: target,
});

describe("local business RLS diagnostic target", () => {
	it("accepts only the explicit dedicated local target", () => {
		expect(validateLocalRlsTarget(environment())).toBe(target);
		expect(validateLocalRlsTarget({ ...environment(), ONLINE_CAPACITY_RLS_DATABASE_URL: target.replace("127.0.0.1", "[::1]") })).toContain("[::1]");
	});
	it("never falls back to the application's database", () => {
		const env = environment();
		delete env.ONLINE_CAPACITY_RLS_DATABASE_URL;
		env.DATABASE_URL = "postgresql://redacted@production.invalid/postgres";
		expect(() => validateLocalRlsTarget(env)).toThrow("database_url_missing");
	});
	it.each([
		["ONLINE_CAPACITY_RLS_CONFIRM", "", "confirmation_missing"],
		["ONLINE_CAPACITY_RLS_NONPRODUCTION", "production", "nonproduction_marker_missing"],
	])("rejects missing confirmation %s", (key, value, error) => {
		expect(() => validateLocalRlsTarget({ ...environment(), [key]: value })).toThrow(error);
	});
	it.each([
		[target + "?host=production.invalid", "database_options_not_allowed"],
		[target + "?options=-csearch_path%3Dpublic", "database_options_not_allowed"],
		[target + "#hidden", "database_options_not_allowed"],
		[target.replace("127.0.0.1", "localhost"), "database_not_literal_loopback"],
		[target.replace("127.0.0.1", "production.invalid"), "database_not_literal_loopback"],
		[target.replace(/\/capacity_test$/u, "/postgres"), "database_name_not_dedicated"],
		[target.replace("capacity_test:synthetic", "postgres:synthetic"), "database_credentials_not_dedicated"],
		[target.replace(":synthetic", ""), "database_credentials_not_dedicated"],
		[target.replace(":55432", ""), "database_port_required"],
		[target.replace("postgresql:", "https:"), "database_protocol_invalid"],
	])("rejects an unsafe or ambiguous target %s", (url, error) => {
		expect(() => validateLocalRlsTarget({ ...environment(), ONLINE_CAPACITY_RLS_DATABASE_URL: url })).toThrow(error);
	});
});
