// @vitest-environment node

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getClientSessionWithFallback } = vi.hoisted(() => ({ getClientSessionWithFallback: vi.fn() }));
vi.mock("@/lib/client-session", () => ({ getClientSessionWithFallback }));
vi.mock("@/lib/impersonation-session", () => ({ getImpersonationSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/api/passport-ocr/provider", () => ({
  PassportOcrProviderError: class extends Error {},
  extractPassportOcr: vi.fn(),
}));

import { createAdminClient } from "./admin";
import { loadExistingDocumentPaths } from "@/app/client/documents/reusable-document-existence";
import { loadDocumentCenterData } from "@/app/client/documents/actions";

const APPLICANT_ID = "11111111-1111-4111-8111-111111111111";
const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const BUCKET_PREFIX = "/storage/v1/object/application-documents/";
type Candidate = { document_type: string; storage_path: string | null; filename: string | null; status: string | null };
type Read = { method: string | undefined; url: URL };

async function withLocalDocuments(
  candidates: Candidate[],
  run: (fixture: {
    reads: Read[];
    storagePaths: string[];
    peakRequests: () => number;
    activeRequests: () => number;
  }) => Promise<void>,
): Promise<void> {
  const reads: Read[] = [];
  const storagePaths: string[] = [];
  let active = 0;
  let peak = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    reads.push({ method: request.method, url });
    if (url.pathname.startsWith(BUCKET_PREFIX) && request.method === "HEAD") {
      const path = decodeURIComponent(url.pathname.slice(BUCKET_PREFIX.length));
      storagePaths.push(path);
      active += 1;
      peak = Math.max(peak, active);
      const status = path === "missing.pdf" ? 404 : path === "unavailable.pdf" ? 503 : 200;
      const timer = setTimeout(() => {
        timers.delete(timer);
        active -= 1;
        response.writeHead(status).end();
      }, status === 503 ? 0 : 30);
      timers.add(timer);
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405).end();
      return;
    }
    const table = url.pathname.replace("/rest/v1/", "");
    let data: unknown[];
    switch (table) {
      case "applicant_profiles":
        data = [{ id: APPLICANT_ID, auth_user_id: null, email: "synthetic@viza.test" }];
        break;
      case "applications":
        data = [{
          id: APPLICATION_ID, country: "vietnam", visa_type: "evisa_tourism", status: "draft",
          created_at: "2026-09-09T00:00:00Z", updated_at: "2026-09-09T00:00:00Z",
          submitted_at: null, visa_package_id: null, visa_packages: null,
        }];
        break;
      case "universal_profile_documents":
        // Deliberately include invalid rows so the action's defensive filter is exercised.
        data = candidates;
        break;
      case "visa_packages":
      case "document_requirements":
      case "application_documents":
      case "visa_application_answers":
      case "ocr_extractions":
        data = [];
        break;
      default:
        response.writeHead(404).end();
        return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(data));
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-document-fixture-service-key");
    getClientSessionWithFallback.mockResolvedValue({ userId: APPLICANT_ID, email: "synthetic@viza.test" });
    await run({ reads, storagePaths, peakRequests: () => peak, activeRequests: () => active });
  } finally {
    for (const timer of timers) clearTimeout(timer);
    server.closeAllConnections();
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("reusable document existence through the Supabase SDK", () => {
  it("bounds real HEAD requests at four and retains action order, duplicate metadata, and filters", async () => {
    const valid = Array.from({ length: 12 }, (_, index) => ({
      document_type: `synthetic-${index}`, storage_path: `synthetic/file-${index}.pdf`,
      filename: `file-${index}.pdf`, status: ["uploaded", "validated", "accepted", "approved"][index % 4],
    }));
    const duplicate = { ...valid[0], document_type: "synthetic-duplicate", filename: null };
    const candidates: Candidate[] = [valid[0], duplicate, ...valid.slice(1),
      { ...valid[0], storage_path: "missing.pdf" },
      { ...valid[0], storage_path: "rejected.pdf", status: "rejected" },
      { ...valid[0], storage_path: "pending.pdf", status: "pending" },
      { ...valid[0], document_type: "rejected-alias", status: "rejected" },
      { ...valid[0], storage_path: null },
      { ...valid[0], storage_path: "" },
    ];
    await withLocalDocuments(candidates, async ({ reads, storagePaths, peakRequests, activeRequests }) => {
      const result = await loadDocumentCenterData({ applicationId: APPLICATION_ID });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);
      expect(result.data.reusableProfileDocuments).toEqual([valid[0], duplicate, ...valid.slice(1)]
        .map((row) => ({ documentType: row.document_type, filename: row.filename })));
      expect(storagePaths).toHaveLength(13);
      expect(new Set(storagePaths).size).toBe(13);
      expect(peakRequests()).toBe(4);
      expect(activeRequests()).toBe(0);
      expect(reads.every((read) => ["GET", "HEAD"].includes(read.method ?? ""))).toBe(true);
      const query = reads.find((read) => read.url.pathname === "/rest/v1/universal_profile_documents")?.url.searchParams;
      expect(query?.get("applicant_id")).toBe(`eq.${APPLICANT_ID}`);
      expect(query?.get("select")).toBe("document_type,storage_path,filename,status");
      expect(query?.get("status")).toBe("in.(uploaded,validated,accepted,approved)");
      expect(query?.get("order")).toBe("updated_at.desc.nullslast");
    });
  });

  it("stops queued checks on SDK 503 rejection and drains the in-flight requests", async () => {
    await withLocalDocuments([], async ({ storagePaths, peakRequests, activeRequests }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const paths = ["unavailable.pdf", "slow-1.pdf", "slow-2.pdf", "slow-3.pdf", "queued.pdf"];
      await expect(loadExistingDocumentPaths(paths, (path) => admin.storage.from("application-documents").exists(path)))
        .rejects.toBeDefined();
      expect(storagePaths.slice().sort()).toEqual(paths.slice(0, 4).sort());
      expect(peakRequests()).toBe(4);
      expect(activeRequests()).toBe(0);
    });
  });

  it("rejects unauthenticated document loads before any database or Storage request", async () => {
    await withLocalDocuments([], async ({ reads }) => {
      getClientSessionWithFallback.mockResolvedValue(null);
      expect(await loadDocumentCenterData({ applicationId: APPLICATION_ID })).toEqual({
        ok: false, code: "not_authenticated", error: "Not authenticated",
      });
      expect(reads).toEqual([]);
    });
  });
});
