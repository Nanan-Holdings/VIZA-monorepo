import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	evaluateOnlineCapacityRun,
	ONLINE_CAPACITY_RELEASE_USERS,
	percentile,
	type OnlineCapacityRunEvaluation,
	type OnlineCapacityScenarioName,
	type OnlineCapacityScenarioResult,
} from "./online-capacity-load-lib.js";

export const PRODUCTION_PROJECT_REF = "oyjxdzsoejraedqghndi";

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const MAX_DIAGNOSTIC_USERS = ONLINE_CAPACITY_RELEASE_USERS;
const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/u;

export interface OnlineCapacityConfig {
	mode: "local-test" | "staging-only";
	baseUrl: string;
	agentUrl: string;
	supabaseUrl: string;
	projectRef: string;
	users: number;
	requestTimeoutMs: number;
}

interface ScenarioDefinition {
	name: OnlineCapacityScenarioName;
	url: string;
	expectedStatus: number;
	expectedLocationPath?: string;
}

interface RequestObservation {
	name: OnlineCapacityScenarioName;
	succeeded: boolean;
	status: number;
	durationMs: number;
	timedOut: boolean;
}

interface CapacityTargetMarker {
	enabled: true;
	mode: OnlineCapacityConfig["mode"];
	projectRef: string;
}

export interface OnlineCapacitySummary extends OnlineCapacityRunEvaluation {
	runId: string;
	scope: "public_edge_read_only";
	mode: OnlineCapacityConfig["mode"];
	startedAt: string;
	finishedAt: string;
	wallTimeMs: number;
}

function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
	const value = env[name]?.trim();
	return value || undefined;
}

function parseUrl(value: string | undefined, name: string): URL {
	if (!value) throw new Error(`${name} is required`);
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new Error(`${name} must be a valid URL`);
	}
	if (!(["http:", "https:"] as const).includes(parsed.protocol as "http:" | "https:")) {
		throw new Error(`${name} must use HTTP or HTTPS`);
	}
	if (parsed.username || parsed.password || parsed.search || parsed.hash) {
		throw new Error(`${name} must not contain credentials, query parameters, or fragments`);
	}
	return parsed;
}

function isLoopbackHost(hostname: string): boolean {
	const normalized = hostname.toLowerCase();
	return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]";
}

function assertNotProductionUrl(url: URL, name: string): void {
	const hostname = url.hostname.toLowerCase();
	if (
		hostname === "viza.it.com" ||
		hostname.endsWith(".viza.it.com") ||
		hostname.startsWith("viza-prod-") ||
		url.toString().toLowerCase().includes(PRODUCTION_PROJECT_REF)
	) {
		throw new Error(`${name} points to production; online capacity load testing is forbidden`);
	}
}

function parseUserCount(raw: string | undefined): number {
	if (!raw) return ONLINE_CAPACITY_RELEASE_USERS;
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_DIAGNOSTIC_USERS) {
		throw new Error(`ONLINE_CAPACITY_USERS must be an integer between 1 and ${MAX_DIAGNOSTIC_USERS}`);
	}
	return parsed;
}

/** Validate all safety guards before starting requests or creating artifacts. */
export function validateOnlineCapacityGuards(
	env: NodeJS.ProcessEnv = process.env,
): OnlineCapacityConfig {
	const confirm = envValue(env, "ONLINE_CAPACITY_CONFIRM");
	if (confirm !== "local-test" && confirm !== "staging-only") {
		throw new Error("ONLINE_CAPACITY_CONFIRM must be local-test or staging-only");
	}

	const baseUrl = parseUrl(envValue(env, "ONLINE_CAPACITY_BASE_URL"), "ONLINE_CAPACITY_BASE_URL");
	const agentUrl = parseUrl(envValue(env, "ONLINE_CAPACITY_AGENT_URL"), "ONLINE_CAPACITY_AGENT_URL");
	const supabaseUrl = parseUrl(
		envValue(env, "ONLINE_CAPACITY_SUPABASE_URL"),
		"ONLINE_CAPACITY_SUPABASE_URL",
	);
	const projectRef = envValue(env, "ONLINE_CAPACITY_PROJECT_REF");
	if (!projectRef) throw new Error("ONLINE_CAPACITY_PROJECT_REF is required");

	assertNotProductionUrl(baseUrl, "ONLINE_CAPACITY_BASE_URL");
	assertNotProductionUrl(agentUrl, "ONLINE_CAPACITY_AGENT_URL");
	assertNotProductionUrl(supabaseUrl, "ONLINE_CAPACITY_SUPABASE_URL");
	if (projectRef === PRODUCTION_PROJECT_REF) {
		throw new Error("ONLINE_CAPACITY_PROJECT_REF points to production; load testing is forbidden");
	}

	if (confirm === "local-test") {
		if (
			!isLoopbackHost(baseUrl.hostname) ||
			!isLoopbackHost(agentUrl.hostname) ||
			!isLoopbackHost(supabaseUrl.hostname) ||
			projectRef !== "local-test"
		) {
			throw new Error("local-test capacity targets must use loopback URLs and project ref local-test");
		}
	} else {
		if (baseUrl.protocol !== "https:" || agentUrl.protocol !== "https:" || supabaseUrl.protocol !== "https:") {
			throw new Error("staging-only capacity targets must use HTTPS");
		}
		if (!/^[a-z0-9]{20}$/u.test(projectRef)) {
			throw new Error("ONLINE_CAPACITY_PROJECT_REF must be an exact 20-character staging ref");
		}
		if (supabaseUrl.hostname.toLowerCase() !== `${projectRef}.supabase.co`) {
			throw new Error("ONLINE_CAPACITY_SUPABASE_URL must match the exact project ref");
		}
	}

	const users = parseUserCount(envValue(env, "ONLINE_CAPACITY_USERS"));
	return {
		mode: confirm,
		baseUrl: baseUrl.toString(),
		agentUrl: agentUrl.toString(),
		supabaseUrl: supabaseUrl.toString(),
		projectRef,
		users,
		requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
	};
}

