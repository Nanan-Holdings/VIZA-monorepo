/**
 * Pure release-gate helpers for the staging concurrency harness.
 *
 * Keep these functions free of database, filesystem, and process-global side
 * effects so they can be exercised without a staging connection.
 */

export interface ConcurrencyRunInput {
	jobs: number;
	duplicateClaims: number;
	countryCapOvershoots: number;
	globalSlotOvershoots: number;
	staleLeaseWrites: number;
	databaseErrors: number;
	lockTimeouts: number;
	connectionExhaustions: number;
	claimLatenciesMs: readonly number[];
	syntheticRowsRemaining: number;
	claimedJobs?: number;
}

export interface ConcurrencyRunEvaluation extends ConcurrencyRunInput {
	p95ClaimMs: number;
	passed: boolean;
	failures: string[];
}

/**
 * Return a deterministic nearest-rank percentile.
 *
 * Both fractional (0..1) and percentage (0..100) ranks are accepted because
 * callers commonly spell p95 as either `0.95` or `95`. Empty/non-numeric input
 * has no observed latency and therefore returns zero.
 */
export function percentile(
	values: readonly number[],
	rank: number,
): number {
	if (!Number.isFinite(rank)) {
		throw new RangeError("Percentile rank must be finite");
	}

	const normalizedRank = rank > 1 ? rank / 100 : rank;
	if (normalizedRank < 0 || normalizedRank > 1) {
		throw new RangeError("Percentile rank must be between 0 and 1 (or 0 and 100)");
	}

	const sorted = values
		.filter((value) => Number.isFinite(value))
		.slice()
		.sort((left, right) => left - right);
	if (sorted.length === 0) return 0;

	const nearestRankIndex = Math.max(
		0,
		Math.ceil(normalizedRank * sorted.length) - 1,
	);
	return sorted[nearestRankIndex] ?? 0;
}

const INVARIANT_FAILURES: ReadonlyArray<readonly [keyof ConcurrencyRunInput, string]> = [
	["duplicateClaims", "duplicate_claims"],
	["countryCapOvershoots", "country_cap_overshoots"],
	["globalSlotOvershoots", "global_slot_overshoots"],
	["staleLeaseWrites", "stale_lease_writes"],
	["databaseErrors", "database_errors"],
	["lockTimeouts", "lock_timeouts"],
	["connectionExhaustions", "connection_exhaustions"],
	["syntheticRowsRemaining", "synthetic_rows_remaining"],
];

function isNonZero(value: number): boolean {
	return !Number.isFinite(value) || value !== 0;
}

/**
 * Evaluate one load level against the release invariants.
 *
 * Failure ordering is intentionally fixed so summaries and CI diagnostics are
 * stable across runs.
 */
export function evaluateConcurrencyRun(
	input: ConcurrencyRunInput,
): ConcurrencyRunEvaluation {
	const p95ClaimMs = percentile(input.claimLatenciesMs, 0.95);
	const failures: string[] = [];

	if (!Number.isFinite(input.jobs) || input.jobs < 0) {
		failures.push("invalid_jobs");
	}

	for (const [field, code] of INVARIANT_FAILURES) {
		const value = input[field];
		if (typeof value !== "number" || isNonZero(value)) {
			failures.push(code);
		}
	}

	if (input.jobs > 0 && input.claimLatenciesMs.length === 0) {
		failures.push("missing_claim_latencies");
	}
	if (p95ClaimMs >= 500) {
		failures.push("claim_latency_p95");
	}
	if (
		input.claimedJobs !== undefined &&
		(!Number.isFinite(input.claimedJobs) || input.claimedJobs !== input.jobs)
	) {
		failures.push("unclaimed_jobs");
	}

	return {
		...input,
		claimLatenciesMs: [...input.claimLatenciesMs],
		p95ClaimMs,
		passed: failures.length === 0,
		failures,
	};
}
