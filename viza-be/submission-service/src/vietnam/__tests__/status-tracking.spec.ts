import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { computeVietnamTrackingSlot } from "../status-tracking-schedule.js";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role";

test("vn.status-tracking: assigns a deterministic 02:00-04:59 Vietnam slot", () => {
  const now = new Date("2026-07-18T00:00:00.000Z");
  const first = computeVietnamTrackingSlot(
    "11111111-1111-4111-8111-111111111111",
    now,
  );
  const second = computeVietnamTrackingSlot(
    "11111111-1111-4111-8111-111111111111",
    now,
  );
  assert.deepEqual(first, second);
  assert.ok(first.hour >= 2 && first.hour <= 4);
  assert.ok(first.minute >= 0 && first.minute <= 59);
  assert.ok(Date.parse(first.nextDailyCheckAt) > now.getTime());
});

test("vn.status-tracking: advances to the next Vietnam day after today's slot", () => {
  const applicationId = "22222222-2222-4222-8222-222222222222";
  const morning = computeVietnamTrackingSlot(
    applicationId,
    new Date("2026-07-17T17:05:00.000Z"),
  );
  const afterSlot = computeVietnamTrackingSlot(
    applicationId,
    new Date("2026-07-18T12:00:00.000Z"),
  );
  assert.equal(
    Date.parse(afterSlot.nextDailyCheckAt) -
      Date.parse(morning.nextDailyCheckAt),
    24 * 60 * 60 * 1_000,
  );
});

test("vn.status-tracking: treats a duplicate plain insert as an idempotent success", async () => {
  const { insertIgnoringDuplicate } = await import("../status-tracking.js");

  const inserted = await insertIgnoringDuplicate(
    Promise.resolve({ error: { code: "23505", message: "duplicate key" } }),
  );

  assert.equal(inserted, false);
});

test("vn.status-tracking: reports a newly inserted row", async () => {
  const { insertIgnoringDuplicate } = await import("../status-tracking.js");

  const inserted = await insertIgnoringDuplicate(
    Promise.resolve({ error: null }),
  );

  assert.equal(inserted, true);
});

test("vn.status-tracking: rethrows non-duplicate plain insert errors", async () => {
  const { insertIgnoringDuplicate } = await import("../status-tracking.js");
  const error = { code: "42P10", message: "conflict target is not usable" };

  await assert.rejects(
    insertIgnoringDuplicate(Promise.resolve({ error })),
    (caught: unknown) =>
      caught instanceof Error && caught.message === error.message,
  );
});

