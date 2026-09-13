// @vitest-environment node
import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { createDedupeFetch } from "next/dist/server/lib/dedupe-fetch";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFetchWithTransientRetry } from "./fetch-with-timeout";
import { observePortalFetch, withPortalReadTrace } from "../observability/portal-read";

describe("Supabase retries through the installed Next fetch memoizer", () => {
  let server: Server | undefined;
  afterEach(async () => {
    server?.closeAllConnections();
    if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function listen(handler: RequestListener) {
    server = createServer(handler);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  function transport() {
    return createFetchWithTransientRetry({
      fetchImplementation: observePortalFetch(createDedupeFetch(globalThis.fetch)),
      retryDelaysMs: [0],
      circuitBreakerScope: null,
    });
  }

  function client(url: string) {
    return createClient(url, "synthetic-next-retry-key", {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: transport() },
    });
  }

  it("recovers 100 concurrent owner-scoped SDK reads with exactly two real attempts each", async () => {
    const attempts = new Map<string, number>();
    const requests: Array<{ owner: string; select: string | null; auth: string | undefined }> = [];
    const url = await listen((request, response) => {
      const query = new URL(request.url!, "http://127.0.0.1").searchParams;
      const owner = query.get("applicant_id") ?? "missing";
      const count = (attempts.get(owner) ?? 0) + 1;
      attempts.set(owner, count);
      requests.push({ owner, select: query.get("select"), auth: request.headers.authorization });
      response.writeHead(count === 1 ? 503 : 200, { "content-type": "application/json" });
      response.end(count === 1
        ? '{"code":"PGRST002","message":"temporary"}'
        : JSON.stringify([{ id: owner.slice(3) }]));
    });
    vi.stubEnv("VIZA_PORTAL_READ_METRICS", "true");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const sdk = client(url);
    const owners = Array.from({ length: 100 }, (_, index) => `synthetic-owner-${index}`);
    const results = await Promise.all(owners.map((owner) => withPortalReadTrace("home", async () =>
      sdk.from("applications").select("id").eq("applicant_id", owner))));

    expect(results.map((result) => result.error)).toEqual(owners.map(() => null));
    expect(results.map((result) => result.data)).toEqual(owners.map((id) => [{ id }]));
    expect(attempts.size).toBe(100);
    expect([...attempts.values()]).toEqual(owners.map(() => 2));
    expect(requests).toHaveLength(200);
    expect(requests.every((request) => request.select === "id"
      && request.auth === "Bearer synthetic-next-retry-key"
      && owners.includes(request.owner.slice(3)))).toBe(true);
    const events = vi.mocked(console.info).mock.calls.map(([value]) => JSON.parse(String(value)) as {
      http: { applications: { calls: number; unavailable: number } };
    });
    expect(events).toHaveLength(100);
    expect(events.every((event) => event.http.applications.calls === 2
      && event.http.applications.unavailable === 1)).toBe(true);
  });

  it("reads a chunked successful SDK response with one network request", async () => {
    let attempts = 0;
    const url = await listen((_request, response) => {
      attempts++;
      response.writeHead(200, { "content-type": "application/json" });
      response.write('[{"id":');
      setImmediate(() => response.end('"complete"}]'));
    });
    const result = await client(url).from("applications").select("id");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: "complete" }]);
    expect(attempts).toBe(1);
  });

  it("releases a streaming failed attempt and returns the final SDK error after the retry limit", async () => {
    let attempts = 0;
    let released = false;
    const url = await listen((_request, response) => {
      attempts++;
      response.writeHead(503, { "content-type": "application/json" });
      if (attempts === 1) {
        response.once("close", () => { released = true; });
        response.write('{"code":"PGRST002",');
      } else response.end('{"code":"PGRST002","message":"still unavailable"}');
    });
    const result = await client(url).from("applications").select("id");
    expect(result.error?.code).toBe("PGRST002");
    expect(result.data).toBeNull();
    expect(attempts).toBe(2);
    await vi.waitFor(() => expect(released).toBe(true));
  });

  it("forwards a Request signal to the response body without retrying caller cancellation", async () => {
    let attempts = 0;
    let released = false;
    const url = await listen((_request, response) => {
      attempts++;
      response.once("close", () => { released = true; });
      response.writeHead(200, { "content-type": "application/json" });
      response.write('[{"id":');
    });
    const controller = new AbortController();
    const response = await transport()(new Request(url, { signal: controller.signal }));
    const body = response.json();
    const rejected = expect(body).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejected;
    await vi.waitFor(() => expect(released).toBe(true));
    expect(attempts).toBe(1);
  });

  it("does not retry an SDK mutation after a transient response", async () => {
    let attempts = 0;
    const url = await listen((request, response) => {
      request.resume();
      attempts++;
      response.writeHead(503, { "content-type": "application/json" });
      response.end('{"code":"PGRST002","message":"temporary"}');
    });
    const result = await client(url).from("applications").insert({ id: "synthetic-mutation" });
    expect(result.error?.code).toBe("PGRST002");
    expect(attempts).toBe(1);
  });
});
