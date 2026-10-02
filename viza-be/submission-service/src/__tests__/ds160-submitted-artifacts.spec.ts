import assert from "node:assert/strict";
import test from "node:test";
import { persistDs160SubmittedArtifacts } from "../ds160-submitted-artifacts";

test("private proof storage failure returns an honest unavailable outcome", async () => {
  let uploadCalls = 0;
  const result = await persistDs160SubmittedArtifacts({
    capture: async () => ({ confirmationPdfPath: "confirmation.pdf" }),
    upload: async () => {
      uploadCalls += 1;
      throw new Error("private storage unavailable");
    },
  });

  assert.equal(uploadCalls, 1);
  assert.deepEqual(result.storagePaths, {});
  assert.deepEqual(result.status, { status: "unavailable", failureStage: "storage" });
});

test("capture failure never invokes private storage", async () => {
  let uploadCalls = 0;
  const result = await persistDs160SubmittedArtifacts({
    capture: async () => { throw new Error("page closed"); },
    upload: async () => {
      uploadCalls += 1;
      return { confirmationPdfStoragePath: "should-not-exist" };
    },
  });

  assert.equal(uploadCalls, 0);
  assert.deepEqual(result.storagePaths, {});
  assert.deepEqual(result.status, { status: "unavailable", failureStage: "confirmation_capture" });
});

test("acknowledged proof storage reports stored artifact kinds", async () => {
  const result = await persistDs160SubmittedArtifacts({
    capture: async () => ({ confirmationPdfPath: "confirmation.pdf" }),
    upload: async () => ({ confirmationPdfStoragePath: "private/confirmation.pdf" }),
  });

  assert.deepEqual(result.status, { status: "available", storedKinds: ["confirmationPdfStoragePath"] });
  assert.deepEqual(result.storagePaths, { confirmationPdfStoragePath: "private/confirmation.pdf" });
});