test("vn.status-tracking: complete patch carries independent reference and visa fields without caller timestamps", async () => {
  const {
    buildVietnamStatusCompletePatch,
    vietnamEvisaArtifactObjectPath,
    vietnamStatusApplicationUrl,
  } = await import("../status-tracking.js");
  const applicationId = "11111111-1111-4111-8111-111111111111";
  const sha256 = "a".repeat(64);
  const artifactPath = `submission-artifacts/user-1/${applicationId}/VN/evisa-${sha256}.pdf`;
  const built = buildVietnamStatusCompletePatch({
    applicationId,
    registrationCode: "REG-123",
    result: {
      status: "approved",
      visaNumber: "VISA-456",
      deniedReason: null,
      downloadAvailable: true,
    },
    artifact: { storagePath: artifactPath, sha256, changed: true },
    existingArtifactPath: null,
    env: { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://viza.example" },
  });
  assert.equal(built.patch.official_reference, "REG-123");
  assert.equal(built.patch.visa_number, "VISA-456");
  assert.equal(built.patch.application_url, `${vietnamStatusApplicationUrl(applicationId, {
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://viza.example",
  })}`);
  assert.equal(built.patch.artifact_storage_path, artifactPath);
  assert.equal(built.patch.artifact_sha256, sha256);
  assert.equal("result_status" in built.patch, false);
  assert.equal("checked_at" in built.patch, false);
  assert.equal("updated_at" in built.patch, false);
  assert.equal(
    vietnamEvisaArtifactObjectPath("user-1", applicationId, sha256),
    `user-1/${applicationId}/VN/evisa-${sha256}.pdf`,
  );
});

test("vn.status-tracking: no new PDF keeps an existing artifact and omits upload fields", async () => {
  const { buildVietnamStatusCompletePatch } = await import("../status-tracking.js");
  const built = buildVietnamStatusCompletePatch({
    applicationId: "22222222-2222-4222-8222-222222222222",
    registrationCode: "REG-OLD",
    result: {
      status: "approved",
      visaNumber: "VISA-OLD",
      deniedReason: null,
      downloadAvailable: false,
    },
    artifact: null,
    existingArtifactPath: "submission-artifacts/user-2/existing.pdf",
    env: { NODE_ENV: "test", NEXT_PUBLIC_SITE_URL: "https://viza.example" },
  });
  assert.equal(built.documentReady, true);
  assert.equal("artifact_storage_path" in built.patch, false);
  assert.equal("artifact_sha256" in built.patch, false);
  assert.equal(
    (built.patch.raw_status_json as Record<string, unknown>).document_ready,
    true,
  );
});

test("vn.status-tracking: deterministic artifact upload uses an object key inside the bucket", async () => {
  const { uploadArtifact } = await import("../../artifact-storage.js");
  const { supabase } = await import("../../supabase.js");
  const mutableStorage = supabase.storage as unknown as Record<string, unknown>;
  const originalFrom = mutableStorage.from;
  let seenBucket: unknown;
  let seenObjectPath: unknown;
  mutableStorage.from = (bucket: unknown) => {
    seenBucket = bucket;
    return {
      upload: async (objectPath: unknown) => {
        seenObjectPath = objectPath;
        return { error: null };
      },
    };
  };
  try {
    const objectPath = "user-3/app-3/VN/evisa-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf";
    const returned = await uploadArtifact({
      authUserId: "user-3",
      applicationId: "app-3",
      country: "VN",
      kind: "evisa",
      ext: "pdf",
      contentType: "application/pdf",
      data: Buffer.from("pdf"),
      objectPath,
    });
    assert.equal(returned, objectPath);
    assert.equal(seenBucket, "submission-artifacts");
    assert.equal(seenObjectPath, objectPath);
    assert.equal(String(seenObjectPath).startsWith("submission-artifacts/"), false);
  } finally {
    mutableStorage.from = originalFrom;
  }
});

test("vn.status-tracking: production URL configuration fails closed and prefers NEXT_PUBLIC_SITE_URL", async () => {
  const { vietnamStatusApplicationUrl } = await import("../status-tracking.js");
  const applicationId = "33333333-3333-4333-8333-333333333333";
  assert.equal(
    vietnamStatusApplicationUrl(applicationId, {
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://primary.example/",
      PUBLIC_SITE_URL: "https://legacy.example",
    }),
    `https://primary.example/client/status?applicationId=${applicationId}`,
  );
  assert.throws(
    () => vietnamStatusApplicationUrl(applicationId, { NODE_ENV: "production" }),
    /NEXT_PUBLIC_SITE_URL/,
  );
  assert.throws(
    () => vietnamStatusApplicationUrl(applicationId, {
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "javascript:alert(1)",
    }),
    /absolute http\(s\)/,
  );
});

test("vn.status-tracking: owned settlement has no direct application/tracking/document/event writes", async () => {
  const sourcePath = resolve(process.cwd(), "src/vietnam/status-tracking.ts");
  const source = await readFile(sourcePath, "utf8");
  const start = source.indexOf("async function processClaimedCheckOwned");
  const end = source.indexOf("async function defaultVietnamStatusCheckFailure");
  assert.ok(start >= 0 && end > start);
  const settlement = source.slice(start, end);
  assert.doesNotMatch(settlement, /\.from\("applications"\)\.update/);
  assert.doesNotMatch(settlement, /\.from\("official_application_tracking"\)\.update/);
  assert.doesNotMatch(settlement, /\.from\("application_documents"\)\.(insert|upsert|update)/);
  assert.doesNotMatch(settlement, /\.from\("(?:application_events|notification_events|notification_event_log)"\)\.insert/);
  assert.doesNotMatch(settlement, /\.from\("official_status_checks"\)\.insert/);
});

test("vn.status-tracking: shares the gate capacity parser default and fail-loud validation", async () => {
  const { vietnamStatusGateCapacity } = await import("../status-tracking.js");
  assert.equal(vietnamStatusGateCapacity({}), 1);
  assert.throws(
    () => vietnamStatusGateCapacity({ RESILIENCE_VN_STATUS_GATE_CAPACITY: "0" }),
    /RESILIENCE_VN_STATUS_GATE_CAPACITY/,
  );
  assert.throws(
    () => vietnamStatusGateCapacity({ RESILIENCE_VN_STATUS_GATE_CAPACITY: "1.5" }),
    /RESILIENCE_VN_STATUS_GATE_CAPACITY/,
  );
});

test("vn.status-tracking: disabled gate ignores an invalid capacity environment", async () => {
  const { withVietnamStatusResilienceGate } = await import("../status-tracking.js");
  const previousEnabled = process.env.RESILIENCE_VN_STATUS_GATE_ENABLED;
  const previousCapacity = process.env.RESILIENCE_VN_STATUS_GATE_CAPACITY;
  process.env.RESILIENCE_VN_STATUS_GATE_ENABLED = "false";
  process.env.RESILIENCE_VN_STATUS_GATE_CAPACITY = "not-an-integer";
  let operationCalls = 0;
  try {
    await withVietnamStatusResilienceGate(
      {
        workerId: "worker-disabled",
        checkId: "check-disabled",
        operation: async () => {
          operationCalls += 1;
          return "ok";
        },
      },
      {
        acquire: async (input) => {
          assert.equal(input.capacity, 1);
          return null;
        },
        renew: async () => null,
        release: async () => true,
      },
    );
  } finally {
    if (previousEnabled === undefined) delete process.env.RESILIENCE_VN_STATUS_GATE_ENABLED;
    else process.env.RESILIENCE_VN_STATUS_GATE_ENABLED = previousEnabled;
    if (previousCapacity === undefined) delete process.env.RESILIENCE_VN_STATUS_GATE_CAPACITY;
    else process.env.RESILIENCE_VN_STATUS_GATE_CAPACITY = previousCapacity;
  }
  assert.equal(operationCalls, 1);
});

test("vn.status-tracking: an aborted DB lease blocks portal work even when provider gate is disabled", async () => {
  const {
    withVietnamStatusResilienceGate,
    VietnamStatusCheckOwnershipLostError,
  } = await import("../status-tracking.js");
  const controller = new AbortController();
  controller.abort();
  let operationCalls = 0;
  await assert.rejects(
    withVietnamStatusResilienceGate(
      {
        workerId: "worker-aborted",
        checkId: "check-aborted",
        signal: controller.signal,
        operation: async () => {
          operationCalls += 1;
        },
      },
      {
        acquire: async () => null,
        renew: async () => null,
        release: async () => true,
      },
    ),
    VietnamStatusCheckOwnershipLostError,
  );
  assert.equal(operationCalls, 0);
});

const claimedCheck = {
  id: "check-1",
  application_id: "application-1",
  user_id: "user-1",
  trigger_source: "daily",
  inbound_email_id: null,
  attempt_count: 1,
  leaseGeneration: 1,
  leaseExpiresAt: "2099-01-01T00:05:00.000Z",
};

test("vn.status-tracking: production batch defers provider denial without settlement or processed count", async () => {
  const {
    processQueuedVietnamStatusChecksWithDependencies,
    VietnamStatusGateDeferredError,
  } = await import("../status-tracking.js");
  let deferCalls = 0;
  let retryAfterSeconds = 0;
  let completeCalls = 0;
  let failCalls = 0;
  const processed = await processQueuedVietnamStatusChecksWithDependencies("worker-a", {
    claim: async () => [claimedCheck],
    processCheck: async () => {
      throw new VietnamStatusGateDeferredError({
        reason: "at_capacity",
        retryAt: Date.now() + 45_000,
      });
    },
    defer: async (_check, _worker, retryAfter) => {
      deferCalls += 1;
      retryAfterSeconds = retryAfter;
      return true;
    },
    complete: async () => {
      completeCalls += 1;
      return true;
    },
    fail: async () => {
      failCalls += 1;
      return true;
    },
    afterFailure: async () => undefined,
  });
  assert.equal(processed, 0);
  assert.equal(deferCalls, 1);
  assert.ok(retryAfterSeconds >= 44 && retryAfterSeconds <= 46);
  assert.equal(completeCalls, 0);
  assert.equal(failCalls, 0);
});

test("vn.status-tracking: production batch propagates permanent gate errors without defer or settlement", async () => {
  const {
    processQueuedVietnamStatusChecksWithDependencies,
  } = await import("../status-tracking.js");
  const { ResilienceGateConfigurationError } = await import("../../resilience-gate.js");
  let deferCalls = 0;
  let completeCalls = 0;
  let failCalls = 0;
  await assert.rejects(
    processQueuedVietnamStatusChecksWithDependencies("worker-a", {
      claim: async () => [claimedCheck],
      processCheck: async () => {
        throw new ResilienceGateConfigurationError("invalid gate config");
      },
      defer: async () => {
        deferCalls += 1;
        return true;
      },
      complete: async () => {
        completeCalls += 1;
        return true;
      },
      fail: async () => {
        failCalls += 1;
        return true;
      },
    }),
    ResilienceGateConfigurationError,
  );
  assert.equal(deferCalls, 0);
  assert.equal(completeCalls, 0);
  assert.equal(failCalls, 0);
});

test("vn.status-tracking: production batch skips all settlement when Postgres or gate ownership is lost", async () => {
  const {
    processQueuedVietnamStatusChecksWithDependencies,
    VietnamStatusCheckOwnershipLostError,
  } = await import("../status-tracking.js");
  let deferCalls = 0;
  let completeCalls = 0;
  let failCalls = 0;
  const processed = await processQueuedVietnamStatusChecksWithDependencies("worker-a", {
    claim: async () => [claimedCheck],
    processCheck: async () => {
      throw new VietnamStatusCheckOwnershipLostError();
    },
    defer: async () => {
      deferCalls += 1;
      return true;
    },
    complete: async () => {
      completeCalls += 1;
      return true;
    },
    fail: async () => {
      failCalls += 1;
      return true;
    },
    afterFailure: async () => undefined,
  });
  assert.equal(processed, 0);
  assert.equal(deferCalls, 0);
  assert.equal(completeCalls, 0);
  assert.equal(failCalls, 0);
});

test("vn.status-tracking: production batch preserves generic portal failure settlement", async () => {
  const { processQueuedVietnamStatusChecksWithDependencies } = await import("../status-tracking.js");
  let failCalls = 0;
  const processed = await processQueuedVietnamStatusChecksWithDependencies("worker-a", {
    claim: async () => [claimedCheck],
    processCheck: async () => {
      throw new Error("portal unavailable");
    },
    fail: async () => {
      failCalls += 1;
      return true;
    },
    afterFailure: async () => undefined,
  });
  assert.equal(processed, 1);
  assert.equal(failCalls, 1);
});
