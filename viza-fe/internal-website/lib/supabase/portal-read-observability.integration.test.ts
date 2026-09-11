// @vitest-environment node
import { createServer, type Server, type RequestListener } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn() }));

import { createAdminClient } from "./admin";
import { tracePortalReadStage, withPortalReadTrace } from "../observability/portal-read";

describe("Supabase read observability through the real SDK", () => {
  let server: Server | undefined;
  afterEach(async () => {
    server?.closeAllConnections();
    if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function configureServer(handler: RequestListener) {
    server = createServer(handler);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `http://127.0.0.1:${address.port}`);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-integration-key");
    vi.stubEnv("VIZA_PORTAL_READ_METRICS", "true");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  }

  it("counts retry attempts without consuming a chunked business response", async () => {
    let attempts = 0;
    await configureServer((_request, response) => {
      attempts += 1;
      response.writeHead(attempts === 1 ? 503 : 200, { "content-type": "application/json" });
      if (attempts === 1) response.end('{"code":"PGRST002","message":"temporary"}');
      else {
        response.write('[{"id":"private-');
        setTimeout(() => response.end('fixture"}]'), 15);
      }
    });
    const result = await withPortalReadTrace("home", async () => {
      const client = createAdminClient({ retryDelaysMs: [0], requestTimeoutMs: 1_000 });
      return tracePortalReadStage("applications", () => client.from("applications")
        .select("id").eq("applicant_id", "private-owner"));
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: "private-fixture" }]);
    expect(attempts).toBe(2);
    const output = vi.mocked(console.info).mock.calls.map(([line]) => String(line)).join("\n");
    const entry = JSON.parse(output) as { http: Record<string, { calls: number; unavailable: number }> };
    expect(entry.http.applications).toMatchObject({ calls: 2, unavailable: 1 });
    expect(output).not.toContain("private-owner");
    expect(output).not.toContain("private-fixture");
    expect(output).not.toContain("synthetic-integration-key");
  });

  it("keeps request cancellation connected after headers when metrics are enabled", async () => {
    const controller = new AbortController();
    let closed = false;
    await configureServer((_request, response) => {
      response.on("close", () => { closed = true; });
      response.writeHead(200, { "content-type": "application/json" });
      response.write('[{"id":"unfinished');
      setTimeout(() => controller.abort(new DOMException("client left", "AbortError")), 20);
    });
    const result = await withPortalReadTrace("status", async () => {
      const client = createAdminClient({ requestSignal: controller.signal, retryDelaysMs: [] });
      return tracePortalReadStage("documents", () => client.from("application_documents").select("id"));
    });
    expect(result.error).not.toBeNull();
    expect(result.data).toBeNull();
    await vi.waitFor(() => expect(closed).toBe(true));
    const line = vi.mocked(console.info).mock.calls.find(([value]) => String(value).includes('"event":"portal_read"'))!;
    const entry = JSON.parse(String(line[0])) as { stages: Record<string, { errors: number }> };
    expect(entry.stages.documents.errors).toBe(1);
  });
});
