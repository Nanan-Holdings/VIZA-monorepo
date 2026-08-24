import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
	evaluateOnlineCapacityRun,
	percentile,
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
}

async function startFixtureServer(
	options: { failHealth?: boolean; markerProjectRef?: string } = {},
): Promise<FixtureServer> {
	let inFlight = 0;
	let maxInFlight = 0;
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
	};
}

function localEnvironment(baseUrl: string, users = "100"): NodeJS.ProcessEnv {
	return {
		ONLINE_CAPACITY_CONFIRM: "local-test",
		ONLINE_CAPACITY_BASE_URL: baseUrl,
		ONLINE_CAPACITY_AGENT_URL: baseUrl,
		ONLINE_CAPACITY_PROJECT_REF: "local-test",
		ONLINE_CAPACITY_SUPABASE_URL: "http://127.0.0.1:54321",
		ONLINE_CAPACITY_USERS: users,
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

	it("runs 100 concurrent synthetic users through every read-only scenario", async () => {
		const fixture = await startFixtureServer();
		const config = validateOnlineCapacityGuards(localEnvironment(fixture.baseUrl));
		const summary = await executeOnlineCapacityRun(config);

		expect(summary.users).toBe(100);
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
			users: 100,
			scenarios,
		});

		expect(result.passed).toBe(false);
		expect(result.failures).toContain("request_errors");
		expect(
			evaluateOnlineCapacityRun({
				users: 1,
				scenarios: scenarios.map((scenario) => ({
					...scenario,
					attempts: 1,
					succeeded: 1,
					failed: 0,
				})),
			}).failures,
		).toContain("release_matrix_incomplete");
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
		expect(harnessSource).not.toMatch(/\b(?:cookie|authorization)\s*:/i);
		expect(harnessSource).not.toMatch(/service[_-]?role|payment|official[_-]?submit/i);
		expect(harnessSource.indexOf("validateOnlineCapacityGuards()")).toBeLessThan(
			harnessSource.indexOf("executeOnlineCapacityRun(config)"),
		);
	});
});
