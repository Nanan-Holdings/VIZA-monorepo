// @vitest-environment node

import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppointmentStatusSnapshot } from "@/types/us-appointment";
import type { FranceAppointmentStatusSnapshot } from "@/types/france-appointment";

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: getSessionMock,
    },
  }),
}));

const APPLICATION_ID = "00000000-0000-4000-8000-000000000001";
const SYNTHETIC_ACCESS_TOKEN = "synthetic-appointment-access-token";

const US_SNAPSHOT: AppointmentStatusSnapshot = {
  job: null,
  account: null,
  pendingManualAction: null,
  manualActions: [],
  slots: [],
  confirmation: null,
  latestStatusCheck: null,
  dryRunNotice: null,
};

const FRANCE_SNAPSHOT: FranceAppointmentStatusSnapshot = {
  job: null,
  account: null,
  review: null,
  pendingManualAction: null,
  manualActions: [],
  slots: [],
  confirmation: null,
  latestStatusCheck: null,
  dryRunNotice: null,
};

type FixtureMode = "normal" | "hanging";

type FixtureRequest = {
  method: string | undefined;
  pathname: string;
  headers: IncomingHttpHeaders;
};

type AppointmentFixture = {
  baseUrl: string;
  reset: () => void;
  setMode: (nextMode: FixtureMode) => void;
  requests: () => FixtureRequest[];
  responseCloseCount: () => number;
  responseFinishCount: () => number;
  waitFor: (condition: () => boolean, description: string) => Promise<void>;
  close: () => Promise<void>;
};

async function startAppointmentFixture(): Promise<AppointmentFixture> {
  let mode: FixtureMode = "normal";
  let requests: FixtureRequest[] = [];
  let responseCloseCount = 0;
  let responseFinishCount = 0;

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    requests.push({
      method: request.method,
      pathname: url.pathname,
      headers: request.headers,
    });
    response.on("close", () => {
      responseCloseCount += 1;
    });
    response.on("finish", () => {
      responseFinishCount += 1;
    });

    response.writeHead(200, {
      "content-type": "application/json",
      connection: "keep-alive",
    });
    if (mode === "hanging") {
      response.write('{"error":false,"data":');
      return;
    }

    const payload = url.pathname.includes("/france-appointment/")
      ? { error: false, data: FRANCE_SNAPSHOT }
      : { error: false, data: US_SNAPSHOT };
    response.end(JSON.stringify(payload));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address() as AddressInfo | null;
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Appointment fixture did not receive an ephemeral address");
  }

  const waitFor = async (condition: () => boolean, description: string) => {
    const deadline = Date.now() + 2_000;
    while (!condition()) {
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for ${description}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    reset: () => {
      mode = "normal";
      requests = [];
      responseCloseCount = 0;
      responseFinishCount = 0;
    },
    setMode: (nextMode) => {
      mode = nextMode;
    },
    requests: () => [...requests],
    responseCloseCount: () => responseCloseCount,
    responseFinishCount: () => responseFinishCount,
    waitFor,
    close: async () => {
      server.closeAllConnections();
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

type StatusLoader = (
  applicationId: string,
  signal?: AbortSignal,
) => Promise<unknown>;

let fixture: AppointmentFixture;
let getAppointmentStatus: StatusLoader;
let getFranceAppointmentStatus: StatusLoader;
let responseJsonStartCount = 0;

beforeAll(async () => {
  fixture = await startAppointmentFixture();
  vi.stubEnv("NEXT_PUBLIC_AGENT_BACKEND_URL", fixture.baseUrl);

  const originalFetch = globalThis.fetch;
  const instrumentedFetch: typeof fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const originalJson = response.json.bind(response);
    response.json = (() => {
      responseJsonStartCount += 1;
      return originalJson();
    }) as typeof response.json;
    return response;
  };
  vi.stubGlobal("fetch", instrumentedFetch);

  ({ getAppointmentStatus } = await import("@/lib/us-appointment/client"));
  ({ getFranceAppointmentStatus } = await import("@/lib/france-appointment/client"));
});

beforeEach(() => {
  fixture.reset();
  responseJsonStartCount = 0;
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({
    data: { session: { access_token: SYNTHETIC_ACCESS_TOKEN } },
    error: null,
  });
});

afterAll(async () => {
  await fixture.close();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const statusCases = () => [
  {
    label: "US",
    path: `/api/applications/${APPLICATION_ID}/us-appointment/status`,
    snapshot: US_SNAPSHOT,
    load: (signal?: AbortSignal) => getAppointmentStatus(APPLICATION_ID, signal),
  },
  {
    label: "France",
    path: `/api/applications/${APPLICATION_ID}/france-appointment/status`,
    snapshot: FRANCE_SNAPSHOT,
    load: (signal?: AbortSignal) => getFranceAppointmentStatus(APPLICATION_ID, signal),
  },
] satisfies Array<{
  label: string;
  path: string;
  snapshot: AppointmentStatusSnapshot | FranceAppointmentStatusSnapshot;
  load: (signal?: AbortSignal) => Promise<unknown>;
}>;

describe("appointment status request cancellation", () => {
  it.each(statusCases())("$label returns the complete status snapshot", async ({ path, snapshot, load }) => {
    const result = await load();

    expect(result).toEqual(snapshot);
    expect(responseJsonStartCount).toBe(1);
    expect(fixture.requests()).toHaveLength(1);
    expect(fixture.requests()[0]).toMatchObject({
      method: "GET",
      pathname: path,
    });
    expect(fixture.requests()[0]?.headers.authorization).toBe(
      `Bearer ${SYNTHETIC_ACCESS_TOKEN}`,
    );
  });

  it.each(statusCases())(
    "$label rejects when its response body is aborted and closes the response",
    async ({ path, load }) => {
      fixture.setMode("hanging");
      const controller = new AbortController();
      const pending = load(controller.signal);

      await fixture.waitFor(
        () => fixture.requests().some((request) => request.pathname === path),
        `${path} request`,
      );
      await fixture.waitFor(
        () => responseJsonStartCount === 1,
        `${path} response body read to begin`,
      );
      controller.abort(new DOMException("test cancellation", "AbortError"));

      await expect(pending).rejects.toThrow();
      await fixture.waitFor(
        () => fixture.responseCloseCount() === 1,
        `${path} response to close`,
      );
      expect(fixture.responseFinishCount()).toBe(0);
      expect(fixture.requests()).toHaveLength(1);
    },
  );

  it.each(statusCases())(
    "$label does not send a backend request when auth resolves after cancellation",
    async ({ load }) => {
      const session = deferred<{
        data: { session: { access_token: string } };
        error: null;
      }>();
      getSessionMock.mockReturnValue(session.promise);
      const controller = new AbortController();
      const pending = load(controller.signal);

      await fixture.waitFor(
        () => getSessionMock.mock.calls.length === 1,
        "appointment auth session read",
      );
      controller.abort(new DOMException("test cancellation", "AbortError"));
      session.resolve({
        data: { session: { access_token: SYNTHETIC_ACCESS_TOKEN } },
        error: null,
      });

      await expect(pending).rejects.toThrow();
      expect(fixture.requests()).toHaveLength(0);
    },
  );
});
