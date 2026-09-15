import assert from "node:assert/strict";
import test from "node:test";
import {
  BrowserbaseSessionError,
  connectBrowserbaseCloudBrowser,
  createBrowserbaseCloudSession,
  getBrowserbaseLiveViewUrl,
} from "../browserbase-session";
import { type Browser, type BrowserContext } from "@playwright/test";

const ENV_NAMES = [
  "BROWSERBASE_API_KEY",
  "BROWSERBASE_SESSION_TIMEOUT_SECONDS",
  "MDAC_BROWSERBASE_PROXIES",
  "MDAC_BROWSERBASE_VERIFIED",
  "MDAC_BROWSERBASE_REGION",
  "MDAC_BROWSERBASE_COUNTRY",
  "MDAC_BROWSERBASE_TIMEOUT_SECONDS",
  "PH_ETRAVEL_BROWSERBASE_COUNTRY",
  "CEAC_BROWSERBASE_COUNTRY",
  "FRANCE_TLS_BROWSERBASE_COUNTRY",
  "FRANCE_VISAS_BROWSERBASE_COUNTRY",
  "INDONESIA_BROWSERBASE_COUNTRY",
  "KR_EAC_BROWSERBASE_COUNTRY",
  "SGAC_BROWSERBASE_COUNTRY",
  "TDAC_BROWSERBASE_COUNTRY",
  "VN_BROWSERBASE_COUNTRY",
] as const;