function routeUrl(base: string, route: string): string {
	const url = new URL(base);
	url.pathname = route;
	url.search = "";
	url.hash = "";
	return url.toString();
}

function buildScenarios(config: OnlineCapacityConfig): ScenarioDefinition[] {
	return [
		{
			name: "client_login",
			url: routeUrl(config.baseUrl, "/client/login"),
			expectedStatus: 200,
		},
		{
			name: "application_auth_redirect",
			url: routeUrl(config.baseUrl, "/client/application"),
			expectedStatus: 307,
			expectedLocationPath: "/client/login",
		},
		{
			name: "agent_readiness",
			url: routeUrl(config.agentUrl, "/ready"),
			expectedStatus: 200,
		},
	];
}

async function drainBody(response: Response): Promise<void> {
	if (!response.body) return;
	const reader = response.body.getReader();
	while (true) {
		const { done } = await reader.read();
		if (done) return;
	}
}

async function readBoundedText(response: Response, maximumBytes = 4_096): Promise<string> {
	if (!response.body) return "";
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let bytes = 0;
	let text = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) return `${text}${decoder.decode()}`;
		bytes += value.byteLength;
		if (bytes > maximumBytes) {
			await reader.cancel();
			throw new Error("Capacity target marker exceeded the response limit");
		}
		text += decoder.decode(value, { stream: true });
	}
}

function isCapacityTargetMarker(
	value: unknown,
	config: OnlineCapacityConfig,
): value is CapacityTargetMarker {
	if (!value || typeof value !== "object") return false;
	const marker = value as Record<string, unknown>;
	return (
		marker.enabled === true &&
		marker.mode === config.mode &&
		marker.projectRef === config.projectRef
	);
}

async function verifyCapacityTarget(
	baseUrl: string,
	config: OnlineCapacityConfig,
	fetchImpl: typeof fetch,
): Promise<void> {
	const response = await fetchImpl(
		routeUrl(baseUrl, "/api/health/online-capacity-target"),
		{
			method: "GET",
			redirect: "error",
			cache: "no-store",
			headers: {
				accept: "application/json",
				"user-agent": "VIZA-online-capacity-gate/1.0",
			},
			signal: AbortSignal.timeout(config.requestTimeoutMs),
		},
	);
	if (response.status !== 200) {
		await drainBody(response);
		throw new Error("Capacity target marker is disabled or unavailable");
	}
	let marker: unknown;
	try {
		marker = JSON.parse(await readBoundedText(response));
	} catch {
		throw new Error("Capacity target marker is malformed");
	}
	if (!isCapacityTargetMarker(marker, config)) {
		throw new Error("Capacity target marker does not match the requested environment");
	}
}

