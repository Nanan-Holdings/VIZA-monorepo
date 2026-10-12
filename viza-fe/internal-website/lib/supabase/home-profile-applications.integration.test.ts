// @vitest-environment node

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn() }));

import { loadHomeProfileApplications } from "@/lib/client/home-profile-applications.server";
import { createAdminClient } from "./admin";

const PROFILE_COLUMNS = "full_name,email";
const APPLICATION_COLUMNS = "id,applicant_id,status,created_at";
const COMBINED_SELECT =
  "id,full_name,email,owned_applications:applications!applications_applicant_id_fkey(applicant_id,id,status,created_at)";

const OWNER = "11111111-1111-4111-8111-111111111111";
const NO_APPS_OWNER = "22222222-2222-4222-8222-222222222222";
const MISSING_OWNER = "33333333-3333-4333-8333-333333333333";
const FOREIGN_SHAPE_OWNER = "44444444-4444-4444-8444-444444444444";
const MALFORMED_SHAPE_OWNER = "55555555-5555-4555-8555-555555555555";
const PARTIAL_OWNER = "66666666-6666-4666-8666-666666666666";
const FOREIGN_OWNER = "99999999-9999-4999-8999-999999999999";

type CombinedShape = "ok" | "no-apps" | "missing" | "error" | "foreign" | "malformed" | "chunked";

type FixtureMode = {
  combinedForOwner?: (ownerId: string) => CombinedShape;
  applicationFailureForOwner?: (ownerId: string) => boolean;
};

type ObservedRead = {
  method: string | undefined;
  table: string;
  query: URLSearchParams;
  status: number;
};

type LocalHomeApi = {
  baseUrl: string;
  reads: ObservedRead[];
  abortedRequestCount: () => number;
  waitFor: (condition: () => boolean, description: string) => Promise<void>;
  close: () => Promise<void>;
};

function appId(ownerId: string, index = 1): string {
  return `aaaaaaaa-aaaa-4aaa-8aaa-${ownerId.slice(-8)}${index.toString(16).padStart(4, "0")}`;
}

function appRow(ownerId: string, index = 1): Record<string, unknown> {
  return {
    id: appId(ownerId, index),
    applicant_id: ownerId,
    status: index === 1 ? "draft" : "submitted",
    created_at: `2026-09-0${index}T00:00:00.000Z`,
  };
}

function profileRow(ownerId: string, ownedApplications: unknown[] = [appRow(ownerId)]): Record<string, unknown> {
  return {
    id: ownerId,
    full_name: `Applicant ${ownerId.slice(-4)}`,
    email: `${ownerId.slice(-4)}@viza.test`,
    owned_applications: ownedApplications,
  };
}

function profileResult(ownerId: string): Record<string, unknown> {
  return {
    full_name: `Applicant ${ownerId.slice(-4)}`,
    email: `${ownerId.slice(-4)}@viza.test`,
  };
}

function parseEq(value: string | null): string | null {
  return value?.startsWith("eq.") ? value.slice(3) : null;
}

