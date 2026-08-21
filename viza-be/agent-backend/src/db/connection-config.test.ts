import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
	buildDatabasePoolConfig,
	createSafeQueryTelemetry,
	describeParameterTypes,
	fingerprintSql,
	loadPinnedSupabaseCa,
	observePoolQueries,
	SUPABASE_PRODUCTION_CA_SHA256,
} from "./connection-config.js";

const INVALID_CA = "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n";

describe("database connection configuration", () => {
	it("requires an exact shared Supabase transaction pooler in production", () => {
		const ca = loadPinnedSupabaseCa();
		const config = buildDatabasePoolConfig(
			{
				NODE_ENV: "production",
				DATABASE_URL:
					"postgresql://postgres.oyjxdzsoejraedqghndi:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&application_name=unsafe",
				DB_POOL_MAX: "99",
				DB_IDLE_IN_TRANSACTION_TIMEOUT_MS: "45000",
				DB_APPLICATION_NAME: "viza backend/production",
			},
			() => ca,
		);

		expect(config.connectionString).toBe(
			"postgresql://postgres.oyjxdzsoejraedqghndi:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
		);
		expect(config.max).toBe(20);
		expect(config.application_name).toBe("viza_backend_production");
		expect(config.idle_in_transaction_session_timeout).toBe(45_000);
		expect(config.ssl).toEqual({ ca, rejectUnauthorized: true });
	});

	it("accepts the dedicated transaction pooler form", () => {
		const ca = loadPinnedSupabaseCa();
		const config = buildDatabasePoolConfig(
			{
				NODE_ENV: "production",
				DATABASE_URL:
					"postgres://postgres:secret@db.oyjxdzsoejraedqghndi.supabase.co:6543/postgres",
			},
			() => ca,
		);

		expect(config.ssl).toEqual({ ca, rejectUnauthorized: true });
	});

	it.each([
		[
			"session pooler",
			"postgresql://postgres.oyjxdzsoejraedqghndi:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
		],
		[
			"direct endpoint",
			"postgresql://postgres:secret@db.oyjxdzsoejraedqghndi.supabase.co:5432/postgres",
		],
		["unmanaged database", "postgresql://postgres:secret@database.example.com:6543/postgres"],
		[
			"invalid shared-pooler user",
			"postgresql://postgres:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
		],
		[
			"wrong Supabase project",
			"postgresql://postgres.abcdefghijklmnopqrst:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
		],
	])("rejects a production %s URL", (_name, databaseUrl) => {
		expect(() =>
			buildDatabasePoolConfig(
				{ NODE_ENV: "production", DATABASE_URL: databaseUrl },
				loadPinnedSupabaseCa,
			),
		).toThrow(/transaction pooler/i);
	});

	it("keeps local non-production databases compatible without TLS", () => {
		const config = buildDatabasePoolConfig({
			NODE_ENV: "test",
			DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
		});

		expect(config.connectionString).toBe(
			"postgresql://postgres:postgres@127.0.0.1:54322/postgres",
		);
		expect(config.ssl).toBeUndefined();
	});

	it("still verifies remote Supabase TLS outside production", () => {
		const ca = loadPinnedSupabaseCa();
		const config = buildDatabasePoolConfig(
			{
				NODE_ENV: "staging",
				DATABASE_URL:
					"postgresql://postgres.stagingref1234567890:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
			},
			() => ca,
		);

		expect(config.ssl).toEqual({ ca, rejectUnauthorized: true });
	});
});

describe("pinned Supabase CA", () => {
	it("normalizes line endings and verifies the pinned hash", () => {
		const officialPem = loadPinnedSupabaseCa();

		expect(SUPABASE_PRODUCTION_CA_SHA256).toBe(
			"700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7",
		);
		expect(
			loadPinnedSupabaseCa({ readFile: () => officialPem.replaceAll("\n", "\r\n") }),
		).toBe(officialPem);
	});

	it("fails closed when the public CA asset changes", () => {
		expect(() => loadPinnedSupabaseCa({ readFile: () => INVALID_CA })).toThrow(
			/pinned Supabase CA/i,
		);
	});
});

describe("redacted query telemetry", () => {
	it("emits only a fingerprint, parameter shape, duration, and result", () => {
		const telemetry = createSafeQueryTelemetry(
			"select * from applicants where passport_number = $1 and id = $2",
			["E99990000", 42, null, ["secret"]],
			12.345,
			"ok",
		);

		expect(telemetry).toEqual({
			fingerprint: fingerprintSql(
				"select * from applicants where passport_number = $1 and id = $2",
			),
			parameterCount: 4,
			parameterTypes: ["string", "number", "null", "array"],
			durationMs: 12.35,
			result: "ok",
		});
		expect(JSON.stringify(telemetry)).not.toContain("E99990000");
		expect(describeParameterTypes([Buffer.from("secret"), new Date(), 1n])).toEqual([
			"buffer",
			"date",
			"bigint",
		]);
	});

	it("observes promise queries without exposing SQL or parameters", async () => {
		const emitter = new EventEmitter();
		const events: unknown[] = [];
		emitter.on("db_query", (event) => events.push(event));
		const query = vi.fn().mockResolvedValue({ rows: [] });
		const pool = { query };
		observePoolQueries(pool, emitter);

		await pool.query("select * from applicants where passport_number = $1", [
			"E99990000",
		]);

		expect(events).toHaveLength(1);
		expect(JSON.stringify(events[0])).not.toMatch(/applicants|E99990000/i);
		expect(events[0]).toMatchObject({
			parameterCount: 1,
			parameterTypes: ["string"],
			result: "ok",
		});
	});
});
