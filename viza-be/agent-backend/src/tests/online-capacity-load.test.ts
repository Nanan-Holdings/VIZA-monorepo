import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
	evaluateOnlineCapacityRun,
	ONLINE_CAPACITY_RELEASE_PACING_MS,
	percentile,
	type OnlineCapacityDatabaseTelemetry,
	type OnlineCapacityScenarioResult,
} from "../../scripts/online-capacity-load-lib.js";
import {
	executeOnlineCapacityRun,
	resolveOnlineCapacityResultsPath,
	validateOnlineCapacityGuards,
} from "../../scripts/online-capacity-load.js";

const servers: Server[] = [];

afterEach(async () => {
	await Promise.all(
		servers.splice(0).map(
			(server) =>
				new Promise<void>((resolve, reject) => {
					server.close((error) => (error ? reject(error) : resolve()));
				}),
		),
	);
});

interface FixtureServer {
	baseUrl: string;
	getMaximumInFlight(): number;
	getSessionRequestCount(): number;
}

async function startFixtureServer(
	options: {
		failHealth?: boolean;
		markerProjectRef?: string;
		sessionUserId?: string;
		capacityWaitingRequests?: number;
		capacityFailedQueriesAfterFirst?: boolean;
		capacityRuntimeMonitoring?: boolean;
		capacityEventLoopP95Ms?: number;
		capacityEventLoopUtilizationPercent?: number;
		capacityHeapUtilizationPercent?: number;
		capacityUptimeResetAfterFirst?: boolean;
		capacityOmitRuntime?: boolean;
	} = {},
): Promise<FixtureServer> {
	let inFlight = 0;
	let maxInFlight = 0;
	let sessionRequestCount = 0;
	let capacityRequestCount = 0;
	const server = createServer((request, response) => {
		inFlight += 1;
		maxInFlight = Math.max(maxInFlight, inFlight);
		setTimeout(() => {
			if (request.url === "/api/health/online-capacity-target") {
				response.writeHead(200, { "content-type": "application/json" });
				response.end(
					JSON.stringify({
						enabled: true,
						mode: "local-test",
						projectRef: options.markerProjectRef ?? "local-test",
					}),
				);
			} else if (request.url === "/api/health/online-capacity-session") {
				if (request.headers.cookie === "viza_test_session=fixture") {
					sessionRequestCount += 1;
				}
				response.writeHead(200, { "content-type": "application/json" });
				response.end(JSON.stringify({
					valid: true,
					userId: options.sessionUserId ?? "11111111-1111-4111-8111-111111111111",
					sessionKind: "supabase",
					syntheticAccount: true,
				}));
			} else if (request.url === "/api/internal/status/capacity/database-read") {
				if (request.headers.authorization !== "Bearer capacity-status-secret") {
					response.writeHead(401, { "content-type": "application/json" });
					response.end(JSON.stringify({ ok: false }));
				} else {
					response.writeHead(200, { "content-type": "application/json" });
					response.end(JSON.stringify({ ok: true }));
				}
			} else if (request.url === "/api/internal/status/capacity") {
				capacityRequestCount += 1;
				if (request.headers.authorization !== "Bearer capacity-status-secret") {
					response.writeHead(401, { "content-type": "application/json" });
					response.end(JSON.stringify({ ok: false }));
				} else {
					const failedQueries =
						options.capacityFailedQueriesAfterFirst && capacityRequestCount > 1 ? 1 : 0;
					response.writeHead(200, { "content-type": "application/json" });
					response.end(JSON.stringify({
						ok: true,
						instanceId: "33333333-3333-4333-8333-333333333333",
						...(options.capacityOmitRuntime ? {} : { runtime: {
							monitoring: options.capacityRuntimeMonitoring ?? true,
							uptimeSeconds:
								options.capacityUptimeResetAfterFirst && capacityRequestCount > 1
									? 1
									: 120 + capacityRequestCount,
							eventLoop: {
								delayMeanMs: 2,
								delayP95Ms: options.capacityEventLoopP95Ms ?? 10,
								delayP99Ms: Math.max(options.capacityEventLoopP95Ms ?? 10, 15),
								delayMaxMs: Math.max(options.capacityEventLoopP95Ms ?? 10, 20),
								utilizationPercent:
									options.capacityEventLoopUtilizationPercent ?? 20,
							},
							memory: {
								rssBytes: 150_000_000,
								heapUsedBytes:
									(options.capacityHeapUtilizationPercent ?? 25) * 10_000_000,
								heapTotalBytes: 500_000_000,
								heapLimitBytes: 1_000_000_000,
								externalBytes: 10_000_000,
								arrayBuffersBytes: 1_000_000,
								heapUtilizationPercent:
									options.capacityHeapUtilizationPercent ?? 25,
							},
						} }),
						database: {
							pool: {
								state: "open",
								maxConnections: 3,
								totalConnections: 2,
								activeConnections: 1,
								idleConnections: 1,
								waitingRequests: options.capacityWaitingRequests ?? 0,
								utilizationPercent: 33.33,
								peakActiveConnections: 1,
								peakWaitingRequests: options.capacityWaitingRequests ?? 0,
								peakUtilizationPercent: 33.33,
							},
							queries: {
								totalQueries: 10 + capacityRequestCount,
								failedQueries,
								slowQueries: 0,
								topSlowFingerprints: [],
							},
						},
					}));
				}
			} else if (request.url === "/client/home" || request.url === "/client/status") {
				if (request.headers.cookie === "viza_test_session=fixture") {
					sessionRequestCount += 1;
				}
				response.writeHead(200, { "content-type": "text/plain" });
				response.end("authenticated");
			} else if (request.url === "/client/login") {
				response.writeHead(200, { "content-type": "text/plain" });
				response.end("login");
			} else if (request.url === "/client/application") {
				response.writeHead(307, { location: "/client/login" });
				response.end();
			} else if (request.url === "/ready") {
				response.writeHead(options.failHealth ? 503 : 200, {
					"content-type": "application/json",
					"x-max-in-flight": String(maxInFlight),
				});
				response.end(JSON.stringify({ ok: !options.failHealth }));
			} else {
				response.writeHead(404);
				response.end();
			}
			inFlight -= 1;
		}, 5);
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	servers.push(server);
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Fixture address unavailable");
	return {
		baseUrl: `http://127.0.0.1:${address.port}`,
		getMaximumInFlight: () => maxInFlight,
		getSessionRequestCount: () => sessionRequestCount,
	};
}

function localEnvironment(
	baseUrl: string,
	users = "100",
	pacingMs = "0",
): NodeJS.ProcessEnv {
	return {
		ONLINE_CAPACITY_CONFIRM: "local-test",
		ONLINE_CAPACITY_BASE_URL: baseUrl,
		ONLINE_CAPACITY_AGENT_URL: baseUrl,
		ONLINE_CAPACITY_PROJECT_REF: "local-test",
		ONLINE_CAPACITY_SUPABASE_URL: "http://127.0.0.1:54321",
		ONLINE_CAPACITY_USERS: users,
		ONLINE_CAPACITY_PACING_MS: pacingMs,
	};
}

function authenticatedLocalEnvironment(baseUrl: string): NodeJS.ProcessEnv {
	return {
		...localEnvironment(baseUrl),
		ONLINE_CAPACITY_SCOPE: "authenticated_sustained_read_only",
		ONLINE_CAPACITY_SYNTHETIC_ACCOUNT: "capacity@viza.test",
		ONLINE_CAPACITY_SESSION_COOKIE: "viza_test_session=fixture",
		ONLINE_CAPACITY_SYNTHETIC_USER_ID: "11111111-1111-4111-8111-111111111111",
		ONLINE_CAPACITY_STATUS_SECRET: "capacity-status-secret",
		ONLINE_CAPACITY_DURATION_MS: "0",
		ONLINE_CAPACITY_RAMP_MS: "0",
		ONLINE_CAPACITY_PACING_MS: "0",
	};
}

function healthyDatabaseTelemetry(
	overrides: Partial<OnlineCapacityDatabaseTelemetry> = {},
): OnlineCapacityDatabaseTelemetry {
	return {
		sampleCount: 266,
		requiredSamples: 266,
		allPoolStatesOpen: true,
		singleInstance: true,
		maxConnections: 3,
		peakActiveConnections: 2,
		peakWaitingRequests: 0,
		samplesWithWaitingRequests: 0,
		peakUtilizationPercent: 66.67,
		baselineTotalQueries: 10,
		finalTotalQueries: 610,
		failedQueryDelta: 0,
		slowQueryDelta: 0,
		metricResetDetected: false,
		topSlowFingerprints: [],
		allRuntimeMonitorsEnabled: true,
		runtimeMetricResetDetected: false,
		peakEventLoopDelayP95Ms: 10,
		peakEventLoopDelayMaxMs: 20,
		peakEventLoopUtilizationPercent: 20,
		peakHeapUtilizationPercent: 25,
		peakRssBytes: 150_000_000,
		...overrides,
	};
}

describe("online capacity release gate", () => {
	const harnessSource = readFileSync(
		path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			"../../scripts/online-capacity-load.ts",
		),
		"utf8",
	);
	const workflowSource = readFileSync(
		path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			"../../../../.github/workflows/online-capacity-gate.yml",
		),
		"utf8",
	);

	it("fails closed for production URLs and the production project ref", () => {
		const base = {
			ONLINE_CAPACITY_CONFIRM: "staging-only",
			ONLINE_CAPACITY_BASE_URL: "https://preview.example.test",
			ONLINE_CAPACITY_AGENT_URL: "https://agent.preview.example.test",
			ONLINE_CAPACITY_PROJECT_REF: "stagingref1234567890",
			ONLINE_CAPACITY_SUPABASE_URL:
				"https://stagingref1234567890.supabase.co",
			ONLINE_CAPACITY_USERS: "100",
		};

		expect(() =>
			validateOnlineCapacityGuards({
				...base,
				ONLINE_CAPACITY_BASE_URL: "https://app.viza.it.com",
			}),
		).toThrow(/production/i);
		expect(() =>
			validateOnlineCapacityGuards({
				...base,
				ONLINE_CAPACITY_AGENT_URL: "https://api.viza.it.com",
			}),
		).toThrow(/production/i);
		expect(() =>
			validateOnlineCapacityGuards({
				...base,
				ONLINE_CAPACITY_PROJECT_REF: "oyjxdzsoejraedqghndi",
				ONLINE_CAPACITY_SUPABASE_URL:
					"https://oyjxdzsoejraedqghndi.supabase.co",
			}),
		).toThrow(/production/i);
	});

	it("requires exact local or staging bindings before any request", () => {
		expect(() => validateOnlineCapacityGuards({})).toThrow(
			"ONLINE_CAPACITY_CONFIRM",
		);
		expect(() =>
			validateOnlineCapacityGuards({
				ONLINE_CAPACITY_CONFIRM: "local-test",
				ONLINE_CAPACITY_BASE_URL: "http://127.0.0.1:3000",
				ONLINE_CAPACITY_AGENT_URL: "http://127.0.0.1:8787",
				ONLINE_CAPACITY_PROJECT_REF: "local-test",
				ONLINE_CAPACITY_SUPABASE_URL: "https://staging.supabase.co",
				ONLINE_CAPACITY_USERS: "100",
			}),
		).toThrow(/local/i);
		expect(() =>
			validateOnlineCapacityGuards({
				ONLINE_CAPACITY_CONFIRM: "staging-only",
				ONLINE_CAPACITY_BASE_URL: "https://preview.example.test",
				ONLINE_CAPACITY_AGENT_URL: "https://agent.preview.example.test",
				ONLINE_CAPACITY_PROJECT_REF: "stagingref1234567890",
				ONLINE_CAPACITY_SUPABASE_URL: "https://otherref123456789.supabase.co",
				ONLINE_CAPACITY_USERS: "100",
			}),
		).toThrow(/project ref/i);
	});

	it("marks diagnostic user counts as incomplete instead of release-ready", async () => {
		const fixture = await startFixtureServer();
		const config = validateOnlineCapacityGuards(
			localEnvironment(fixture.baseUrl, "25"),
		);

		expect(config.users).toBe(25);
	});

	it("fails closed when authenticated scope lacks its synthetic identity or cookie", async () => {
		const fixture = await startFixtureServer();
		expect(() =>
			validateOnlineCapacityGuards({
				...localEnvironment(fixture.baseUrl),
				ONLINE_CAPACITY_SCOPE: "authenticated_sustained_read_only",
			}),
		).toThrow(/@viza\.test/i);
	});

	it("runs 100 concurrent synthetic users through every read-only scenario", async () => {
		const fixture = await startFixtureServer();
		const config = validateOnlineCapacityGuards(
			localEnvironment(fixture.baseUrl, "100", "10000"),
		);
		const summary = await executeOnlineCapacityRun(config);

		expect(summary.users).toBe(100);
		expect(summary.pacingMs).toBe(10_000);
		expect(summary.scope).toBe("public_edge_read_only");
		expect(summary.totalRequests).toBe(300);
		expect(summary.failedRequests).toBe(0);
		expect(summary.serverErrors).toBe(0);
		expect(summary.timedOutRequests).toBe(0);
		expect(summary.passed).toBe(true);
		expect(summary.failures).toEqual([]);
		expect(summary.scenarios.map(({ name }) => name)).toEqual([
			"client_login",
			"application_auth_redirect",
			"agent_readiness",
		]);
		expect(summary.scenarios.every(({ attempts }) => attempts === 100)).toBe(true);
		expect(fixture.getMaximumInFlight()).toBeGreaterThan(1);
	});

	it("fails the release decision on any 5xx response", async () => {
		const fixture = await startFixtureServer({ failHealth: true });
		const summary = await executeOnlineCapacityRun(
			validateOnlineCapacityGuards(localEnvironment(fixture.baseUrl)),
		);

		expect(summary.passed).toBe(false);
		expect(summary.serverErrors).toBe(100);
		expect(summary.failures).toContain("server_errors");
		expect(summary.failures).toContain("agent_readiness_failures");
	});

	it("runs a diagnostic authenticated wave without exposing its session secret", async () => {
		const fixture = await startFixtureServer();
		const summary = await executeOnlineCapacityRun(
			validateOnlineCapacityGuards(authenticatedLocalEnvironment(fixture.baseUrl)),
		);

		expect(summary.scope).toBe("authenticated_sustained_read_only");
		expect(summary.pacingMs).toBe(0);
		expect(summary.completedUsers).toBe(100);
		expect(summary.releaseMatrixComplete).toBe(false);
		expect(summary.failures).toContain("release_matrix_incomplete");
		expect(summary.scenarios.every(({ attempts }) => attempts === 200)).toBe(true);
		expect(fixture.getSessionRequestCount()).toBeGreaterThanOrEqual(400);
		expect(JSON.stringify(summary)).not.toContain("viza_test_session");
		expect(JSON.stringify(summary)).not.toContain("capacity-status-secret");
		expect(summary.databaseTelemetry).toMatchObject({
			peakWaitingRequests: 0,
			samplesWithWaitingRequests: 0,
			peakUtilizationPercent: 33.33,
			failedQueryDelta: 0,
		});
	});

	it("refuses a valid cookie belonging to a different user before the wave", async () => {
		const fixture = await startFixtureServer({
			sessionUserId: "22222222-2222-4222-8222-222222222222",
		});
		await expect(
			executeOnlineCapacityRun(
				validateOnlineCapacityGuards(authenticatedLocalEnvironment(fixture.baseUrl)),
			),
		).rejects.toThrow(/exact synthetic user/i);
		expect(fixture.getSessionRequestCount()).toBe(1);
	});

	it("refuses to start the request wave when either deployment marker is mismatched", async () => {
		const fixture = await startFixtureServer({ markerProjectRef: "not-local" });
		await expect(
			executeOnlineCapacityRun(
				validateOnlineCapacityGuards(localEnvironment(fixture.baseUrl)),
			),
		).rejects.toThrow(/does not match/i);
		expect(fixture.getMaximumInFlight()).toBe(1);
	});

	it("uses deterministic percentiles and fail-closed evaluation", () => {
		expect(percentile([4, 1, 3, 2], 0.5)).toBe(2);
		expect(percentile([1, 2, 3, 4], 0.95)).toBe(4);

		const scenarios: OnlineCapacityScenarioResult[] = [
			{
				name: "client_login",
				attempts: 100,
				succeeded: 99,
				failed: 1,
				serverErrors: 0,
				timedOut: 0,
				p50Ms: 20,
				p95Ms: 30,
				p99Ms: 40,
				maxMs: 50,
			},
		];
		const result = evaluateOnlineCapacityRun({
			scope: "public_edge_read_only",
			users: 100,
			sustainedForMs: 0,
			rampUpMs: 0,
			pacingMs: 0,
			completedUsers: 100,
			scenarios,
		});

		expect(result.passed).toBe(false);
		expect(result.failures).toContain("request_errors");
		expect(
			evaluateOnlineCapacityRun({
				scope: "public_edge_read_only",
				users: 1,
				sustainedForMs: 0,
				rampUpMs: 0,
				pacingMs: 0,
				completedUsers: 1,
				scenarios: scenarios.map((scenario) => ({
					...scenario,
					attempts: 1,
					succeeded: 1,
					failed: 0,
				})),
			}).failures,
		).toContain("release_matrix_incomplete");
	});

	it("requires the full authenticated duration, ramp, user count, and release pacing", () => {
		const scenarios = ([
			"client_home",
			"client_status",
			"agent_readiness",
			"agent_database_read",
		] as const).map(
			(name) => ({
				name,
				attempts: 100,
				succeeded: 100,
				failed: 0,
				serverErrors: 0,
				timedOut: 0,
				p50Ms: 20,
				p95Ms: 40,
				p99Ms: 50,
				maxMs: 60,
			}),
		);
		const canonicalRun = evaluateOnlineCapacityRun({
			scope: "authenticated_sustained_read_only",
			users: 100,
			sustainedForMs: 300_000,
			rampUpMs: 30_000,
			pacingMs: ONLINE_CAPACITY_RELEASE_PACING_MS,
			completedUsers: 100,
			scenarios,
			databaseTelemetry: healthyDatabaseTelemetry(),
		});
		expect(canonicalRun.passed).toBe(true);

		const slowerRun = evaluateOnlineCapacityRun({
			...canonicalRun,
			pacingMs: 10_000,
		});
		expect(slowerRun.passed).toBe(false);
		expect(slowerRun.failures).toContain("release_pacing_mismatch");
	});

	it.each([
		["runtime_monitoring_disabled", { allRuntimeMonitorsEnabled: false }],
		["runtime_metric_reset", { runtimeMetricResetDetected: true }],
		[
			"runtime_event_loop_delay",
			{ peakEventLoopDelayP95Ms: 100, peakEventLoopDelayMaxMs: 120 },
		],
		["runtime_event_loop_utilization", { peakEventLoopUtilizationPercent: 80 }],
		["runtime_heap_utilization", { peakHeapUtilizationPercent: 80 }],
	] as const)("fails authenticated release evaluation on %s", (failure, overrides) => {
		const scenarios = ([
			"client_home",
			"client_status",
			"agent_readiness",
			"agent_database_read",
		] as const).map((name) => ({
			name,
			attempts: 100,
			succeeded: 100,
			failed: 0,
			serverErrors: 0,
			timedOut: 0,
			p50Ms: 20,
			p95Ms: 40,
			p99Ms: 50,
			maxMs: 60,
		}));
		const result = evaluateOnlineCapacityRun({
			scope: "authenticated_sustained_read_only",
			users: 100,
			sustainedForMs: 300_000,
			rampUpMs: 30_000,
			pacingMs: ONLINE_CAPACITY_RELEASE_PACING_MS,
			completedUsers: 100,
			scenarios,
			databaseTelemetry: healthyDatabaseTelemetry(overrides),
		});
		expect(result.passed).toBe(false);
		expect(result.failures).toContain(failure);
	});

	it("fails authenticated diagnostics on pool waiting or new query errors", async () => {
		const fixture = await startFixtureServer({
			capacityWaitingRequests: 1,
			capacityFailedQueriesAfterFirst: true,
		});
		const summary = await executeOnlineCapacityRun(
			validateOnlineCapacityGuards(authenticatedLocalEnvironment(fixture.baseUrl)),
		);
		expect(summary.passed).toBe(false);
		expect(summary.failures).toContain("database_pool_waiting");
		expect(summary.failures).toContain("database_query_errors");
	});

	it("fails authenticated diagnostics when runtime monitoring is disabled", async () => {
		const fixture = await startFixtureServer({ capacityRuntimeMonitoring: false });
		const summary = await executeOnlineCapacityRun(
			validateOnlineCapacityGuards(authenticatedLocalEnvironment(fixture.baseUrl)),
		);
		expect(summary.passed).toBe(false);
		expect(summary.failures).toContain("runtime_monitoring_disabled");
	});

	it("fails authenticated diagnostics when process uptime resets", async () => {
		const fixture = await startFixtureServer({ capacityUptimeResetAfterFirst: true });
		const summary = await executeOnlineCapacityRun(
			validateOnlineCapacityGuards(authenticatedLocalEnvironment(fixture.baseUrl)),
		);
		expect(summary.passed).toBe(false);
		expect(summary.failures).toContain("runtime_metric_reset");
	});

	it("rejects authenticated diagnostics when runtime telemetry is missing", async () => {
		const fixture = await startFixtureServer({ capacityOmitRuntime: true });
		await expect(
			executeOnlineCapacityRun(
				validateOnlineCapacityGuards(authenticatedLocalEnvironment(fixture.baseUrl)),
			),
		).rejects.toThrow("Database capacity telemetry response is malformed");
	});

	it("rejects a database query counter rollback even when reset is falsely marked clear", () => {
		const scenarios = ([
			"client_home",
			"client_status",
			"agent_readiness",
			"agent_database_read",
		] as const).map((name) => ({
			name,
			attempts: 100,
			succeeded: 100,
			failed: 0,
			serverErrors: 0,
			timedOut: 0,
			p50Ms: 20,
			p95Ms: 40,
			p99Ms: 50,
			maxMs: 60,
		}));
		const result = evaluateOnlineCapacityRun({
			scope: "authenticated_sustained_read_only",
			users: 100,
			sustainedForMs: 300_000,
			rampUpMs: 30_000,
			pacingMs: ONLINE_CAPACITY_RELEASE_PACING_MS,
			completedUsers: 100,
			scenarios,
			databaseTelemetry: healthyDatabaseTelemetry({
				baselineTotalQueries: 100,
				finalTotalQueries: 1,
			}),
		});
		expect(result.passed).toBe(false);
		expect(result.failures).toContain("database_telemetry_invalid");
	});

	it("rejects negative and non-finite scenario metrics", () => {
		const base: OnlineCapacityScenarioResult = {
			name: "client_login",
			attempts: 100,
			succeeded: 100,
			failed: 0,
			serverErrors: 0,
			timedOut: 0,
			p50Ms: 20,
			p95Ms: 30,
			p99Ms: 40,
			maxMs: 50,
		};
		for (const invalid of [
			{ ...base, serverErrors: -1 },
			{ ...base, timedOut: Number.NaN },
			{ ...base, p95Ms: -1 },
		]) {
			const result = evaluateOnlineCapacityRun({
				scope: "public_edge_read_only",
				users: 100,
				sustainedForMs: 0,
				rampUpMs: 0,
				pacingMs: 0,
				completedUsers: 100,
				scenarios: [
					invalid,
					{ ...base, name: "application_auth_redirect" },
					{ ...base, name: "agent_readiness" },
				],
			});
			expect(result.passed).toBe(false);
			expect(result.failures).toContain("client_login_invalid_metrics");
		}
	});

	it("anchors artifacts outside package directories without recording responses", () => {
		const resultPath = resolveOnlineCapacityResultsPath(
			"fixture-run",
			"D:/repo/viza-be/agent-backend",
			"file:///D:/repo/viza-be/agent-backend/scripts/online-capacity-load.ts",
		);

		expect(resultPath.replaceAll("\\", "/")).toBe(
			"D:/repo/load-test-results/online-capacity/fixture-run/summary.json",
		);
	});

	it("keeps every live scenario read-only and credential-free", () => {
		expect(harnessSource).toContain('method: "GET"');
		expect(harnessSource).toContain('redirect: "manual"');
		expect(harnessSource).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i);
		expect(harnessSource).toMatch(/scenario\.requiresSession[\s\S]*cookie: sessionCookie/i);
		expect(harnessSource.match(/\bauthorization\s*:/giu)).toHaveLength(2);
		expect(harnessSource).toContain("/api/internal/status/capacity");
		expect(harnessSource).toContain('authorization: `Bearer ${config.statusSecret ?? ""}`');
		expect(harnessSource).not.toMatch(/service[_-]?role|payment|official[_-]?submit/i);
		expect(harnessSource.indexOf("validateOnlineCapacityGuards()")).toBeLessThan(
			harnessSource.indexOf("executeOnlineCapacityRun(config)"),
		);
	});

	it("exposes the session cookie only to trusted-main authenticated execution", () => {
		expect(workflowSource).toContain("source_ref must be the current protected main HEAD");
		expect(workflowSource).toContain("git fetch --no-tags --depth=1 origin refs/heads/main");
		expect(workflowSource.match(/secrets\.ONLINE_CAPACITY_SESSION_COOKIE/gu)).toHaveLength(1);
		expect(workflowSource.match(/secrets\.ONLINE_CAPACITY_STATUS_SECRET/gu)).toHaveLength(1);
		const jobEnvironment = workflowSource.slice(
			workflowSource.indexOf("    env:"),
			workflowSource.indexOf("    defaults:"),
		);
		expect(jobEnvironment).not.toContain("ONLINE_CAPACITY_SESSION_COOKIE");
		expect(jobEnvironment).not.toContain("ONLINE_CAPACITY_STATUS_SECRET");
		expect(workflowSource.indexOf("ONLINE_CAPACITY_SESSION_COOKIE")).toBeGreaterThan(
			workflowSource.indexOf("Run authenticated capacity gate"),
		);
		expect(workflowSource.indexOf("ONLINE_CAPACITY_SESSION_COOKIE")).toBeGreaterThan(
			workflowSource.indexOf("npm ci"),
		);
		expect(workflowSource.indexOf("ONLINE_CAPACITY_STATUS_SECRET")).toBeGreaterThan(
			workflowSource.indexOf("Run authenticated capacity gate"),
		);
	});
});
