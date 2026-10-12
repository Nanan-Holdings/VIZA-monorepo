import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClientSession: vi.fn(),
  getClientSessionReadResult: vi.fn(),
  getImpersonationSession: vi.fn(),
  cacheContinuityIdentity: vi.fn(),
  after: vi.fn(),
  recordPortalReadOutcome: vi.fn(),
  tracePortalReadStage: vi.fn(),
  withPortalReadTrace: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}));
vi.mock("@/lib/client-session", () => ({
  createClientSession: mocks.createClientSession,
  getClientSessionReadResult: mocks.getClientSessionReadResult,
}));
vi.mock("@/lib/impersonation-session", () => ({
  getImpersonationSession: mocks.getImpersonationSession,
}));
vi.mock("@/lib/resilience/continuity-auth", () => ({
  cacheContinuityIdentity: mocks.cacheContinuityIdentity,
}));
vi.mock("@/lib/observability/portal-read", () => ({
  recordPortalReadOutcome: mocks.recordPortalReadOutcome,
  tracePortalReadStage: mocks.tracePortalReadStage,
  withPortalReadTrace: mocks.withPortalReadTrace,
}));

import { GET } from "./route";

const afterCallbacks: Array<() => unknown> = [];

const session = {
  userId: "profile-id",
  email: "applicant@example.com",
  authUserId: "auth-user-id",
};

function request(signal?: AbortSignal): Request {
  const input = new Request("http://localhost/api/client/session");
  if (signal) Object.defineProperty(input, "signal", { configurable: true, value: signal });
  return input;
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("GET /api/client/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    mocks.after.mockImplementation((callback: () => unknown) => {
      afterCallbacks.push(callback);
    });
    mocks.getImpersonationSession.mockResolvedValue(null);
    mocks.cacheContinuityIdentity.mockResolvedValue(undefined);
    mocks.createClientSession.mockResolvedValue(undefined);
    mocks.tracePortalReadStage.mockImplementation(
      async <T>(_stage: string, run: () => Promise<T>) => run(),
    );
    mocks.withPortalReadTrace.mockImplementation(
      async <T>(_operation: string, run: () => Promise<T>) => run(),
    );
  });

  it("returns a local-cookie session without bootstrap or continuity writes", async () => {
    mocks.getClientSessionReadResult.mockResolvedValue({
      status: "authenticated",
      source: "cookie",
      session,
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(responseJson(response)).resolves.toMatchObject({
      valid: true,
      status: "authenticated",
      userId: "profile-id",
      sessionId: "client_session:profile-id",
    });
    expect(mocks.createClientSession).not.toHaveBeenCalled();
    expect(mocks.cacheContinuityIdentity).not.toHaveBeenCalled();
  });

  it("signs the resolved Supabase identity once and defers continuity bootstrap", async () => {
    mocks.getClientSessionReadResult.mockResolvedValue({
      status: "authenticated",
      source: "supabase",
      session,
    });
    const controller = new AbortController();
    const input = request(controller.signal);

    const response = await GET(input);

    expect(response.status).toBe(200);
    await expect(responseJson(response)).resolves.toMatchObject({
      valid: true,
      status: "authenticated",
      userId: "profile-id",
      sessionId: "supabase:profile-id",
    });
    expect(mocks.getClientSessionReadResult).toHaveBeenCalledWith({
      requestTimeoutMs: 1_500,
      retryDelaysMs: [],
      requestSignal: controller.signal,
    });
    expect(mocks.createClientSession).toHaveBeenCalledWith(
      "profile-id",
      "applicant@example.com",
      "auth-user-id",
    );
    expect(afterCallbacks).toHaveLength(1);
    expect(mocks.cacheContinuityIdentity).not.toHaveBeenCalled();
    await afterCallbacks[0]!();
    expect(mocks.cacheContinuityIdentity).toHaveBeenCalledWith(session);
  });

  it("returns before a deferred continuity write settles", async () => {
    let resolveContinuity!: () => void;
    let continuitySettled = false;
    const continuity = new Promise<void>((resolve) => {
      resolveContinuity = () => {
        continuitySettled = true;
        resolve();
      };
    });
    mocks.cacheContinuityIdentity.mockReturnValue(continuity);
    mocks.getClientSessionReadResult.mockResolvedValue({
      status: "authenticated",
      source: "supabase",
      session,
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(continuitySettled).toBe(false);
    expect(mocks.cacheContinuityIdentity).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(1);

    const deferred = afterCallbacks[0]!();
    expect(mocks.cacheContinuityIdentity).toHaveBeenCalledWith(session);
    expect(continuitySettled).toBe(false);
    resolveContinuity();
    await deferred;
    expect(continuitySettled).toBe(true);
  });

  it("keeps unauthenticated and provider-unavailable responses distinct", async () => {
    mocks.getClientSessionReadResult.mockResolvedValueOnce({
      status: "unauthenticated",
      session: null,
      reason: "missing_auth_session",
    });

    const unauthenticated = await GET(request());
    expect(unauthenticated.status).toBe(200);
    await expect(responseJson(unauthenticated)).resolves.toMatchObject({
      valid: false,
      status: "unauthenticated",
    });

    mocks.getClientSessionReadResult.mockResolvedValueOnce({
      status: "unavailable",
      session: null,
      reason: "timeout",
    });

    const unavailable = await GET(request());
    expect(unavailable.status).toBe(503);
    await expect(responseJson(unavailable)).resolves.toMatchObject({
      valid: false,
      status: "unavailable",
      code: "provider_unavailable",
    });
    expect(mocks.createClientSession).not.toHaveBeenCalled();
    expect(mocks.cacheContinuityIdentity).not.toHaveBeenCalled();
  });

  it("fails closed when local cookie bootstrap cannot be signed", async () => {
    mocks.getClientSessionReadResult.mockResolvedValue({
      status: "authenticated",
      source: "supabase",
      session,
    });
    mocks.createClientSession.mockRejectedValue(new Error("secret unavailable"));

    const response = await GET(request());

    expect(response.status).toBe(503);
    await expect(responseJson(response)).resolves.toMatchObject({
      valid: false,
      status: "unavailable",
      code: "provider_unavailable",
    });
    expect(mocks.cacheContinuityIdentity).not.toHaveBeenCalled();
  });
});
