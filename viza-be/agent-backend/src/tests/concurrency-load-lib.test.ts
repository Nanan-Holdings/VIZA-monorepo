import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	evaluateConcurrencyRun,
	isCompleteConcurrencyMatrix,
	percentile,
} from "../../scripts/concurrency-load-lib.js";
import {
	parseStagingDatabaseMarker,
	resolveLoadResultsPath,
	validateConcurrencyLoadGuards,
	FLOW_KEY_BY_COUNTRY,
} from "../../scripts/concurrency-load.js";

describe("concurrency load release evaluator", () => {
	const harnessSource = readFileSync(
		path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts/concurrency-load.ts"),
		"utf8",
	);
	it("blocks release when any concurrency invariant fails", () => {
		const result = evaluateConcurrencyRun({
			jobs: 100,
			duplicateClaims: 1,
			countryCapOvershoots: 0,
			globalSlotOvershoots: 0,
			staleLeaseWrites: 0,
			databaseErrors: 0,
			lockTimeouts: 0,
			connectionExhaustions: 0,
			claimLatenciesMs: [20, 30, 40],
			successfulClaimLatenciesMs: [20, 30, 40],
			syntheticRowsRemaining: 0,
			claimedJobs: 100,
			settledJobs: 100,
			failedSettlements: 0,
			capsRestoredExactly: true,
			staleLeaseProbePassed: true,
		});

		expect(result).toMatchObject({
			passed: false,
			failures: ["duplicate_claims"],
		});
	});

	it("calculates p95 and passes the approved matrix", () => {
		const result = evaluateConcurrencyRun({
			jobs: 1000,
			duplicateClaims: 0,
			countryCapOvershoots: 0,
			globalSlotOvershoots: 0,
			staleLeaseWrites: 0,
			databaseErrors: 0,
			lockTimeouts: 0,
			connectionExhaustions: 0,
			claimLatenciesMs: Array.from({ length: 100 }, (_, i) => i + 1),
			successfulClaimLatenciesMs: Array.from({ length: 100 }, (_, i) => i + 1),
			syntheticRowsRemaining: 0,
			claimedJobs: 1000,
			settledJobs: 1000,
			failedSettlements: 0,
			capsRestoredExactly: true,
			staleLeaseProbePassed: true,
		});

		expect(result.p95ClaimMs).toBe(95);
		expect(result.passed).toBe(true);
		expect(result.failures).toEqual([]);
	});

	it("uses a deterministic nearest-rank percentile and handles boundaries", () => {
		expect(percentile([4, 1, 3, 2], 0.5)).toBe(2);
		expect(percentile([1, 2, 3, 4], 0.95)).toBe(4);
		expect(percentile([499], 0.95)).toBe(499);
		expect(percentile([500], 0.95)).toBe(500);
		expect(percentile([], 0.95)).toBe(0);
	});

	it("fails at 500 ms but passes at 499 ms", () => {
		const base = {
			jobs: 1,
			duplicateClaims: 0,
			countryCapOvershoots: 0,
			globalSlotOvershoots: 0,
			staleLeaseWrites: 0,
			databaseErrors: 0,
			lockTimeouts: 0,
			connectionExhaustions: 0,
			syntheticRowsRemaining: 0,
			claimedJobs: 1,
			settledJobs: 1,
			failedSettlements: 0,
			capsRestoredExactly: true,
			staleLeaseProbePassed: true,
		};

		expect(
			evaluateConcurrencyRun({ ...base, claimLatenciesMs: [499], successfulClaimLatenciesMs: [499] }),
		).toMatchObject({ passed: true, p95ClaimMs: 499, failures: [] });
		expect(
			evaluateConcurrencyRun({ ...base, claimLatenciesMs: [500], successfulClaimLatenciesMs: [500] }),
		).toMatchObject({
			passed: false,
			p95ClaimMs: 500,
			failures: ["claim_latency_p95"],
		});
	});

	it("reports missing claim latency only when jobs were expected", () => {
		expect(
			evaluateConcurrencyRun({
				jobs: 0,
				duplicateClaims: 0,
				countryCapOvershoots: 0,
				globalSlotOvershoots: 0,
				staleLeaseWrites: 0,
				databaseErrors: 0,
				lockTimeouts: 0,
				connectionExhaustions: 0,
				claimLatenciesMs: [],
				successfulClaimLatenciesMs: [],
				syntheticRowsRemaining: 0,
				claimedJobs: 0,
				settledJobs: 0,
				failedSettlements: 0,
				capsRestoredExactly: true,
				staleLeaseProbePassed: true,
			}),
		).toMatchObject({ passed: true, p95ClaimMs: 0, failures: [] });

		expect(
			evaluateConcurrencyRun({
				jobs: 1,
				duplicateClaims: 0,
				countryCapOvershoots: 0,
				globalSlotOvershoots: 0,
				staleLeaseWrites: 0,
				databaseErrors: 0,
				lockTimeouts: 0,
				connectionExhaustions: 0,
				claimLatenciesMs: [],
				successfulClaimLatenciesMs: [],
				syntheticRowsRemaining: 0,
				claimedJobs: 1,
				settledJobs: 1,
				failedSettlements: 0,
				capsRestoredExactly: true,
				staleLeaseProbePassed: true,
			}),
		).toMatchObject({
				passed: false,
				p95ClaimMs: 0,
				failures: ["missing_claim_latencies"],
			});
	});

	it("fails closed before a database connection when staging guards are absent", () => {
		const validEnvironment = {
			CONCURRENCY_LOAD_CONFIRM: "staging-only",
			CONCURRENCY_LOAD_DATABASE_URL: "postgresql://load-test@db.staging-ref.supabase.co:5432/viza",
			CONCURRENCY_LOAD_PROJECT_REF: "staging-ref",
		};

		expect(() =>
			validateConcurrencyLoadGuards({
				...validEnvironment,
				CONCURRENCY_LOAD_CONFIRM: "",
			}),
		).toThrow("Set CONCURRENCY_LOAD_CONFIRM=staging-only");
		expect(() =>
			validateConcurrencyLoadGuards({
				...validEnvironment,
				CONCURRENCY_LOAD_DATABASE_URL: "",
			}),
		).toThrow("CONCURRENCY_LOAD_DATABASE_URL is required");
		expect(() =>
			validateConcurrencyLoadGuards({
				...validEnvironment,
				CONCURRENCY_LOAD_PROJECT_REF: "oyjxdzsoejraedqghndi",
			}),
		).toThrow("forbidden on production");
		expect(() =>
			validateConcurrencyLoadGuards({
				...validEnvironment,
				CONCURRENCY_LOAD_DATABASE_URL:
					"postgresql://load-test@oyjxdzsoejraedqghndi.supabase.co:5432/viza",
			}),
		).toThrow("forbidden on production");
	});

	it("accepts only the bounded approved level matrix", () => {
		const config = validateConcurrencyLoadGuards({
			CONCURRENCY_LOAD_CONFIRM: "staging-only",
			CONCURRENCY_LOAD_DATABASE_URL: "postgresql://load-test@db.staging-ref.supabase.co:5432/viza",
			CONCURRENCY_LOAD_PROJECT_REF: "staging-ref",
			CONCURRENCY_LOAD_LEVELS: "300,100",
		});

		expect(config.levels).toEqual([100, 300]);
		expect(() =>
			validateConcurrencyLoadGuards({
				CONCURRENCY_LOAD_CONFIRM: "staging-only",
				CONCURRENCY_LOAD_DATABASE_URL: "postgresql://load-test@db.staging-ref.supabase.co:5432/viza",
				CONCURRENCY_LOAD_PROJECT_REF: "staging-ref",
				CONCURRENCY_LOAD_LEVELS: "200",
			}),
		).toThrow("CONCURRENCY_LOAD_LEVELS");
	});

	it("binds the database URL to the guarded staging project ref", () => {
		const base = {
			CONCURRENCY_LOAD_CONFIRM: "staging-only",
			CONCURRENCY_LOAD_PROJECT_REF: "staging-ref",
		};
		expect(() =>
			validateConcurrencyLoadGuards({
				...base,
				CONCURRENCY_LOAD_DATABASE_URL:
					"postgresql://load-test@db.other-ref.supabase.co:5432/viza",
			}),
		).toThrow("must match CONCURRENCY_LOAD_PROJECT_REF");
		expect(() =>
			validateConcurrencyLoadGuards({
				...base,
				CONCURRENCY_LOAD_DATABASE_URL:
					"postgresql://postgres.other-ref@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
			}),
		).toThrow("must match CONCURRENCY_LOAD_PROJECT_REF");
		const pooler = validateConcurrencyLoadGuards({
			...base,
			CONCURRENCY_LOAD_DATABASE_URL:
				"postgresql://postgres.staging-ref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
		});
		expect(pooler.projectRef).toBe("staging-ref");
	});

	it("parses only the authoritative staging marker", () => {
		expect(
			parseStagingDatabaseMarker(
				{ environment: "staging", project_ref: "staging-ref" },
				"staging-ref",
			),
		).toEqual({ ok: true, environment: "staging", projectRef: "staging-ref" });
		expect(
			parseStagingDatabaseMarker(
				{ environment: "production", project_ref: "staging-ref" },
				"staging-ref",
			).ok,
		).toBe(false);
		expect(
			parseStagingDatabaseMarker(
				{ environment: "staging", project_ref: "other-ref" },
				"staging-ref",
			).ok,
		).toBe(false);
	});

	it("requires the complete release matrix while allowing diagnostics subsets", () => {
		expect(isCompleteConcurrencyMatrix([100, 300, 600, 1000])).toBe(true);
		expect(isCompleteConcurrencyMatrix([1000, 600, 300, 100])).toBe(true);
		expect(isCompleteConcurrencyMatrix([100, 300])).toBe(false);
		const subset = validateConcurrencyLoadGuards({
			CONCURRENCY_LOAD_CONFIRM: "staging-only",
			CONCURRENCY_LOAD_DATABASE_URL:
				"postgresql://load-test@db.staging-ref.supabase.co:5432/viza",
			CONCURRENCY_LOAD_PROJECT_REF: "staging-ref",
			CONCURRENCY_LOAD_LEVELS: "100,300",
		});
		expect(subset.matrixComplete).toBe(false);
	});

	it("requires claimedJobs and preserves successful claim latency samples", () => {
		const result = evaluateConcurrencyRun({
			jobs: 2,
			duplicateClaims: 0,
			countryCapOvershoots: 0,
			globalSlotOvershoots: 0,
			staleLeaseWrites: 0,
			databaseErrors: 0,
			lockTimeouts: 0,
			connectionExhaustions: 0,
			claimLatenciesMs: [5, 6],
			successfulClaimLatenciesMs: [5, 6],
			syntheticRowsRemaining: 0,
			claimedJobs: 1,
			settledJobs: 1,
			failedSettlements: 0,
			capsRestoredExactly: true,
			staleLeaseProbePassed: true,
		});
		expect(result.failures).toContain("unclaimed_jobs");
		expect(result.successfulClaimLatenciesMs).toEqual([5, 6]);
	});

	it("fails a vacuous global probe even when ordinary invariants pass", () => {
		const result = evaluateConcurrencyRun({
			jobs: 100,
			duplicateClaims: 0,
			countryCapOvershoots: 0,
			globalSlotOvershoots: 0,
			staleLeaseWrites: 0,
			databaseErrors: 0,
			lockTimeouts: 0,
			connectionExhaustions: 0,
			claimLatenciesMs: [10, 20],
			successfulClaimLatenciesMs: [10, 20],
			syntheticRowsRemaining: 0,
			claimedJobs: 100,
			settledJobs: 100,
			failedSettlements: 0,
			globalProbeRequired: true,
			globalProbeAttempts: 10,
			globalProbeAccepted: 9,
			globalProbeRejected: 0,
			maxGlobalRunning: 9,
			maxDistinctRunningOwners: 9,
			maxMatchingLiveSlots: 9,
			capsRestoredExactly: true,
			staleLeaseProbePassed: true,
		});

		expect(result.passed).toBe(false);
		expect(result.failures).toEqual([
			"global_probe_insufficient_pressure",
			"global_capacity_not_reached",
			"global_probe_no_rejection",
		]);
	});

	it("fails closed for untyped or missing release metrics", () => {
		const result = evaluateConcurrencyRun({
			jobs: 1,
			duplicateClaims: 0,
			countryCapOvershoots: 0,
			globalSlotOvershoots: 0,
			staleLeaseWrites: 0,
			databaseErrors: 0,
			lockTimeouts: 0,
			connectionExhaustions: 0,
			claimLatenciesMs: [1],
			syntheticRowsRemaining: 0,
			claimedJobs: undefined,
		} as unknown as Parameters<typeof evaluateConcurrencyRun>[0]);

		expect(result.passed).toBe(false);
		expect(result.failures).toEqual(
			expect.arrayContaining([
				"missing_successful_claim_latencies",
				"unclaimed_jobs",
				"unsettled_jobs",
				"failed_settlements",
				"cap_snapshot_changed",
				"stale_lease_probe_failed",
			]),
		);
	});

	it("requires the complete release matrix for a release decision", () => {
		expect(isCompleteConcurrencyMatrix([100, 300, 600, 1000])).toBe(true);
		expect(isCompleteConcurrencyMatrix([100, 300, 600])).toBe(false);
	});

	it("keeps the live harness fenced, bounded, and cleanup-first", () => {
		expect(harnessSource).toMatch(/GLOBAL_PROBE_REQUESTS = 40/);
		expect(harnessSource).toMatch(/LOAD_WORKER_COUNT = 11/);
		expect(harnessSource).toMatch(/claim_runner_pool_load_test_job/);
		expect(harnessSource).not.toMatch(/public\.claim_runner_pool_job/);
		expect(harnessSource).toMatch(/acquireRunAdvisoryLock/);
		expect(harnessSource).toMatch(/workerIds\.slice\(0, CLAIM_WORKER_COUNT\)/);
		expect(harnessSource).toMatch(/complete_runner_pool_job/);
		expect(harnessSource).toMatch(/settleClaimsBounded/);
		expect(harnessSource).toMatch(/current_setting\('app\.viza_environment'/);
		expect(harnessSource).toMatch(/cleanupSyntheticData/);
		expect(harnessSource).not.toMatch(/rejectUnauthorized:\s*false/);
		expect(harnessSource).not.toMatch(/SET\s+app\.viza_(environment|project_ref)/i);
		expect(harnessSource).not.toMatch(/restoreUnexpectedClaim/);
		expect(harnessSource).not.toMatch(/UPDATE public\.runner_job[\s\S]*?status = 'queued'/i);
		expect(harnessSource).not.toMatch(/(?:INSERT|UPDATE|DELETE)\s+FROM public\.runner_concurrency_cap/i);
		expect(harnessSource).toMatch(/capSnapshotsEqual/);
		expect(harnessSource).toMatch(/capsRestoredExactly/);
		expect(harnessSource.indexOf("await assertStagingDatabaseMarker")).toBeGreaterThan(-1);
		expect(harnessSource.indexOf("await assertStagingDatabaseMarker")).toBeLessThan(
			harnessSource.indexOf("await reserveSyntheticSlots"),
		);
	});

	it("uses only strict runner-pool flow tuples for synthetic jobs", () => {
		expect(FLOW_KEY_BY_COUNTRY).toEqual({
			vietnam: "vn_prearrival",
			singapore: "sgac",
			malaysia: "mdac",
			thailand: "tdac",
			south_korea: "kr_eform",
			taiwan: "tw_entry_permit",
		});
	});

	it("anchors result paths at the repository root regardless of working directory", () => {
		const testDirectory = path.dirname(fileURLToPath(import.meta.url));
		const repositoryRoot = path.resolve(testDirectory, "../../../..");
		const agentBackendDirectory = path.join(repositoryRoot, "viza-be", "agent-backend");
		const scriptUrl = new URL("../../scripts/concurrency-load.ts", import.meta.url).href;
		const runId = "path-test";
		const expectedPath = path.join(
			repositoryRoot,
			"load-test-results",
			"concurrency",
			runId,
			"summary.json",
		);

		expect(resolveLoadResultsPath(runId, repositoryRoot, scriptUrl)).toBe(expectedPath);
		expect(resolveLoadResultsPath(runId, agentBackendDirectory, scriptUrl)).toBe(expectedPath);
		expect(path.relative(repositoryRoot, expectedPath)).toBe(
			path.join("load-test-results", "concurrency", runId, "summary.json"),
		);
	});
});
