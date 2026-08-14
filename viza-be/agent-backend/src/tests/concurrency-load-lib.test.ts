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
			syntheticRowsRemaining: 0,
			claimedJobs: 100,
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
			syntheticRowsRemaining: 0,
			claimedJobs: 1000,
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
		};

		expect(
			evaluateConcurrencyRun({ ...base, claimLatenciesMs: [499] }),
		).toMatchObject({ passed: true, p95ClaimMs: 499, failures: [] });
		expect(
			evaluateConcurrencyRun({ ...base, claimLatenciesMs: [500] }),
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
				syntheticRowsRemaining: 0,
				claimedJobs: 0,
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
				syntheticRowsRemaining: 0,
				claimedJobs: 1,
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
		});
		expect(result.failures).toContain("unclaimed_jobs");
		expect(result.successfulClaimLatenciesMs).toEqual([5, 6]);
	});

	it("keeps the live harness fenced, bounded, and cleanup-first", () => {
		expect(harnessSource).toMatch(/GLOBAL_PROBE_REQUESTS = 40/);
		expect(harnessSource).toMatch(/complete_runner_pool_job/);
		expect(harnessSource).toMatch(/settleClaimsBounded/);
		expect(harnessSource).toMatch(/current_setting\('app\.viza_environment'/);
		expect(harnessSource).toMatch(/cleanupSyntheticData/);
		expect(harnessSource).not.toMatch(/rejectUnauthorized:\s*false/);
		expect(harnessSource).not.toMatch(/SET\s+app\.viza_(environment|project_ref)/i);
		expect(harnessSource.indexOf("await assertStagingDatabaseMarker")).toBeGreaterThan(-1);
		expect(harnessSource.indexOf("await assertStagingDatabaseMarker")).toBeLessThan(
			harnessSource.indexOf("await reserveSyntheticSlots"),
		);
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
