import { Pool, type PoolClient, type QueryResult } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const confirm = process.env.CONCURRENCY_STABLE_SPEED_DB_CONFIRM === "local-test";
const databaseUrl =
	process.env.CONCURRENCY_STABLE_SPEED_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const marker = (process.env.CONCURRENCY_STABLE_SPEED_DB_NONPRODUCTION ?? "").toLowerCase();
const allowedMarkers = new Set(["local", "local-test", "test", "development"]);
const localHost = (() => {
	try {
		const host = new URL(databaseUrl).hostname.toLowerCase();
		return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "supabase";
	} catch {
		return false;
	}
})();
const liveGateEnabled = Boolean(databaseUrl) && confirm && localHost && allowedMarkers.has(marker);

const suiteLockName = "viza-concurrency-stable-speed-integration";
const ownerPrefix = `concurrency-stable-speed-${Date.now()}-`;
const sleep = (milliseconds: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

let pool: Pool | undefined;
let suiteLockClient: PoolClient | undefined;
let applicantId: string | undefined;
let applicationId: string | undefined;
let jobId: string | undefined;

const query = async <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	values: unknown[] = [],
): Promise<QueryResult<T>> => {
	if (!pool) throw new Error("integration pool is not initialized");
	return pool.query<T>(sql, values);
};

