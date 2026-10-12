// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchClientHomeDashboard } from "./home-dashboard-client";

const empty = {
  authenticated: true, authEmail: "synthetic@viza.test", profile: null,
  applications: [], documents: [], payments: [], timeline: null,
  timelineApplicationId: null, timelinePartialData: false,
};

afterEach(() => vi.unstubAllGlobals());

describe("private Home GET client", () => {
  it("encodes selection hints and passes same-origin/no-store/cancellation options", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(empty));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const selection = { applicationId: "owned-id", country: "中国 & Singapore", visaType: "visa/type" };
    await expect(fetchClientHomeDashboard(selection, { signal: controller.signal })).resolves.toEqual(empty);
    const [url, options] = fetchMock.mock.calls[0];
    const parsed = new URL(url, "https://viza.test");
    expect(parsed.pathname).toBe("/api/client/home-dashboard");
    expect(Object.fromEntries(parsed.searchParams)).toEqual(selection);
    expect(options).toMatchObject({ method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", signal: controller.signal });
    expect(options.body).toBeUndefined();
  });

  it("does not retain one response for a later request", async () => {
    const unavailable = { ...empty, authenticated: false, authEmail: null, unavailable: true, error: "session_unavailable" };
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(empty)).mockResolvedValueOnce(Response.json(unavailable));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchClientHomeDashboard()).resolves.toEqual(empty);
    await expect(fetchClientHomeDashboard(null)).resolves.toEqual(unavailable);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/client/home-dashboard");
  });

  it.each([
    () => new Response("private upstream details", { status: 503 }),
    () => new Response("<html>Login</html>", { headers: { "Content-Type": "text/html" } }),
    () => Response.json({ authenticated: true }),
    () => Response.json({ ...empty, timelinePartialData: "false" }),
  ])("turns HTTP, HTML and malformed results into a fixed error", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    await expect(fetchClientHomeDashboard()).rejects.toThrow(/^dashboard_read_failed$/);
  });

  it("propagates cancellation while a response body is still being consumed", async () => {
    const controller = new AbortController();
    let bodyStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => { bodyStarted = resolve; });
    const fetchMock = vi.fn().mockImplementation(async (_url: string, options: RequestInit) => ({
      ok: true, redirected: false,
      json: () => new Promise((_resolve, reject) => {
        bodyStarted?.();
        options.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const read = fetchClientHomeDashboard(undefined, { signal: controller.signal });
    await started;
    const reason = new DOMException("Page left", "AbortError");
    const rejection = expect(read).rejects.toBe(reason);
    controller.abort(reason);
    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
