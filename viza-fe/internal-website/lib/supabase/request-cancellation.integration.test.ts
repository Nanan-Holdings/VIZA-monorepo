// @vitest-environment node

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({
  requireAdmin: vi.fn(),
}));

import { createAdminClient } from "./admin";

type HangingSupabaseServer = {
  baseUrl: string;
  requestCount: () => number;
  requestPaths: () => string[];
  abortedRequestCount: () => number;
  responseCloseCount: () => number;
  responseFinishCount: () => number;
  waitFor: (condition: () => boolean, description: string) => Promise<void>;
  close: () => Promise<void>;
};

async function startHangingSupabaseServer(): Promise<HangingSupabaseServer> {
  let requestCount = 0;
  let abortedRequestCount = 0;
  let responseCloseCount = 0;
  let responseFinishCount = 0;
  const requestPaths: string[] = [];

  const server = createServer((request, response) => {
    requestCount += 1;
    requestPaths.push(request.url ?? "");
    request.on("aborted", () => {
      abortedRequestCount += 1;
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
    response.write('[{"id":"partial');
    // Keep the chunked response open until the client aborts it.
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address() as AddressInfo | null;
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Local Supabase fixture did not receive an ephemeral address");
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

  const close = async () => {
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
  };

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requestCount: () => requestCount,
    requestPaths: () => [...requestPaths],
    abortedRequestCount: () => abortedRequestCount,
    responseCloseCount: () => responseCloseCount,
    responseFinishCount: () => responseFinishCount,
    waitFor,
    close,
  };
}

async function settleWithin<T>(promise: PromiseLike<T>, timeoutMs = 2_000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`SDK read did not settle within ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase request cancellation", () => {
  it("aborts a hanging SDK read and closes its HTTP response", async () => {
    const fixture = await startHangingSupabaseServer();
    const controller = new AbortController();
    try {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", fixture.baseUrl);
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-service-role-key");

      const admin = createAdminClient({
        requestSignal: controller.signal,
        requestTimeoutMs: 10_000,
        retryDelaysMs: [],
      });
      const read = admin.from("applications").select("id").then((result) => result);

      await fixture.waitFor(() => fixture.requestCount() === 1, "the SDK request");
      controller.abort(new DOMException("test cancellation", "AbortError"));

      const result = await settleWithin(read);
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      await fixture.waitFor(() => fixture.responseCloseCount() === 1, "the aborted response to close");
      expect(fixture.responseFinishCount()).toBe(0);
      expect(fixture.abortedRequestCount()).toBe(1);
      expect(fixture.requestCount()).toBe(1);
    } finally {
      await fixture.close();
    }
  });

  it("cancels two concurrent SDK reads without retrying either request", async () => {
    const fixture = await startHangingSupabaseServer();
    const controller = new AbortController();
    try {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", fixture.baseUrl);
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-service-role-key");

      const admin = createAdminClient({
        requestSignal: controller.signal,
        requestTimeoutMs: 10_000,
        retryDelaysMs: [],
      });
      const firstRead = admin
        .from("applications")
        .select("id")
        .eq("id", "first")
        .then((result) => result);
      const secondRead = admin
        .from("applicant_profiles")
        .select("id")
        .eq("id", "second")
        .then((result) => result);

      await fixture.waitFor(() => fixture.requestCount() === 2, "both SDK requests");
      controller.abort(new DOMException("test cancellation", "AbortError"));

      const [firstResult, secondResult] = await Promise.all([
        settleWithin(firstRead),
        settleWithin(secondRead),
      ]);
      expect(firstResult.data).toBeNull();
      expect(firstResult.error).toBeTruthy();
      expect(secondResult.data).toBeNull();
      expect(secondResult.error).toBeTruthy();
      await fixture.waitFor(() => fixture.responseCloseCount() === 2, "both aborted responses to close");
      expect(fixture.responseFinishCount()).toBe(0);
      expect(fixture.abortedRequestCount()).toBe(2);
      expect(fixture.requestCount()).toBe(2);
      expect(fixture.requestPaths().map((path) => path.split("?")[0])).toEqual(
        expect.arrayContaining(["/rest/v1/applications", "/rest/v1/applicant_profiles"]),
      );
    } finally {
      await fixture.close();
    }
  });
});