function isTimeoutError(error: unknown): boolean {
	return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function executeRequest(
	scenario: ScenarioDefinition,
	timeoutMs: number,
	fetchImpl: typeof fetch,
): Promise<RequestObservation> {
	const startedAt = performance.now();
	try {
		const response = await fetchImpl(scenario.url, {
			method: "GET",
			redirect: "manual",
			cache: "no-store",
			headers: {
				accept: "text/html,application/json;q=0.9,*/*;q=0.8",
				"user-agent": "VIZA-online-capacity-gate/1.0",
			},
			signal: AbortSignal.timeout(timeoutMs),
		});
		await drainBody(response);
		const location = response.headers.get("location");
		const resolvedLocation = location ? new URL(location, scenario.url) : null;
		const locationMatches = scenario.expectedLocationPath
			? resolvedLocation?.origin === new URL(scenario.url).origin &&
				resolvedLocation.pathname === scenario.expectedLocationPath
			: true;
		return {
			name: scenario.name,
			succeeded: response.status === scenario.expectedStatus && locationMatches,
			status: response.status,
			durationMs: performance.now() - startedAt,
			timedOut: false,
		};
	} catch (error) {
		return {
			name: scenario.name,
			succeeded: false,
			status: 0,
			durationMs: performance.now() - startedAt,
			timedOut: isTimeoutError(error),
		};
	}
}

function summarizeScenario(
	name: OnlineCapacityScenarioName,
	observations: readonly RequestObservation[],
): OnlineCapacityScenarioResult {
	const relevant = observations.filter((observation) => observation.name === name);
	const latencies = relevant.map(({ durationMs }) => durationMs);
	return {
		name,
		attempts: relevant.length,
		succeeded: relevant.filter(({ succeeded }) => succeeded).length,
		failed: relevant.filter(({ succeeded }) => !succeeded).length,
		serverErrors: relevant.filter(({ status }) => status >= 500).length,
		timedOut: relevant.filter(({ timedOut }) => timedOut).length,
		p50Ms: percentile(latencies, 0.5),
		p95Ms: percentile(latencies, 0.95),
		p99Ms: percentile(latencies, 0.99),
		maxMs: percentile(latencies, 1),
	};
}

export async function executeOnlineCapacityRun(
	config: OnlineCapacityConfig,
	fetchImpl: typeof fetch = fetch,
	runId = randomUUID(),
): Promise<OnlineCapacitySummary> {
	await verifyCapacityTarget(config.baseUrl, config, fetchImpl);
	await verifyCapacityTarget(config.agentUrl, config, fetchImpl);
	const scenarios = buildScenarios(config);
	const observations: RequestObservation[] = [];
	const startedAt = new Date();
	const wallStartedAt = performance.now();
	let startWave: (() => void) | undefined;
	const wave = new Promise<void>((resolve) => {
		startWave = resolve;
	});

	const users = Array.from({ length: config.users }, async () => {
		await wave;
		for (const scenario of scenarios) {
			observations.push(
				await executeRequest(scenario, config.requestTimeoutMs, fetchImpl),
			);
		}
	});
	startWave?.();
	await Promise.all(users);

	const evaluation = evaluateOnlineCapacityRun({
		users: config.users,
		scenarios: scenarios.map(({ name }) => summarizeScenario(name, observations)),
	});
	return {
		...evaluation,
		runId,
		scope: "public_edge_read_only",
		mode: config.mode,
		startedAt: startedAt.toISOString(),
		finishedAt: new Date().toISOString(),
		wallTimeMs: Math.round((performance.now() - wallStartedAt) * 100) / 100,
	};
}

export function resolveOnlineCapacityResultsPath(
	runId: string,
	_workingDirectory = process.cwd(),
	scriptUrl = import.meta.url,
): string {
	if (!RUN_ID_PATTERN.test(runId)) throw new Error("Invalid online capacity run id");
	const scriptDirectory = path.dirname(fileURLToPath(scriptUrl));
	const repositoryRoot = path.resolve(scriptDirectory, "..", "..", "..");
	return path.join(
		repositoryRoot,
		"load-test-results",
		"online-capacity",
		runId,
		"summary.json",
	);
}

async function main(): Promise<void> {
	const config = validateOnlineCapacityGuards();
	const summary = await executeOnlineCapacityRun(config);
	const resultPath = resolveOnlineCapacityResultsPath(summary.runId);
	await mkdir(path.dirname(resultPath), { recursive: true });
	await writeFile(resultPath, `${JSON.stringify(summary, null, 2)}\n`, {
		encoding: "utf8",
		mode: 0o600,
	});
	console.log(
		JSON.stringify({
			runId: summary.runId,
			users: summary.users,
			totalRequests: summary.totalRequests,
			failedRequests: summary.failedRequests,
			passed: summary.passed,
			failures: summary.failures,
			resultPath,
		}),
	);
	if (!summary.passed) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
	main().catch((error: unknown) => {
		console.error(
			JSON.stringify({
				passed: false,
				error: error instanceof Error ? error.message : "Unknown online capacity error",
			}),
		);
		process.exitCode = 1;
	});
}