function restoreEnvironment(snapshot: Record<string, string | undefined>): void {
  for (const name of ENV_NAMES) {
    const value = snapshot[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

test("creates a Malaysia Browserbase proxy session without a project id", async () => {
  const snapshot = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
  process.env.BROWSERBASE_API_KEY = "test-secret";
  process.env.MDAC_BROWSERBASE_PROXIES = "true";
  process.env.MDAC_BROWSERBASE_REGION = "ap-southeast-1";
  process.env.MDAC_BROWSERBASE_COUNTRY = "MY";
  try {
    let capturedInit: RequestInit | undefined;
    const result = await createBrowserbaseCloudSession({
      prefix: "MDAC",
      fetchImpl: async (_input, init) => {
        capturedInit = init;
        return new Response(JSON.stringify({ id: "session-123", connectUrl: "wss://example.invalid" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    const requestBody = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
    assert.equal("projectId" in requestBody, false);
    assert.equal(requestBody.timeout, 900);
    assert.deepEqual(requestBody.proxies, [
      { type: "browserbase", geolocation: { country: "MY" } },
    ]);
    assert.deepEqual(requestBody.browserSettings, { solveCaptchas: true });
    assert.equal((capturedInit?.headers as Record<string, string>)["X-BB-API-Key"], "test-secret");
    assert.equal(result.replayUrl, "https://www.browserbase.com/sessions/session-123");
  } finally {
    restoreEnvironment(snapshot);
  }
});

test("returns a safe paid-plan error without echoing the API key", async () => {
  const snapshot = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
  process.env.BROWSERBASE_API_KEY = "do-not-log-this";
  try {
    await assert.rejects(
      createBrowserbaseCloudSession({
        prefix: "MDAC",
        fetchImpl: async () => new Response("provider detail", { status: 402 }),
      }),
      (error: unknown) => {
        assert.ok(error instanceof BrowserbaseSessionError);
        assert.match(error.message, /paid Developer plan/i);
        assert.doesNotMatch(error.message, /do-not-log-this|provider detail/);
        return true;
      },
    );
  } finally {
    restoreEnvironment(snapshot);
  }
});

test("supports a runner-specific Browserbase session timeout", async () => {
  const snapshot = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
  process.env.BROWSERBASE_API_KEY = "test-secret";
  process.env.BROWSERBASE_SESSION_TIMEOUT_SECONDS = "600";
  process.env.MDAC_BROWSERBASE_TIMEOUT_SECONDS = "1200";
  try {
    let capturedInit: RequestInit | undefined;
    await createBrowserbaseCloudSession({
      prefix: "MDAC",
      fetchImpl: async (_input, init) => {
        capturedInit = init;
        return new Response(JSON.stringify({ id: "timed-session", connectUrl: "wss://example.invalid" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    const requestBody = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
    assert.equal(requestBody.timeout, 1200);
  } finally {
    restoreEnvironment(snapshot);
  }
});

test("releases a session id when Browserbase returns no connect URL", async () => {
  const snapshot = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
  process.env.BROWSERBASE_API_KEY = "test-secret";
  const requests: SessionApiRequest[] = [];
  try {
    await assert.rejects(
      createBrowserbaseCloudSession({
        prefix: "MDAC",
        fetchImpl: async (input, init) => {
          const url = String(input);
          requests.push({ url, init });
          if (url === "https://api.browserbase.com/v1/sessions") {
            return new Response(JSON.stringify({ id: "orphan-session" }), {
              status: 201,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response("", { status: 200 });
        },
      }),
      (error: unknown) => error instanceof BrowserbaseSessionError
        && error.message === "Browserbase returned an invalid session response.",
    );
    assert.equal(requests.length, 2);
    assert.equal(requests[1]?.url, "https://api.browserbase.com/v1/sessions/orphan-session");
    assert.deepEqual(JSON.parse(String(requests[1]?.init?.body)), { status: "REQUEST_RELEASE" });
  } finally {
    restoreEnvironment(snapshot);
  }
});

test("requests a Verified Browser only when the country runner enables it", async () => {
  const snapshot = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
  process.env.BROWSERBASE_API_KEY = "test-secret";
  process.env.MDAC_BROWSERBASE_VERIFIED = "true";
  try {
    let capturedInit: RequestInit | undefined;
    const result = await createBrowserbaseCloudSession({
      prefix: "MDAC",
      fetchImpl: async (_input, init) => {
        capturedInit = init;
        return new Response(JSON.stringify({ id: "verified-session", connectUrl: "wss://example.invalid" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    const requestBody = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
    assert.deepEqual(requestBody.browserSettings, { solveCaptchas: true, verified: true });
    assert.equal(result.verifiedEnabled, true);
  } finally {
    restoreEnvironment(snapshot);
  }
});

test("selects a country-specific proxy location for every migrated runner", async () => {
  const snapshot = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
  process.env.BROWSERBASE_API_KEY = "test-secret";
  const expected = {
    CEAC: "US",
    FRANCE_TLS: "CN",
    FRANCE_VISAS: "FR",
    INDONESIA: "ID",
    KR_EAC: "KR",
    MDAC: "MY",
    PH_ETRAVEL: "PH",
    SGAC: "SG",
    TDAC: "TH",
    VN: "VN",
    TW_ENTRY_PERMIT: "TW",
  } as const;
  try {
    for (const [prefix, country] of Object.entries(expected)) {
      delete process.env[`${prefix}_BROWSERBASE_COUNTRY`];
      let capturedInit: RequestInit | undefined;
      await createBrowserbaseCloudSession({
        prefix,
        fetchImpl: async (_input, init) => {
          capturedInit = init;
          return new Response(JSON.stringify({ id: `session-${prefix}`, connectUrl: "wss://example.invalid" }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        },
      });
      const requestBody = JSON.parse(String(capturedInit?.body)) as {
        proxies: Array<{ geolocation: { country: string } }>;
      };
      assert.equal(requestBody.proxies[0]?.geolocation.country, country);
    }
  } finally {
    restoreEnvironment(snapshot);
  }
});

test("fetches a Browserbase live-view URL without exposing the API key", async () => {
  const snapshot = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
  process.env.BROWSERBASE_API_KEY = "test-secret";
  try {
    let capturedUrl = "";
    const liveUrl = await getBrowserbaseLiveViewUrl("tw-session", async (input, init) => {
      capturedUrl = String(input);
      assert.equal((init?.headers as Record<string, string>)["X-BB-API-Key"], "test-secret");
      return new Response(JSON.stringify({
        debuggerFullscreenUrl: "https://www.browserbase.com/live/tw-session",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    assert.match(capturedUrl, /\/sessions\/tw-session\/debug$/);
    assert.equal(liveUrl, "https://www.browserbase.com/live/tw-session");
  } finally {
    restoreEnvironment(snapshot);
  }
});

interface SessionApiRequest {
  url: string;
  init?: RequestInit;
}

function browserbaseSetupFetch(requests: SessionApiRequest[]): (input: string | URL | Request, init?: RequestInit) => Promise<Response> {
  return async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (url === "https://api.browserbase.com/v1/sessions") {
      return new Response(JSON.stringify({ id: "setup-failure-session", connectUrl: "wss://example.invalid" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.endsWith("/setup-failure-session")) {
      return new Response("", { status: 200 });
    }
    return new Response("", { status: 404 });
  };
}

function assertReleaseRequest(request: SessionApiRequest): void {
  assert.equal(request.url, "https://api.browserbase.com/v1/sessions/setup-failure-session");
  assert.equal(request.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(request.init?.body)), { status: "REQUEST_RELEASE" });
  assert.equal((request.init?.headers as Record<string, string>)["X-BB-API-Key"], "test-secret");
}

test("releases a created Browserbase session when CDP connection fails and preserves the original error", async () => {
  const previousApiKey = process.env.BROWSERBASE_API_KEY;
  process.env.BROWSERBASE_API_KEY = "test-secret";
  const requests: SessionApiRequest[] = [];
  try {
    await assert.rejects(
      connectBrowserbaseCloudBrowser({
        prefix: "US_APPOINTMENT",
        fetchImpl: browserbaseSetupFetch(requests),
        connectOverCDPImpl: async () => {
          throw new Error("cdp setup failed");
        },
      }),
      (error: unknown) => error instanceof Error && error.message === "cdp setup failed",
    );
    assert.equal(requests.length, 2);
    assertReleaseRequest(requests[1]);
  } finally {
    if (previousApiKey === undefined) delete process.env.BROWSERBASE_API_KEY;
    else process.env.BROWSERBASE_API_KEY = previousApiKey;
  }
});

test("releases a created Browserbase session when context/page setup fails", async () => {
  const previousApiKey = process.env.BROWSERBASE_API_KEY;
  process.env.BROWSERBASE_API_KEY = "test-secret";
  const requests: SessionApiRequest[] = [];
  let browserClosed = false;
  const context = {
    pages: () => [],
    newPage: async () => { throw new Error("page setup failed"); },
  } as unknown as BrowserContext;
  const browser = {
    once: () => browser,
    contexts: () => [context],
    close: async () => { browserClosed = true; },
  } as unknown as Browser;
  try {
    await assert.rejects(
      connectBrowserbaseCloudBrowser({
        prefix: "US_APPOINTMENT",
        fetchImpl: browserbaseSetupFetch(requests),
        connectOverCDPImpl: async () => browser,
      }),
      (error: unknown) => error instanceof Error && error.message === "page setup failed",
    );
    assert.equal(browserClosed, true);
    assert.equal(requests.length, 2);
    assertReleaseRequest(requests[1]);
  } finally {
    if (previousApiKey === undefined) delete process.env.BROWSERBASE_API_KEY;
    else process.env.BROWSERBASE_API_KEY = previousApiKey;
  }
});

test("releases a created Browserbase session when context creation fails", async () => {
  const previousApiKey = process.env.BROWSERBASE_API_KEY;
  process.env.BROWSERBASE_API_KEY = "test-secret";
  const requests: SessionApiRequest[] = [];
  let browserClosed = false;
  const browser = {
    once: () => browser,
    contexts: () => [],
    newContext: async () => { throw new Error("context setup failed"); },
    close: async () => { browserClosed = true; },
  } as unknown as Browser;
  try {
    await assert.rejects(
      connectBrowserbaseCloudBrowser({
        prefix: "US_APPOINTMENT",
        fetchImpl: browserbaseSetupFetch(requests),
        connectOverCDPImpl: async () => browser,
      }),
      (error: unknown) => error instanceof Error && error.message === "context setup failed",
    );
    assert.equal(browserClosed, true);
    assert.equal(requests.length, 2);
    assertReleaseRequest(requests[1]);
  } finally {
    if (previousApiKey === undefined) delete process.env.BROWSERBASE_API_KEY;
    else process.env.BROWSERBASE_API_KEY = previousApiKey;
  }
});
