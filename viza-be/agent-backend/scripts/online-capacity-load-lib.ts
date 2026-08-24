import { percentile } from "./concurrency-load-lib.js";

export { percentile };

export const ONLINE_CAPACITY_RELEASE_USERS = 100;
export const ONLINE_CAPACITY_RELEASE_DURATION_MS = 300_000;
export const ONLINE_CAPACITY_RELEASE_RAMP_MS = 30_000;

export type OnlineCapacityScope =
	| "public_edge_read_only"
	| "authenticated_sustained_read_only";

export type OnlineCapacityScenarioName =
	| "client_login"
	| "application_auth_redirect"
	| "agent_readiness"
	| "client_home"
	| "client_status";

export interface OnlineCapacityScenarioResult {
	name: OnlineCapacityScenarioName;
	attempts: number;
	succeeded: number;
	failed: number;
	serverErrors: number;
	timedOut: number;
	p50Ms: number;
	p95Ms: number;
	p99Ms: number;
	maxMs: number;
}

export interface OnlineCapacityRunInput {
	scope: OnlineCapacityScope;
	users: number;
	sustainedForMs: number;
	rampUpMs: number;
	completedUsers: number;
	scenarios: readonly OnlineCapacityScenarioResult[];
}

export interface OnlineCapacityRunEvaluation extends OnlineCapacityRunInput {
	releaseMatrixComplete: boolean;
	totalRequests: number;
	failedRequests: number;
	serverErrors: number;
	timedOutRequests: number;
	passed: boolean;
	failures: string[];
}

const PUBLIC_EDGE_SCENARIOS: ReadonlyArray<{
	name: OnlineCapacityScenarioName;
	maximumP95Ms: number;
}> = [
	{ name: "client_login", maximumP95Ms: 2_500 },
	{ name: "application_auth_redirect", maximumP95Ms: 2_500 },
	{ name: "agent_readiness", maximumP95Ms: 500 },
];

const AUTHENTICATED_SCENARIOS: typeof PUBLIC_EDGE_SCENARIOS = [
	{ name: "client_home", maximumP95Ms: 1_500 },
	{ name: "client_status", maximumP95Ms: 1_500 },
	{ name: "agent_readiness", maximumP95Ms: 500 },
];

function isNonNegativeInteger(value: number): boolean {
	return Number.isInteger(value) && value >= 0;
}

function isNonNegativeFinite(value: number): boolean {
	return Number.isFinite(value) && value >= 0;
}

function hasValidScenarioMetrics(scenario: OnlineCapacityScenarioResult): boolean {
	return (
		isNonNegativeInteger(scenario.attempts) &&
		isNonNegativeInteger(scenario.succeeded) &&
		isNonNegativeInteger(scenario.failed) &&
		isNonNegativeInteger(scenario.serverErrors) &&
		isNonNegativeInteger(scenario.timedOut) &&
		scenario.succeeded + scenario.failed === scenario.attempts &&
		scenario.serverErrors <= scenario.failed &&
		scenario.timedOut <= scenario.failed &&
		isNonNegativeFinite(scenario.p50Ms) &&
		isNonNegativeFinite(scenario.p95Ms) &&
		isNonNegativeFinite(scenario.p99Ms) &&
		isNonNegativeFinite(scenario.maxMs) &&
		scenario.p50Ms <= scenario.p95Ms &&
		scenario.p95Ms <= scenario.p99Ms &&
		scenario.p99Ms <= scenario.maxMs
	);
}

/**
 * Evaluate the metadata-only result of one online-capacity run.
 *
 * A release run is deliberately stricter than an ordinary availability check:
 * all 100 users must finish every scenario, no 5xx/timeout is accepted, and
 * every scenario must stay below its fixed p95 budget.
 */
export function evaluateOnlineCapacityRun(
	input: OnlineCapacityRunInput,
): OnlineCapacityRunEvaluation {
	const scenarios = Array.isArray(input.scenarios) ? [...input.scenarios] : [];
	const failures: string[] = [];
	if (
		input.scope !== "public_edge_read_only" &&
		input.scope !== "authenticated_sustained_read_only"
	) {
		failures.push("invalid_scope");
	}
	const authenticated = input.scope === "authenticated_sustained_read_only";
	const releaseMatrixComplete =
		input.users === ONLINE_CAPACITY_RELEASE_USERS &&
		input.completedUsers === input.users &&
		(!authenticated ||
			(input.sustainedForMs >= ONLINE_CAPACITY_RELEASE_DURATION_MS &&
				input.rampUpMs >= ONLINE_CAPACITY_RELEASE_RAMP_MS));

	if (!Number.isInteger(input.users) || input.users < 1) {
		failures.push("invalid_users");
	}
	if (!isNonNegativeInteger(input.completedUsers)) {
		failures.push("invalid_completed_users");
	}
	if (!isNonNegativeFinite(input.sustainedForMs) || !isNonNegativeFinite(input.rampUpMs)) {
		failures.push("invalid_timing");
	}
	if (!releaseMatrixComplete) {
		failures.push("release_matrix_incomplete");
	}

	const requiredScenarios = authenticated
		? AUTHENTICATED_SCENARIOS
		: PUBLIC_EDGE_SCENARIOS;
	if (scenarios.length !== requiredScenarios.length) {
		failures.push("unexpected_scenarios");
	}
	for (const required of requiredScenarios) {
		const matches = scenarios.filter(({ name }) => name === required.name);
		if (matches.length !== 1) {
			failures.push(`${required.name}_missing`);
			continue;
		}

		const scenario = matches[0];
		if (scenario && !hasValidScenarioMetrics(scenario)) {
			failures.push(`${required.name}_invalid_metrics`);
			continue;
		}
		if (
			!scenario ||
			!isNonNegativeInteger(scenario.attempts) ||
			scenario.attempts < input.users
		) {
			failures.push(`${required.name}_incomplete`);
			continue;
		}
		if (
			!isNonNegativeInteger(scenario.succeeded) ||
			!isNonNegativeInteger(scenario.failed) ||
			scenario.succeeded + scenario.failed !== scenario.attempts ||
			scenario.failed !== 0
		) {
			failures.push(`${required.name}_failures`);
		}
		if (scenario.p95Ms >= required.maximumP95Ms) {
			failures.push(`${required.name}_latency_p95`);
		}
	}

	const totalRequests = scenarios.reduce(
		(total, scenario) => total + (isNonNegativeInteger(scenario.attempts) ? scenario.attempts : 0),
		0,
	);
	const failedRequests = scenarios.reduce(
		(total, scenario) => total + (isNonNegativeInteger(scenario.failed) ? scenario.failed : 0),
		0,
	);
	const serverErrors = scenarios.reduce(
		(total, scenario) => total + (isNonNegativeInteger(scenario.serverErrors) ? scenario.serverErrors : 0),
		0,
	);
	const timedOutRequests = scenarios.reduce(
		(total, scenario) => total + (isNonNegativeInteger(scenario.timedOut) ? scenario.timedOut : 0),
		0,
	);

	if (failedRequests !== 0) failures.push("request_errors");
	if (serverErrors !== 0) failures.push("server_errors");
	if (timedOutRequests !== 0) failures.push("request_timeouts");

	return {
		...input,
		scenarios,
		releaseMatrixComplete,
		totalRequests,
		failedRequests,
		serverErrors,
		timedOutRequests,
		passed: failures.length === 0,
		failures,
	};
}