describe.skipIf(!liveGateEnabled)("stable concurrency speed database integration", () => {
	beforeAll(async () => {
		pool = new Pool({ connectionString: databaseUrl, max: 8 });
		suiteLockClient = await pool.connect();
		const databaseMarker = await suiteLockClient.query<{ environment: string | null }>(
			"SELECT current_setting('app.viza_environment', true) AS environment",
		);
		const databaseEnvironment = (databaseMarker.rows[0]?.environment ?? "").toLowerCase();
		if (!allowedMarkers.has(databaseEnvironment)) {
			throw new Error(
				`Refusing stable concurrency integration writes: database marker ${databaseEnvironment || "<unset>"} is not local/test`,
			);
		}
		await suiteLockClient.query("SELECT pg_advisory_lock(pg_catalog.hashtext($1))", [suiteLockName]);

		// The explicit local-only gate and advisory lock make this reset safe for
		// a disposable test database while keeping production impossible to reach.
		await query(
			`UPDATE public.runner_machine_slot
			 SET owner_machine_id = NULL,
			     owner_kind = NULL,
			     lease_until = NULL,
			     acquired_at = NULL,
			     updated_at = pg_catalog.clock_timestamp()` ,
		);
	});

	it("renews an exact live owner and returns zero rows for a wrong or expired owner", async () => {
		const machineId = `${ownerPrefix}renew`;
		const reserved = await query<{ slot: number }>(
			"SELECT public.reserve_runner_machine_slot($1, 'pool', 120, pg_catalog.clock_timestamp()) AS slot",
			[machineId],
		);
		const slot = reserved.rows[0]?.slot;
		expect(slot).toBeTypeOf("number");
		if (typeof slot !== "number") throw new Error("local test could not reserve a slot");

		const renewed = await query<{ slot_number: number; lease_until: string }>(
			"SELECT * FROM public.renew_runner_machine_slot($1, 'pool', 120)",
			[machineId],
		);
		expect(renewed.rows).toHaveLength(1);

		const wrongOwner = await query(
			"SELECT * FROM public.renew_runner_machine_slot($1, 'pool', 120)",
			[`${machineId}-wrong`],
		);
		expect(wrongOwner.rows).toHaveLength(0);

		await query(
			"UPDATE public.runner_machine_slot SET lease_until = pg_catalog.clock_timestamp() - INTERVAL '1 second' WHERE slot_number = $1",
			[slot],
		);
		const expired = await query(
			"SELECT * FROM public.renew_runner_machine_slot($1, 'pool', 120)",
			[machineId],
		);
		expect(expired.rows).toHaveLength(0);
	});

	it("samples the clock after an exact-row lock wait that crosses lease expiry", async () => {
		const machineId = `${ownerPrefix}lock-wait`;
		const reserved = await query<{ slot: number }>(
			"SELECT public.reserve_runner_machine_slot($1, 'pool', 120, pg_catalog.clock_timestamp()) AS slot",
			[machineId],
		);
		const slot = reserved.rows[0]?.slot;
		expect(slot).toBeTypeOf("number");
		if (typeof slot !== "number") throw new Error("local test could not reserve a lock-wait slot");

		const lockClient = await pool!.connect();
		try {
			await lockClient.query("BEGIN");
			await lockClient.query(
				`UPDATE public.runner_machine_slot
				 SET lease_until = pg_catalog.clock_timestamp() + INTERVAL '500 milliseconds'
				 WHERE slot_number = $1 AND owner_machine_id = $2 AND owner_kind = 'pool'`,
				[slot, machineId],
			);
			const waitingRenew = query(
				"SELECT * FROM public.renew_runner_machine_slot($1, 'pool', 120)",
				[machineId],
			);
			await sleep(900);
			await lockClient.query("COMMIT");
			const result = await waitingRenew;
			expect(result.rows).toHaveLength(0);
		} finally {
			await lockClient.query("ROLLBACK").catch(() => undefined);
			lockClient.release();
		}
	});

	it("keeps concurrent reserve/sticky/claim operations within the existing ten-slot and cap fences", async () => {
		const reserveResults = await Promise.all(
			Array.from({ length: 12 }, (_, index) =>
				query<{ slot: number }>(
					"SELECT public.reserve_runner_machine_slot($1, 'pool', 120, pg_catalog.clock_timestamp()) AS slot",
					[`${ownerPrefix}pool-${index}`],
				),
			),
		);
		const reservedSlots = reserveResults
			.map((result) => result.rows[0]?.slot)
			.filter((slot): slot is number => typeof slot === "number");
		expect(new Set(reservedSlots).size).toBe(reservedSlots.length);
		expect(reservedSlots.length).toBeLessThanOrEqual(10);

		const sticky = await query<{ slot_number: number }>(
			"SELECT slot_number FROM public.reserve_sticky_runner_machine_slot($1, 'legacy', 120, pg_catalog.clock_timestamp())",
			[`${ownerPrefix}sticky`],
		);
		expect(sticky.rows.length).toBeLessThanOrEqual(1);
		await query(
			"UPDATE public.runner_machine_slot SET owner_machine_id = NULL, owner_kind = NULL, lease_until = NULL, acquired_at = NULL, updated_at = pg_catalog.clock_timestamp() WHERE owner_machine_id LIKE $1",
			[`${ownerPrefix}%`],
		);

		const applicant = await query<{ id: string }>(
			`INSERT INTO public.applicant_profiles (email, full_name)
			 VALUES ($1, 'Stable speed integration')
			 RETURNING id`,
			[`${ownerPrefix}@invalid.test`],
		);
		applicantId = applicant.rows[0]?.id;
		if (!applicantId) throw new Error("local test could not create applicant fixture");
		const application = await query<{ id: string }>(
			`INSERT INTO public.applications (applicant_id, country, visa_type, status)
			 VALUES ($1, 'taiwan', 'tw_entry_permit', 'processing')
			 RETURNING id`,
			[applicantId],
		);
		applicationId = application.rows[0]?.id;
		if (!applicationId) throw new Error("local test could not create application fixture");
		const enqueued = await query<{ runner_job_id: string }>(
			`SELECT runner_job_id
			 FROM public.enqueue_runner_pool_job(
			   $1, 'taiwan', 'tw_entry_permit', pg_catalog.clock_timestamp(), 3,
			   $2, '{}'::jsonb, pg_catalog.clock_timestamp()
			 )`,
			[applicationId, `${ownerPrefix}claim`],
		);
		jobId = enqueued.rows[0]?.runner_job_id;
		if (!jobId) throw new Error("local test could not enqueue a runner fixture");

		// Each strict claim worker must own its exact pool slot. The claim RPC
		// fences worker identity to the slot row, so a shared slot would be an
		// invalid fixture even though the global pool has capacity.
		const claimWorkers = Array.from(
			{ length: 4 },
			(_, index) => `${ownerPrefix}claim-worker-${index}`,
		);
		for (const workerId of claimWorkers) {
			const claimSlot = await query<{ slot: number }>(
				"SELECT public.reserve_runner_machine_slot($1, 'pool', 120, pg_catalog.clock_timestamp()) AS slot",
				[workerId],
			);
			expect(claimSlot.rows[0]?.slot).toBeTypeOf("number");
		}
		const claims = await Promise.all(
			claimWorkers.map((workerId) =>
				query<{ id: string }>(
					"SELECT id FROM public.claim_runner_pool_job($1, 120000, TRUE, pg_catalog.clock_timestamp())",
					[workerId],
				),
			),
		);
		const matchingClaims = claims.flatMap((result) => result.rows).filter((row) => row.id === jobId);
		expect(matchingClaims).toHaveLength(1);

		const queueHealth = await query<{ country: string }>(
			"SELECT country FROM public.runner_pool_concurrency_health ORDER BY country",
		);
		expect(queueHealth.rows.map((row) => row.country)).toEqual([
			"malaysia",
			"singapore",
			"south_korea",
			"taiwan",
			"thailand",
			"vietnam",
		]);
		const slotHealth = await query<{ max_slots: number; live_slots: number; free_slots: number }>(
			"SELECT max_slots, live_slots, free_slots FROM public.runner_slot_capacity_health",
		);
		expect(slotHealth.rows[0]?.max_slots).toBe(10);
		expect((slotHealth.rows[0]?.live_slots ?? 0) + (slotHealth.rows[0]?.free_slots ?? 0)).toBe(10);

		const metric = await query<{ id: string }>(
			`INSERT INTO public.runner_concurrency_metric
			 (event_type, outcome, duration_ms, country, machine_kind, count)
			 VALUES ('claim', 'claimed', 42, 'taiwan', 'pool', 1)
			 RETURNING id`,
		);
		expect(metric.rows).toHaveLength(1);
		await expect(
			query(
				"INSERT INTO public.runner_concurrency_metric (event_type, outcome) VALUES ('renew', 'invalid')",
			),
		).rejects.toThrow();
		await query("DELETE FROM public.runner_concurrency_metric WHERE id = $1", [metric.rows[0]?.id]);

		const anonPrivilege = await query<{ allowed: boolean }>(
			"SELECT has_function_privilege('anon', 'public.renew_runner_machine_slot(text,text,integer)', 'EXECUTE') AS allowed",
		);
		expect(anonPrivilege.rows[0]?.allowed).toBe(false);
	});

	afterAll(async () => {
		if (!pool) return;
		try {
			await query(
				"UPDATE public.runner_machine_slot SET owner_machine_id = NULL, owner_kind = NULL, lease_until = NULL, acquired_at = NULL, updated_at = pg_catalog.clock_timestamp() WHERE owner_machine_id LIKE $1",
				[`${ownerPrefix}%`],
			);
			if (jobId || applicationId || applicantId) {
				const cleanup = await pool.connect();
				try {
					await cleanup.query("BEGIN");
					await cleanup.query("SET LOCAL session_replication_role = 'replica'");
					if (jobId) await cleanup.query("DELETE FROM public.runner_job WHERE id = $1", [jobId]);
					if (applicationId) await cleanup.query("DELETE FROM public.applications WHERE id = $1", [applicationId]);
					if (applicantId) await cleanup.query("DELETE FROM public.applicant_profiles WHERE id = $1", [applicantId]);
					await cleanup.query("COMMIT");
				} finally {
					await cleanup.query("ROLLBACK").catch(() => undefined);
					cleanup.release();
				}
			}
		} finally {
			if (suiteLockClient) {
				await suiteLockClient
					.query("SELECT pg_advisory_unlock(pg_catalog.hashtext($1))", [suiteLockName])
					.catch(() => undefined);
				suiteLockClient.release();
			}
			await pool.end();
		}
	});
});
