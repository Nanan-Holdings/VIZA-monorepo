import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  Ds160AuditStorageError,
  writeDs160AuditArtifact,
} from "../audit-storage";

const jobId = "11111111-1111-1111-1111-111111111111";
const runId = "ds160-live-test-run";
const ciphertext = "encrypted-evidence-bytes";
const expectedPath = `jobs/${jobId}/${runId}/official-evidence.enc`;
const expectedSha256 = createHash("sha256").update(ciphertext).digest("hex");
type StorageInput = { path: string; body: Uint8Array; signal: AbortSignal };
type DownloadInput = { path: string; signal: AbortSignal };

function options(
  transport: {
    upload: (input: StorageInput) => Promise<void>;
    download: (input: DownloadInput) => Promise<Uint8Array | null>;
  },
  overrides: Partial<Parameters<typeof writeDs160AuditArtifact>[0]> = {},
) {
  return {
    jobId,
    runId,
    transport: {
      upload: async (input: StorageInput) => transport.upload(input),
      download: async (input: DownloadInput) => transport.download(input),
    },
    sleep: async () => undefined,
    ...overrides,
  };
}

test("retries a transient upload once and returns only after acknowledgement", async () => {
  let uploads = 0;
  let downloads = 0;
  const stored: Array<{ name: string; path: string; sha256: string }> = [];
  const ref = await writeDs160AuditArtifact(
    {
      ...options({
        upload: async () => {
          uploads += 1;
          if (uploads === 1) throw new Error("fetch failed");
        },
        download: async () => {
          downloads += 1;
          return null;
        },
      }),
      onStored: value => { stored.push(value); },
    },
    "official-evidence.enc",
    ciphertext,
  );

  assert.equal(uploads, 2);
  assert.equal(downloads, 1);
  assert.deepEqual(ref, { path: expectedPath, sha256: expectedSha256, sizeBytes: Buffer.byteLength(ciphertext) });
  assert.deepEqual(stored, [{ name: "official-evidence.enc", ...ref }]);
});

test("recovers a lost upload response when the private object has the same bytes", async () => {
  let uploads = 0;
  let downloads = 0;
  const ref = await writeDs160AuditArtifact(
    options({
      upload: async () => {
        uploads += 1;
        throw Object.assign(new Error("connection timed out after commit"), { status: 504 });
      },
      download: async () => {
        downloads += 1;
        return Buffer.from(ciphertext, "utf8");
      },
    }),
    "official-evidence.enc",
    ciphertext,
  );

  assert.equal(uploads, 1);
  assert.equal(downloads, 1);
  assert.equal(ref.sha256, expectedSha256);
});

test("aborts a stuck upload before the overall deadline, then reconciles the same bytes", async () => {
  let uploads = 0;
  let downloads = 0;
  const ref = await writeDs160AuditArtifact(
    options(
      {
        upload: async ({ signal }) => {
          uploads += 1;
          await new Promise<never>((_, reject) => {
            signal.addEventListener("abort", () => {
              reject(Object.assign(new Error("request aborted"), { name: "AbortError" }));
            }, { once: true });
          });
        },
        download: async () => {
          downloads += 1;
          return Buffer.from(ciphertext, "utf8");
        },
      },
      { deadlineMs: 100, operationTimeoutMs: 5 },
    ),
    "official-evidence.enc",
    ciphertext,
  );

  assert.equal(uploads, 1);
  assert.equal(downloads, 1);
  assert.equal(ref.sha256, expectedSha256);
});

test("rejects a 409 object with different bytes without overwriting or retrying", async () => {
  let uploads = 0;
  let downloads = 0;
  await assert.rejects(
    writeDs160AuditArtifact(
      options({
        upload: async () => {
          uploads += 1;
          throw Object.assign(new Error("The object already exists"), { status: 409 });
        },
        download: async () => {
          downloads += 1;
          return Buffer.from("different-evidence", "utf8");
        },
      }),
      "official-evidence.enc",
      ciphertext,
    ),
    (error: unknown) => error instanceof Ds160AuditStorageError && error.code === "AUDIT_STORAGE_CONFLICT",
  );
  assert.equal(uploads, 1);
  assert.equal(downloads, 1);
});

test("rejects authorization errors immediately", async () => {
  let uploads = 0;
  let downloads = 0;
  await assert.rejects(
    writeDs160AuditArtifact(
      options({
        upload: async () => {
          uploads += 1;
          throw Object.assign(new Error("Forbidden"), { status: 403 });
        },
        download: async () => {
          downloads += 1;
          return null;
        },
      }),
      "official-evidence.enc",
      ciphertext,
    ),
    (error: unknown) => error instanceof Ds160AuditStorageError && error.code === "AUDIT_STORAGE_AUTHORIZATION",
  );
  assert.equal(uploads, 1);
  assert.equal(downloads, 0);
});

test("rejects a missing bucket immediately without reconciliation or retry", async () => {
  let uploads = 0;
  let downloads = 0;
  await assert.rejects(
    writeDs160AuditArtifact(
      options({
        upload: async () => {
          uploads += 1;
          throw Object.assign(new Error("Bucket not found"), { status: 404 });
        },
        download: async () => {
          downloads += 1;
          return null;
        },
      }),
      "official-evidence.enc",
      ciphertext,
    ),
    (error: unknown) => error instanceof Ds160AuditStorageError && error.code === "AUDIT_STORAGE_BUCKET_MISSING",
  );
  assert.equal(uploads, 1);
  assert.equal(downloads, 0);
});

test("checks ownership after an acknowledged upload before reporting persistence", async () => {
  let ownershipChecks = 0;
  let storedCallbacks = 0;
  await assert.rejects(
    writeDs160AuditArtifact(
      {
        ...options({
          upload: async () => undefined,
          download: async () => null,
        }),
        assertActive: () => {
          ownershipChecks += 1;
          if (ownershipChecks === 2) throw new Error("lease expired after upload");
        },
        onStored: () => { storedCallbacks += 1; },
      },
      "official-evidence.enc",
      ciphertext,
    ),
    (error: unknown) => error instanceof Ds160AuditStorageError && error.code === "AUDIT_STORAGE_OWNERSHIP",
  );
  assert.equal(ownershipChecks, 2);
  assert.equal(storedCallbacks, 0);
});

test("stops at the deadline instead of starting another upload", async () => {
  let current = 0;
  let uploads = 0;
  let downloads = 0;
  await assert.rejects(
    writeDs160AuditArtifact(
      options(
        {
          upload: async () => {
            uploads += 1;
            throw new Error("network timeout");
          },
          download: async () => {
            downloads += 1;
            return null;
          },
        },
        {
          now: () => current,
          deadlineMs: 50,
          sleep: async () => { current = 100; },
        },
      ),
      "official-evidence.enc",
      ciphertext,
    ),
    (error: unknown) => error instanceof Ds160AuditStorageError && error.code === "AUDIT_STORAGE_DEADLINE",
  );
  assert.equal(uploads, 1);
  assert.equal(downloads, 1);
});

test("checks ownership before storage and never retries after ownership loss", async () => {
  let uploads = 0;
  await assert.rejects(
    writeDs160AuditArtifact(
      options(
        {
          upload: async () => { uploads += 1; },
          download: async () => null,
        },
        {
          assertActive: () => { throw new Error("lease expired"); },
        },
      ),
      "official-evidence.enc",
      ciphertext,
    ),
    (error: unknown) => error instanceof Ds160AuditStorageError && error.code === "AUDIT_STORAGE_OWNERSHIP",
  );
  assert.equal(uploads, 0);
});
