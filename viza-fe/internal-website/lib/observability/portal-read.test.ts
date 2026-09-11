// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  observePortalFetch, recordPortalReadOutcome, tracePortalReadStage, withPortalReadTrace,
} from "./portal-read";

describe("portal read diagnostics", () => {
  beforeEach(() => {
    vi.stubEnv("VIZA_PORTAL_READ_METRICS", "true");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function entries() {
    return vi.mocked(console.info).mock.calls.map(([line]) => JSON.parse(String(line)) as {
      event: string; requestId: string; operation: string; outcome: string;
      stages: Record<string, { calls: number; errors: number }>;
      http: Record<string, { calls: number; errors: number; unavailable: number; declaredResponseBytes: number }>;
    });
  }

  it("leaves a disabled read and fetch response untouched", async () => {
    vi.stubEnv("VIZA_PORTAL_READ_METRICS", "false");
    const response = new Response("original stream");
    const implementation = vi.fn<typeof fetch>().mockResolvedValue(response);
    const observed = observePortalFetch(implementation);
    const result = await withPortalReadTrace("home", () => observed("https://local.test/rest/v1/applications"));
    expect(result).toBe(response);
    expect(result.bodyUsed).toBe(false);
    expect(await result.text()).toBe("original stream");
    expect(implementation).toHaveBeenCalledOnce();
    expect(console.info).not.toHaveBeenCalled();
  });

  it("keeps simultaneous request metrics isolated without retaining input data", async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const home = withPortalReadTrace("home", async () => {
      const response = new Response("secret profile body", { headers: { "content-length": "19" } });
      const fetcher = observePortalFetch(async () => { await barrier; return response; });
      const result = await tracePortalReadStage("applications", () => fetcher(
        "https://private-host.test/rest/v1/applications?id=eq.private-app&email=person@example.test",
        { headers: { Authorization: "Bearer private-token" } },
      ));
      expect(result).toBe(response);
      expect(result.bodyUsed).toBe(false);
      return result.text();
    });
    const status = withPortalReadTrace("status", async () => {
      const fetcher = observePortalFetch(async () => new Response("[]"));
      await tracePortalReadStage("documents", () => fetcher("https://local.test/rest/v1/application_documents"));
      recordPortalReadOutcome("partial");
      release();
    });
    await Promise.all([home, status]);
    const logs = entries();
    expect(logs).toHaveLength(2);
    const homeLog = logs.find((entry) => entry.operation === "home")!;
    const statusLog = logs.find((entry) => entry.operation === "status")!;
    expect(homeLog.requestId).not.toBe(statusLog.requestId);
    expect(Object.keys(homeLog.http)).toEqual(["applications"]);
    expect(Object.keys(statusLog.http)).toEqual(["application_documents"]);
    expect(homeLog.http.applications.declaredResponseBytes).toBe(19);
    expect(statusLog.outcome).toBe("partial");
    const output = JSON.stringify(logs);
    for (const secret of ["private-host", "private-app", "person@example", "private-token", "secret profile body"]) {
      expect(output).not.toContain(secret);
    }
  });

  it("counts each fetch attempt while preserving upstream failures and streams", async () => {
    const finalResponse = new Response("[]");
    const implementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(finalResponse);
    const fetcher = observePortalFetch(implementation);
    await withPortalReadTrace("home", async () => {
      const first = await fetcher("https://local.test/rest/v1/applications");
      expect(first.status).toBe(503);
      const final = await fetcher("https://local.test/rest/v1/applications");
      expect(final).toBe(finalResponse);
      expect(final.bodyUsed).toBe(false);
    });
    expect(entries()[0].http.applications).toMatchObject({ calls: 2, errors: 1, unavailable: 1 });
  });

  it("retains the original thrown error and records only its safe category", async () => {
    const error = new DOMException("private URL/token/user", "TimeoutError");
    const fetcher = observePortalFetch(async () => { throw error; });
    await expect(withPortalReadTrace("session", () => tracePortalReadStage("auth", () =>
      fetcher("https://local.test/auth/v1/user"),
    ))).rejects.toBe(error);
    expect(entries()[0]).toMatchObject({ outcome: "unavailable" });
    expect(entries()[0].stages.auth.errors).toBe(1);
    expect(JSON.stringify(entries())).not.toContain("private URL");
  });

  it("uses one correlation ID for nested reads and rejects arbitrary labels", async () => {
    await withPortalReadTrace("home", () => withPortalReadTrace("timeline", async () => {
      const fetcher = observePortalFetch(async () => new Response("[]"));
      for (let index = 0; index < 100; index += 1) {
        await tracePortalReadStage(`private-stage-${index}` as never, () =>
          fetcher(`https://local.test/rest/v1/private-table-${index}`));
      }
      recordPortalReadOutcome("private-outcome" as never);
    }));
    expect(entries()).toHaveLength(1);
    expect(Object.keys(entries()[0].stages)).toEqual(["other"]);
    expect(Object.keys(entries()[0].http)).toEqual(["other"]);
    expect(entries()[0].http.other.calls).toBe(100);
    expect(JSON.stringify(entries())).not.toContain("private-");
  });

  it("does not let an unavailable log sink fail the application read", async () => {
    vi.mocked(console.info).mockImplementation(() => { throw new Error("closed sink"); });
    expect(await withPortalReadTrace("home", async () => "valid data")).toBe("valid data");
  });

  it("bounds diagnostic output during bursts", async () => {
    await Promise.all(Array.from({ length: 1_100 }, () => withPortalReadTrace("home", async () => true)));
    const count = entries().filter((entry) => entry.event === "portal_read").length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(1_000);
  });
});
