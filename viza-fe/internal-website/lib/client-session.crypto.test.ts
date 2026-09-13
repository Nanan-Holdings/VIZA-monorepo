// @vitest-environment node
import { SignJWT, type JWTPayload } from "jose";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cookies: vi.fn(), createClient: vi.fn(), createAdminClient: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

const SECRET = "synthetic-session-secret-for-local-tests-only-0001";
const ROTATED_SECRET = "synthetic-session-secret-for-local-tests-only-0002";
const payload = { userId: "profile-one", email: "one@viza.test", type: "client_session" };

function sign(secret = SECRET, claims: JWTPayload = payload, algorithm = "HS256", expiration = "1h") {
  return new SignJWT(claims).setProtectedHeader({ alg: algorithm })
    .setExpirationTime(expiration).sign(new TextEncoder().encode(secret));
}

function request(token: string) {
  return new NextRequest("http://127.0.0.1:3300/client/home", {
    headers: { cookie: `client_session=${token}` },
  });
}

function cookie(token: string) {
  const store = { get: () => ({ value: token }), set: vi.fn(), delete: vi.fn() };
  mocks.cookies.mockResolvedValue(store);
  return store;
}

describe("client session signing key reuse", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("CLIENT_SESSION_SECRET", SECRET);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("shares one import across 100 concurrent reads and subsequent signing", async () => {
    const token = await sign();
    const store = cookie(token);
    const session = await import("./client-session");
    const imports = vi.spyOn(crypto.subtle, "importKey");
    const reads = await Promise.all(Array.from({ length: 100 }, (_, index) =>
      index % 2 ? session.getClientSession() : session.getClientSessionFromRequest(request(token)),
    ));
    expect(reads.every((read) => read?.userId === payload.userId)).toBe(true);
    expect(imports).toHaveBeenCalledTimes(1);
    await session.createClientSession("profile-two", "two@viza.test");
    expect(imports).toHaveBeenCalledTimes(1);
    const issued = store.set.mock.calls[0]?.[1] as string;
    expect(await session.getClientSessionFromRequest(request(issued))).toMatchObject({ userId: "profile-two" });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("still rejects tampering, expiry and invalid payload after warming the key", async () => {
    const valid = await sign();
    const expired = await sign(SECRET, payload, "HS256", "-1s");
    const invalidPayload = await sign(SECRET, { ...payload, userId: 42 });
    const wrongType = await sign(SECRET, { ...payload, type: "admin_session" });
    const parts = valid.split(".");
    parts[1] = Buffer.from(JSON.stringify({ ...payload, userId: "foreign-profile" })).toString("base64url");
    const session = await import("./client-session");
    expect(await session.getClientSessionFromRequest(request(valid))).not.toBeNull();
    for (const token of [parts.join("."), expired, invalidPayload, wrongType]) {
      cookie(token);
      expect(await session.getClientSession()).toBeNull();
      expect(await session.getClientSessionFromRequest(request(token))).toBeNull();
    }
  });

  it("switches keys on secret rotation and fails closed when configuration is missing or short", async () => {
    const previous = await sign();
    const current = await sign(ROTATED_SECRET);
    const session = await import("./client-session");
    const imports = vi.spyOn(crypto.subtle, "importKey");
    expect(await session.getClientSessionFromRequest(request(previous))).not.toBeNull();
    vi.stubEnv("CLIENT_SESSION_SECRET", ROTATED_SECRET);
    expect(await session.getClientSessionFromRequest(request(previous))).toBeNull();
    expect(await session.getClientSessionFromRequest(request(current))).not.toBeNull();
    expect(imports).toHaveBeenCalledTimes(2);
    for (const value of [undefined, "short"]) {
      vi.stubEnv("CLIENT_SESSION_SECRET", value);
      expect(await session.getClientSessionFromRequest(request(current))).toBeNull();
      await expect(session.createClientSession("profile-one", "one@viza.test")).rejects.toThrow("CLIENT_SESSION_SECRET");
    }
  });

  it("retries importing after a failed concurrent import", async () => {
    const token = await sign();
    const session = await import("./client-session");
    const imports = vi.spyOn(crypto.subtle, "importKey").mockRejectedValueOnce(new Error("synthetic import failure"));
    const failed = await Promise.all(Array.from({ length: 10 }, () => session.getClientSessionFromRequest(request(token))));
    expect(failed.every((read) => read === null)).toBe(true);
    expect(imports).toHaveBeenCalledTimes(1);
    expect(await session.getClientSessionFromRequest(request(token))).not.toBeNull();
    expect(imports).toHaveBeenCalledTimes(2);
  });

  it.each(["resolve", "reject"])("does not let a stale import %s replace a rotated key", async (completion) => {
    const previous = await sign();
    const current = await sign(ROTATED_SECRET);
    const oldKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    let resolve!: (key: CryptoKey) => void;
    let reject!: (error: Error) => void;
    const deferred = new Promise<CryptoKey>((resolveKey, rejectKey) => { resolve = resolveKey; reject = rejectKey; });
    const session = await import("./client-session");
    const imports = vi.spyOn(crypto.subtle, "importKey").mockImplementationOnce(() => deferred);
    const pending = session.getClientSessionFromRequest(request(previous));
    await vi.waitFor(() => expect(imports).toHaveBeenCalledTimes(1));
    vi.stubEnv("CLIENT_SESSION_SECRET", ROTATED_SECRET);
    expect(await session.getClientSessionFromRequest(request(current))).not.toBeNull();
    if (completion === "resolve") resolve(oldKey);
    else reject(new Error("synthetic stale import failure"));
    await pending;
    expect(await session.getClientSessionFromRequest(request(current))).not.toBeNull();
    expect(await session.getClientSessionFromRequest(request(previous))).toBeNull();
    expect(imports).toHaveBeenCalledTimes(2);
  });

  it.each(["HS256", "HS384", "HS512"])("preserves legacy payload verification with %s", async (algorithm) => {
    const token = await sign(SECRET, { userId: "legacy-profile", email: "legacy@viza.test" }, algorithm);
    const session = await import("./client-session");
    expect(await session.getClientSessionFromRequest(request(token))).toMatchObject({ userId: "legacy-profile" });
  });
});
