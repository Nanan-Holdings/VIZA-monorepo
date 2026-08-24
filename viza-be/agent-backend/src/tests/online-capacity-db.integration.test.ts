import { EventEmitter } from "node:events";
import { performance } from "node:perf_hooks";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { observePoolQueries } from "../db/connection-config.js";
import { percentile } from "../../scripts/online-capacity-load-lib.js";

const confirm = process.env.ONLINE_CAPACITY_DB_CONFIRM === "local-test";
const databaseUrl = process.env.ONLINE_CAPACITY_DATABASE_URL ?? "";
const nonProductionMarker =
	(process.env.ONLINE_CAPACITY_DB_NONPRODUCTION ?? "").toLowerCase();
const localHost = (() => {
	try {
		const hostname = new URL(databaseUrl).hostname.toLowerCase();
		return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
	} catch {
		return false;
	}
})();
const liveGateEnabled =
	confirm &&
	Boolean(databaseUrl) &&
	localHost &&
	["local", "local-test", "test"].includes(nonProductionMarker);

const delay = (milliseconds: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

describe.skipIf(!liveGateEnabled)("online capacity database integration", () => {
	let pool: Pool;
	let maximumWaiting = 0;

	beforeAll(async () => {
		const emitter = new EventEmitter();
		pool = observePoolQueries(
			new Pool({ connectionString: databaseUrl, max: 3 }),
			emitter,
		);
		emitter.on("db_query_dispatched", () => {
			maximumWaiting = Math.max(maximumWaiting, pool.waitingCount);
		});
		const marker = await pool.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		expect(marker.rows[0]?.environment).toBe("local-test");
	});

	afterAll(async () => {
		await pool?.end();
	});

	it("serves 100 evenly paced synthetic reads without pool waiting", async () => {
		maximumWaiting = 0;
		const durations = await Promise.all(
			Array.from({ length: 100 }, (_, index) =>
				(async () => {
					await delay(Math.floor((5_000 * index) / 100));
					const startedAt = performance.now();
					const result = await pool.query<{ value: number }>("SELECT 1 AS value");
					expect(result.rows[0]?.value).toBe(1);
					return performance.now() - startedAt;
				})(),
			),
		);

		// node-postgres may expose the currently dispatched request as a
		// one-item microqueue; anything above one indicates a real burst backlog.
		expect(maximumWaiting).toBeLessThanOrEqual(1);
		expect(pool.totalCount).toBeLessThanOrEqual(3);
		expect(percentile(durations, 0.95)).toBeLessThan(500);
	});
});
