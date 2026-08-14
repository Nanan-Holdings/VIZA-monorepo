import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	evaluateConcurrencyRun,
	percentile,
} from "../../scripts/concurrency-load-lib.js";
import {
	resolveLoadResultsPath,
	validateConcurrencyLoadGuards,
} from "../../scripts/concurrency-load.js";

describe("concurrency load release evaluator", () => {
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
			CONCURRENCY_LOAD_DATABASE_URL: "postgresql://load-test@staging.example.invalid:5432/viza",
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
			CONCURRENCY_LOAD_DATABASE_URL: "postgresql://load-test@staging.example.invalid:5432/viza",
			CONCURRENCY_LOAD_PROJECT_REF: "staging-ref",
			CONCURRENCY_LOAD_LEVELS: "300,100",
		});

		expect(config.levels).toEqual([100, 300]);
		expect(() =>
			validateConcurrencyLoadGuards({
				CONCURRENCY_LOAD_CONFIRM: "staging-only",
				CONCURRENCY_LOAD_DATABASE_URL: "postgresql://load-test@staging.example.invalid:5432/viza",
				CONCURRENCY_LOAD_PROJECT_REF: "staging-ref",
				CONCURRENCY_LOAD_LEVELS: "200",
			}),
		).toThrow("CONCURRENCY_LOAD_LEVELS");
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
