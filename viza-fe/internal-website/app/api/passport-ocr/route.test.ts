// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class MockPassportOcrProviderError extends Error {
    readonly code: string;
    readonly retryable: boolean;

    constructor(code: string, message: string, retryable: boolean) {
      super(message);
      this.name = "PassportOcrProviderError";
      this.code = code;
      this.retryable = retryable;
    }
  }

  return {
    createAdminClient: vi.fn(),
    getClientSessionWithFallback: vi.fn(),
    extractPassportOcr: vi.fn(),
    getPassportOcrProviderName: vi.fn(),
    isSupportedPassportMimeType: vi.fn(),
    MockPassportOcrProviderError,
  };
});

vi.mock("@/lib/client-session", () => ({
  getClientSessionWithFallback: mocks.getClientSessionWithFallback,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("./provider", () => ({
  extractPassportOcr: mocks.extractPassportOcr,
  getPassportOcrProviderName: mocks.getPassportOcrProviderName,
  isSupportedPassportMimeType: mocks.isSupportedPassportMimeType,
  PassportOcrProviderError: mocks.MockPassportOcrProviderError,
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

type QueryResult = {
  data: unknown;
  error: null;
};

type BlobLike = {
  size: number;
  type: string;
  arrayBuffer: ReturnType<typeof vi.fn<() => Promise<ArrayBuffer>>>;
};

const APPLICATION = {
  id: "application-1",
  applicant_id: "applicant-1",
};

const DOCUMENT = {
  id: "document-1",
  application_id: APPLICATION.id,
  document_type: "passport_copy",
  storage_path: "applicant-1/passport.jpg",
  filename: "passport.jpg",
  status: "uploaded",
};

const FOREIGN_APPLICATION = {
  id: "application-foreign",
  applicant_id: "applicant-foreign",
};

const FOREIGN_DOCUMENT = {
  ...DOCUMENT,
  id: "document-foreign",
  application_id: FOREIGN_APPLICATION.id,
  storage_path: "applicant-foreign/passport.jpg",
};

const OCR_FIELDS = {
  fullName: { value: "Test Applicant", confidence: 0.95 },
  nativeFullName: { value: null, confidence: null },
  givenNames: { value: "Applicant", confidence: 0.95 },
  surname: { value: "Test", confidence: 0.95 },
  passportNumber: { value: "P1234567", confidence: 0.95 },
  identityDocumentNumber: { value: null, confidence: null },
  dateOfBirth: { value: "1990-01-01", confidence: 0.95 },
  placeOfBirth: { value: null, confidence: null },
  nationality: { value: "CHN", confidence: 0.95 },
  issuingCountry: { value: "CHN", confidence: 0.95 },
  issueDate: { value: null, confidence: null },
  expiryDate: { value: "2030-01-01", confidence: 0.95 },
  gender: { value: null, confidence: null },
};

const OCR_RESULT = {
  provider: "test_provider",
  confidence: 0.95,
  isReadable: true,
  fields: OCR_FIELDS,
  warnings: [],
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createBlobLike(
  size = 8,
  type = "image/jpeg",
  bytes = new TextEncoder().encode("passport").buffer,
): BlobLike {
  return {
    size,
    type,
    arrayBuffer: vi.fn(async () => bytes),
  };
}

function queryBuilder(
  result: QueryResult,
  requiredFilters: Record<string, string> = {},
): Record<string, unknown> {
  const builder = {} as Record<string, unknown>;
  const filters = new Map<string, string>();
  const resolveResult = (): QueryResult => {
    const data = result.data;
    const record = typeof data === "object" && data !== null && !Array.isArray(data)
      ? data as Record<string, unknown>
      : null;
    const filtersMatch = record !== null && Array.from(filters.entries()).every(
      ([column, value]) => record[column] === value,
    );
    const requiredFiltersPresent = Object.entries(requiredFilters).every(
      ([column, value]) => filters.get(column) === value,
    );
    return filtersMatch && requiredFiltersPresent
      ? result
      : { data: null, error: null };
  };
  builder.select = () => builder;
  builder.eq = (column: string, value: unknown) => {
    filters.set(column, String(value));
    return builder;
  };
  builder.limit = () => builder;
  builder.insert = () => builder;
  builder.update = () => builder;
  builder.maybeSingle = () => Promise.resolve(resolveResult());
  builder.then = (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(resolveResult()).then(onFulfilled, onRejected);
  return builder;
}

function configureAdminClient(options: {
  application?: typeof APPLICATION | null;
  document?: typeof DOCUMENT | null;
  blob?: BlobLike | null;
}) {
  const application = options.application === undefined ? APPLICATION : options.application;
  const document = options.document === undefined ? DOCUMENT : options.document;
  const blob = options.blob === undefined ? createBlobLike() : options.blob;
  const from = vi.fn((table: string) => {
    if (table === "applications") {
      return queryBuilder(
        { data: application, error: null },
        { id: typeof application?.id === "string" ? application.id : "", applicant_id: "applicant-1" },
      );
    }
    if (table === "application_documents") {
      return queryBuilder(
        { data: document, error: null },
        {
          application_id: typeof document?.application_id === "string" ? document.application_id : "",
          id: typeof document?.id === "string" ? document.id : "",
        },
      );
    }
    return queryBuilder({ data: { id: "extraction-1" }, error: null });
  });
  const download = vi.fn(async () => ({ data: blob, error: null }));
  const storageFrom = vi.fn(() => ({ download }));
  const adminClient = { from, storage: { from: storageFrom } };
  mocks.createAdminClient.mockReturnValue(adminClient);
  return { from, download, storageFrom };
}

function createRequest(
  body: Record<string, string> = {
    applicationId: APPLICATION.id,
    documentId: DOCUMENT.id,
  },
  signal?: AbortSignal,
) {
  return new NextRequest("https://viza.test/api/passport-ocr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
}

async function loadPost() {
  vi.resetModules();
  const route = await import("./route");
  return route.POST;
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Timed out waiting for the OCR route test condition");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

describe("POST /api/passport-ocr", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("PASSPORT_OCR_MAX_CONCURRENCY", "4");
    mocks.getClientSessionWithFallback.mockResolvedValue({ userId: "applicant-1" });
    mocks.getPassportOcrProviderName.mockReturnValue("test_provider");
    mocks.isSupportedPassportMimeType.mockImplementation((value: string) => [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ].includes(value));
    mocks.extractPassportOcr.mockResolvedValue(OCR_RESULT);
    configureAdminClient({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("admits four of a 100-request burst, rejects overflow before downstream work, and recovers", async () => {
    const POST = await loadPost();
    const pendingProviders = [deferred<typeof OCR_RESULT>(), deferred<typeof OCR_RESULT>(), deferred<typeof OCR_RESULT>(), deferred<typeof OCR_RESULT>()];
    pendingProviders.forEach((pending) => {
      mocks.extractPassportOcr.mockImplementationOnce(() => pending.promise);
    });
    const admin = configureAdminClient({});

    const requests = Array.from({ length: 100 }, () => POST(createRequest()));
    await waitUntil(() => mocks.extractPassportOcr.mock.calls.length === 4);

    const adminCallsBeforeOverflow = mocks.createAdminClient.mock.calls.length;
    const downstreamCallsBeforeOverflow = admin.from.mock.calls.length;
    const storageCallsBeforeOverflow = admin.download.mock.calls.length;
    const overflowResponses = await Promise.all(requests.slice(4));

    expect(overflowResponses).toHaveLength(96);
    for (const response of overflowResponses) {
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("2");
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: {
          code: "provider_unavailable",
          retryable: true,
        },
      });
    }
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(adminCallsBeforeOverflow);
    expect(admin.from).toHaveBeenCalledTimes(downstreamCallsBeforeOverflow);
    expect(admin.download).toHaveBeenCalledTimes(storageCallsBeforeOverflow);
    expect(mocks.extractPassportOcr).toHaveBeenCalledTimes(4);

    pendingProviders.forEach((pending) => pending.resolve(OCR_RESULT));
    const acceptedResponses = await Promise.all(requests.slice(0, 4));
    expect(acceptedResponses.every((response) => response.status === 200)).toBe(true);
    await expect(acceptedResponses[0]!.json()).resolves.toMatchObject({
      success: true,
      needsConfirmation: true,
      documentKind: "passport",
    });

    mocks.extractPassportOcr.mockResolvedValue(OCR_RESULT);
    const recovered = await POST(createRequest());
    expect(recovered.status).toBe(200);
    expect(mocks.extractPassportOcr).toHaveBeenCalledTimes(5);
  });

  it("returns auth, ownership, and file validation errors without reaching the provider, then recycles capacity", async () => {
    const POST = await loadPost();
    const admin = configureAdminClient({});

    mocks.getClientSessionWithFallback.mockResolvedValueOnce(null);
    const unauthenticated = await POST(createRequest());
    expect(unauthenticated.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.extractPassportOcr).not.toHaveBeenCalled();

    mocks.getClientSessionWithFallback.mockResolvedValue({ userId: "applicant-1" });
    configureAdminClient({ application: FOREIGN_APPLICATION, document: FOREIGN_DOCUMENT });
    const crossOwner = await POST(createRequest({
      applicationId: FOREIGN_APPLICATION.id,
      documentId: FOREIGN_DOCUMENT.id,
    }));
    expect(crossOwner.status).toBe(404);
    expect(mocks.extractPassportOcr).not.toHaveBeenCalled();
    expect(admin.download).not.toHaveBeenCalled();

    const invalidBlob = createBlobLike(8, "text/plain");
    const invalidFileAdmin = configureAdminClient({ blob: invalidBlob });
    const invalidFile = await POST(createRequest());
    expect(invalidFile.status).toBe(415);
    expect(mocks.extractPassportOcr).not.toHaveBeenCalled();
    expect(invalidBlob.arrayBuffer).not.toHaveBeenCalled();
    expect(invalidFileAdmin.from.mock.calls.map(([table]) => table)).not.toContain("ocr_extractions");

    configureAdminClient({});
    const recovered = await POST(createRequest());
    expect(recovered.status).toBe(200);
    expect(mocks.extractPassportOcr).toHaveBeenCalledTimes(1);
  });

  it("keeps cancelled provider work occupying a slot until it settles", async () => {
    const POST = await loadPost();
    const pendingProviders: Array<Deferred<typeof OCR_RESULT>> = [];
    const providerSignals: Array<AbortSignal | undefined> = [];
    mocks.extractPassportOcr.mockImplementation((_file: unknown, options: { signal?: AbortSignal }) => {
      providerSignals.push(options.signal);
      const pending = deferred<typeof OCR_RESULT>();
      pendingProviders.push(pending);
      return pending.promise;
    });

    const controllers = Array.from({ length: 4 }, () => new AbortController());
    const requests = controllers.map((controller) => POST(createRequest(undefined, controller.signal)));
    await waitUntil(() => pendingProviders.length === 4);
    expect(providerSignals).toHaveLength(4);
    expect(providerSignals.every((signal) => signal instanceof AbortSignal)).toBe(true);

    controllers[0]!.abort();
    expect(providerSignals[0]?.aborted).toBe(true);
    const overflow = await POST(createRequest());
    expect(overflow.status).toBe(503);
    expect(mocks.extractPassportOcr).toHaveBeenCalledTimes(4);

    pendingProviders[0]!.resolve(OCR_RESULT);
    const cancelled = await requests[0]!;
    expect(cancelled.status).toBe(499);
    await expect(cancelled.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "provider_unavailable",
        retryable: false,
      },
    });

    for (const pending of pendingProviders.slice(1)) pending.resolve(OCR_RESULT);
    await Promise.all(requests.slice(1));

    mocks.extractPassportOcr.mockResolvedValue(OCR_RESULT);
    const recovered = await POST(createRequest());
    expect(recovered.status).toBe(200);
    expect(mocks.extractPassportOcr).toHaveBeenCalledTimes(5);
  });

  it("rejects oversized Storage Blobs before arrayBuffer allocation", async () => {
    const POST = await loadPost();
    const oversized = createBlobLike(10 * 1024 * 1024 + 1, "image/jpeg");
    const admin = configureAdminClient({ blob: oversized });

    const response = await POST(createRequest());
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "unsupported_file" },
    });
    expect(oversized.arrayBuffer).not.toHaveBeenCalled();
    expect(mocks.extractPassportOcr).not.toHaveBeenCalled();
    expect(admin.from.mock.calls.map(([table]) => table)).not.toContain("ocr_extractions");

    configureAdminClient({});
    const recovered = await POST(createRequest());
    expect(recovered.status).toBe(200);
  });
});
