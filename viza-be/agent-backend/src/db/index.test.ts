import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const poolMocks = vi.hoisted(() => ({
	end: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
	instance: null as EventEmitter & {
		totalCount: number;
		idleCount: number;
		waitingCount: number;
	} | null,
}));

vi.mock("pg", async () => {
	const { EventEmitter: MockEventEmitter } = await import("node:events");
	class MockPool extends MockEventEmitter {
		totalCount = 3;
		idleCount = 1;
		waitingCount = 2;
		query = vi.fn().mockResolvedValue({ rows: [] });
		end = poolMocks.end;

		constructor() {
			super();
			poolMocks.instance = this;
		}
	}
	return { Pool: MockPool };
});

vi.mock("drizzle-orm/node-postgres", () => ({
	drizzle: vi.fn(() => ({ kind: "mock-drizzle" })),
}));

describe("database pool lifecycle", () => {
	const originalNodeEnv = process.env.NODE_ENV;
	const originalDatabaseUrl = process.env.DATABASE_URL;

	beforeAll(() => {
		process.env.NODE_ENV = "test";
		process.env.DATABASE_URL =
			"postgresql://postgres:postgres@127.0.0.1:54322/postgres";
	});

	afterAll(() => {
		if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = originalNodeEnv;
		if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = originalDatabaseUrl;
	});

	it("reports redacted aggregate health metrics and closes once", async () => {
		const database = await import("./index.js");

		expect(database.getDatabasePoolMetrics()).toEqual({
			state: "open",
			maxConnections: 3,
			totalConnections: 3,
			activeConnections: 2,
			idleConnections: 1,
			waitingRequests: 2,
			utilizationPercent: 66.67,
		});

		const firstClose = database.closeDatabase();
		const secondClose = database.closeDatabase();
		expect(firstClose).toBe(secondClose);
		await firstClose;
		expect(poolMocks.end).toHaveBeenCalledTimes(1);
		expect(database.getDatabasePoolMetrics().state).toBe("closed");
	});

	it("redacts idle-client errors", async () => {
		const database = await import("./index.js");
		const events: unknown[] = [];
		database.dbLogEmitter.on("db_pool_error", (event) => events.push(event));
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const error = Object.assign(new Error("contains-sensitive-detail"), {
			code: "57P01",
		});

		poolMocks.instance?.emit("error", error);

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({ name: "Error", code: "57P01" });
		expect(JSON.stringify(events[0])).not.toContain("contains-sensitive-detail");
		expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
			"contains-sensitive-detail",
		);
		consoleError.mockRestore();
	});
});

describe("server shutdown contract", () => {
	it("uses the bounded Socket.IO-aware shutdown coordinator", () => {
		const source = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

		expect(source).toMatch(
			/createBoundedServerShutdown\(\{[\s\S]*io,[\s\S]*closeDatabase,[\s\S]*timeoutMs/u,
		);
		expect(source).toMatch(/gracefulShutdownTimeoutMs\s*=\s*5_000/u);
		expect(source).toMatch(/process\.once\('SIGTERM'/u);
		expect(source).toMatch(/process\.once\('SIGINT'/u);
	});
});
