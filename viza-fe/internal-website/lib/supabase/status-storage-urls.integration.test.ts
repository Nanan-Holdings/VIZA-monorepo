// @vitest-environment node

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn() }));

import { createAdminClient } from "./admin";
import { loadStatusStorageUrls } from "@/app/client/status/status-storage-urls";

type ObservedBatch = {
  method: string | undefined;
  bucket: string;
  paths: string[];
  expiresIn: number;
};

async function withLocalStorage(
  run: (fixture: {
    baseUrl: string;
    batches: ObservedBatch[];
    peakRequests: () => number;
  }) => Promise<void>,
): Promise<void> {
  const batches: ObservedBatch[] = [];
  let active = 0;
  let peak = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString()) as {
        paths: string[];
        expiresIn: number;
      };
      const bucket = (request.url ?? "").replace("/storage/v1/object/sign/", "");
      batches.push({ method: request.method, bucket, ...body });
      active += 1;
      peak = Math.max(peak, active);
      const timer = setTimeout(() => {
        timers.delete(timer);
        active -= 1;
        response.setHeader("content-type", "application/json");
        if (bucket === "unavailable-bucket") {
          response.statusCode = 503;
          response.end(JSON.stringify({ message: "Synthetic storage failure", statusCode: "503" }));
          return;
        }
        // Real Storage uses signedURL; the SDK maps it to an absolute signedUrl.
        response.end(JSON.stringify(body.paths.map((path) => ({
          path,
          error: path === "missing.pdf" ? "Object not found" : null,
          signedURL: path === "missing.pdf"
            ? null
            : `/object/sign/${bucket}/${path}?token=local-only`,
        }))));
      }, 15);
      timers.add(timer);
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", baseUrl);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-storage-fixture-service-key");
    await run({ baseUrl, batches, peakRequests: () => peak });
  } finally {
    for (const timer of timers) clearTimeout(timer);
    server.closeAllConnections();
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

afterEach(() => vi.unstubAllEnvs());

describe("status Storage signing through the Supabase SDK", () => {
  it("uses bounded batch POSTs and maps real SDK signed URLs by bucket and path", async () => {
    await withLocalStorage(async ({ baseUrl, batches, peakRequests }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const targets = Array.from({ length: 201 }, (_, index) => ({
        bucket: "application-documents",
        path: `synthetic/receipt-${index}.pdf`,
      }));
      targets.push(targets[0], targets[0], {
        bucket: "submission-artifacts", path: targets[0].path,
      });
      const urls = await loadStatusStorageUrls(targets, (bucket, paths, expiresIn) =>
        admin.storage.from(bucket).createSignedUrls(paths, expiresIn));

      expect(batches).toHaveLength(4);
      expect(batches.every((batch) => batch.method === "POST" && batch.expiresIn === 3_600)).toBe(true);
      expect(batches.every((batch) => batch.paths.length <= 100)).toBe(true);
      expect(batches.reduce((total, batch) => total + batch.paths.length, 0)).toBe(202);
      expect(peakRequests()).toBe(2);
      expect(urls.get("application-documents")?.size).toBe(201);
      expect(urls.get("submission-artifacts")?.size).toBe(1);
      for (const bucket of ["application-documents", "submission-artifacts"]) {
        expect(urls.get(bucket)?.get(targets[0].path)).toBe(
          `${baseUrl}/storage/v1/object/sign/${bucket}/${targets[0].path}?token=local-only`,
        );
      }
    });
  });

  it("keeps partial and failed bucket results separate without per-file retry", async () => {
    await withLocalStorage(async ({ batches }) => {
      const admin = createAdminClient({ requestTimeoutMs: 2_500, retryDelaysMs: [] });
      const urls = await loadStatusStorageUrls([
        { bucket: "application-documents", path: "available.pdf" },
        { bucket: "application-documents", path: "missing.pdf" },
        { bucket: "unavailable-bucket", path: "available.pdf" },
      ], (bucket, paths, expiresIn) => admin.storage.from(bucket).createSignedUrls(paths, expiresIn));

      expect(batches).toHaveLength(2);
      expect(urls.get("application-documents")?.get("available.pdf")).toContain("available.pdf?token=local-only");
      expect(urls.get("application-documents")?.has("missing.pdf")).toBe(false);
      expect(urls.get("unavailable-bucket")?.get("available.pdf")).toBeUndefined();
    });
  });
});