async function startLocalHomeApi(mode: FixtureMode = {}): Promise<LocalHomeApi> {
  const reads: ObservedRead[] = [];
  let abortedRequestCount = 0;

  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const table = url.pathname.replace("/rest/v1/", "");
    const query = new URLSearchParams(url.searchParams);
    const observe = (status: number) => {
      reads.push({ method: request.method, table, query, status });
    };
    const send = (status: number, body: unknown) => {
      observe(status);
      response.writeHead(status, { "content-type": "application/json", connection: "close" });
      response.end(JSON.stringify(body));
    };

    request.on("aborted", () => {
      abortedRequestCount += 1;
    });

    if (request.method !== "GET") {
      send(405, { code: "METHOD_NOT_ALLOWED" });
      return;
    }

    if (table === "applicant_profiles") {
      const ownerId = parseEq(query.get("id")) ?? "";
      const isCombined = query.get("select")?.includes("owned_applications:") ?? false;
      const shape = mode.combinedForOwner?.(ownerId) ?? "ok";

      if (isCombined) {
        if (shape === "chunked") {
          observe(200);
          response.writeHead(200, { "content-type": "application/json", connection: "keep-alive" });
          response.write("[{\"id\":\"");
          return;
        }
        if (shape === "error") {
          send(400, { code: "PGRST200", message: "Synthetic relationship unavailable" });
          return;
        }
        if (shape === "missing") {
          send(200, []);
          return;
        }
        if (shape === "no-apps") {
          send(200, [profileRow(ownerId, [])]);
          return;
        }
        if (shape === "foreign") {
          send(200, [profileRow(ownerId, [{ ...appRow(FOREIGN_OWNER), applicant_id: FOREIGN_OWNER }])]);
          return;
        }
        if (shape === "malformed") {
          send(200, [{ ...profileRow(ownerId), owned_applications: { malformed: true } }]);
          return;
        }
        send(200, [profileRow(ownerId)]);
        return;
      }

      send(200, ownerId === MISSING_OWNER ? [] : [profileResult(ownerId)]);
      return;
    }

    if (table === "applications") {
      const ownerId = parseEq(query.get("applicant_id")) ?? "";
      if (mode.applicationFailureForOwner?.(ownerId)) {
        send(503, { code: "PGRST002", message: "Synthetic application read failure" });
        return;
      }
      send(200, [appRow(ownerId)]);
      return;
    }

    send(404, { code: "PGRST404", message: "Unknown synthetic table" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo | null;
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Local Home fixture did not receive an ephemeral address");
  }

  const waitFor = async (condition: () => boolean, description: string): Promise<void> => {
    const deadline = Date.now() + 2_000;
    while (!condition()) {
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${description}`);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    reads,
    abortedRequestCount: () => abortedRequestCount,
    waitFor,
    close: async () => {
      server.closeAllConnections();
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  };
}

async function withLocalHomeApi(
  mode: FixtureMode,
  run: (fixture: LocalHomeApi) => Promise<void>,
): Promise<void> {
  const fixture = await startLocalHomeApi(mode);
  try {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", fixture.baseUrl);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-home-profile-service-key");
    await run(fixture);
  } finally {
    await fixture.close();
  }
}

function readOptions(signal: AbortSignal): {
  profileColumns: string;
  applicationColumns: string;
  signal: AbortSignal;
} {
  return { profileColumns: PROFILE_COLUMNS, applicationColumns: APPLICATION_COLUMNS, signal };
}

function createLocalAdmin(signal?: AbortSignal) {
  return createAdminClient({
    requestSignal: signal,
    requestTimeoutMs: 2_500,
    retryDelaysMs: [],
  });
}

async function settleWithin<T>(promise: PromiseLike<T>, timeoutMs = 2_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Home profile/application read did not settle")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Home profile/application read through the Supabase SDK", () => {
  it("uses one GET with exact owner predicates, projection, ordering, and response shape", async () => {
    await withLocalHomeApi({}, async ({ reads }) => {
      const admin = createLocalAdmin();
      const result = await loadHomeProfileApplications(admin, OWNER, readOptions(new AbortController().signal));

      expect(reads).toHaveLength(1);
      expect(reads[0].method).toBe("GET");
      expect(reads[0].table).toBe("applicant_profiles");
      expect(reads[0].query.get("select")).toBe(COMBINED_SELECT);
      expect(reads[0].query.get("id")).toBe(`eq.${OWNER}`);
      expect(reads[0].query.get("owned_applications.applicant_id")).toBe(`eq.${OWNER}`);
      expect(reads[0].query.get("owned_applications.order")).toBe("created_at.desc");
      expect(result.profileResult).toEqual({ data: profileResult(OWNER), error: null });
      expect(result.applicationResult).toEqual({ data: [appRow(OWNER)], error: null });
      expect((result.profileResult.data as Record<string, unknown>).id).toBeUndefined();
      expect((result.profileResult.data as Record<string, unknown>).owned_applications).toBeUndefined();
    });
  });

  it("keeps one isolated GET per distinct owner under concurrent loads", async () => {
    await withLocalHomeApi({}, async ({ reads }) => {
      const admin = createLocalAdmin();
      const owners = Array.from({ length: 100 }, (_, index) =>
        `00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, "0")}`,
      );
      const results = await Promise.all(
        owners.map((ownerId) => loadHomeProfileApplications(admin, ownerId, readOptions(new AbortController().signal))),
      );

      expect(reads).toHaveLength(100);
      expect(reads.every((read) => read.method === "GET" && read.table === "applicant_profiles")).toBe(true);
      expect(new Set(reads.map((read) => read.query.get("id")))).toEqual(new Set(owners.map((owner) => `eq.${owner}`)));
      results.forEach((result, index) => {
        const ownerId = owners[index];
        expect(result.profileResult).toEqual({ data: profileResult(ownerId), error: null });
        expect(result.applicationResult).toEqual({ data: [appRow(ownerId)], error: null });
        expect((result.applicationResult.data as Array<Record<string, unknown>>)[0].applicant_id).toBe(ownerId);
      });
    });
  });

  it("preserves a profile with no applications and a missing profile without fallback reads", async () => {
    await withLocalHomeApi({
      combinedForOwner: (ownerId) => ownerId === NO_APPS_OWNER ? "no-apps" : "missing",
    }, async ({ reads }) => {
      const admin = createLocalAdmin();
      const noApps = await loadHomeProfileApplications(admin, NO_APPS_OWNER, readOptions(new AbortController().signal));
      const missing = await loadHomeProfileApplications(admin, MISSING_OWNER, readOptions(new AbortController().signal));

      expect(noApps).toEqual({
        profileResult: { data: profileResult(NO_APPS_OWNER), error: null },
        applicationResult: { data: [], error: null },
      });
      expect(missing).toEqual({
        profileResult: { data: null, error: null },
        applicationResult: { data: [], error: null },
      });
      expect(reads).toHaveLength(2);
      expect(reads.every((read) => read.table === "applicant_profiles")).toBe(true);
    });
  });

  it("falls back once on a relation error and preserves the successful pair", async () => {
    await withLocalHomeApi({ combinedForOwner: () => "error" }, async ({ reads }) => {
      const admin = createLocalAdmin();
      const result = await loadHomeProfileApplications(admin, OWNER, readOptions(new AbortController().signal));

      expect(reads).toHaveLength(3);
      expect(reads.filter((read) => read.table === "applicant_profiles")).toHaveLength(2);
      expect(reads.filter((read) => read.table === "applications")).toHaveLength(1);
      const fallbackProfile = reads.find(
        (read) => read.table === "applicant_profiles" && read.query.get("select") === PROFILE_COLUMNS,
      );
      const fallbackApplications = reads.find((read) => read.table === "applications");
      expect(fallbackProfile?.query.get("id")).toBe(`eq.${OWNER}`);
      expect(fallbackProfile?.query.get("owned_applications.applicant_id")).toBeNull();
      expect(fallbackApplications?.query.get("select")).toBe(APPLICATION_COLUMNS);
      expect(fallbackApplications?.query.get("applicant_id")).toBe(`eq.${OWNER}`);
      expect(fallbackApplications?.query.get("order")).toBe("created_at.desc");
      expect(result.profileResult).toMatchObject({ data: profileResult(OWNER), error: null });
      expect(result.applicationResult).toMatchObject({ data: [appRow(OWNER)], error: null });
    });
  });

  it("keeps the profile result and marks only the application side when fallback applications fail", async () => {
    await withLocalHomeApi({
      combinedForOwner: () => "error",
      applicationFailureForOwner: (ownerId) => ownerId === PARTIAL_OWNER,
    }, async ({ reads }) => {
      const admin = createLocalAdmin();
      const result = await loadHomeProfileApplications(admin, PARTIAL_OWNER, readOptions(new AbortController().signal));

      expect(reads).toHaveLength(3);
      expect(result.profileResult).toMatchObject({ data: profileResult(PARTIAL_OWNER), error: null });
      expect(result.applicationResult.data).toBeNull();
      expect(result.applicationResult.error).toMatchObject({ message: expect.stringContaining("Synthetic application read failure") });
    });
  });

  it("falls back for malformed or foreign embedded rows without exposing them", async () => {
    await withLocalHomeApi({
      combinedForOwner: (ownerId) => ownerId === FOREIGN_SHAPE_OWNER ? "foreign" : "malformed",
    }, async ({ reads }) => {
      const admin = createLocalAdmin();
      const [foreign, malformed] = await Promise.all([
        loadHomeProfileApplications(admin, FOREIGN_SHAPE_OWNER, readOptions(new AbortController().signal)),
        loadHomeProfileApplications(admin, MALFORMED_SHAPE_OWNER, readOptions(new AbortController().signal)),
      ]);

      expect(reads).toHaveLength(6);
      expect(foreign.applicationResult).toMatchObject({ data: [appRow(FOREIGN_SHAPE_OWNER)], error: null });
      expect(malformed.applicationResult).toMatchObject({ data: [appRow(MALFORMED_SHAPE_OWNER)], error: null });
      expect(JSON.stringify(foreign)).not.toContain(FOREIGN_OWNER);
      expect(JSON.stringify(malformed)).not.toContain("malformed");
      expect(reads.filter((read) => read.table === "applications")).toHaveLength(2);
    });
  });

  it("throws before issuing a request when the caller is already cancelled", async () => {
    await withLocalHomeApi({}, async ({ reads }) => {
      const controller = new AbortController();
      controller.abort(new DOMException("synthetic cancellation", "AbortError"));
      const admin = createLocalAdmin(controller.signal);

      await expect(loadHomeProfileApplications(admin, OWNER, readOptions(controller.signal))).rejects.toMatchObject({
        name: "AbortError",
      });
      expect(reads).toHaveLength(0);
    });
  });

  it("does not start fallback reads when a chunked combined response is cancelled", async () => {
    await withLocalHomeApi({ combinedForOwner: () => "chunked" }, async (fixture) => {
      const controller = new AbortController();
      const admin = createLocalAdmin(controller.signal);
      const pending = loadHomeProfileApplications(admin, OWNER, readOptions(controller.signal));

      await fixture.waitFor(() => fixture.reads.length === 1, "the combined Home read");
      controller.abort(new DOMException("synthetic cancellation", "AbortError"));
      await expect(settleWithin(pending)).rejects.toMatchObject({ name: "AbortError" });
      await fixture.waitFor(() => fixture.abortedRequestCount() === 1, "the cancelled combined response");
      expect(fixture.reads).toHaveLength(1);
    });
  });
});
