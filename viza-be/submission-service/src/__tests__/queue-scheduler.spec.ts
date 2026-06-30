import test from "node:test";
import assert from "node:assert/strict";

import {
  getSubmissionConcurrencyKey,
  readSubmissionQueueConcurrency,
  runSubmissionQueueBatch,
} from "../queue-scheduler";
import type { SubmissionQueueItem } from "../types";

function queueItem(
  id: string,
  overrides: Partial<SubmissionQueueItem> = {},
): SubmissionQueueItem {
  return {
    id,
    application_id: `app-${id}`,
    user_id: "user-1",
    status: "sgac_live_assisted_pending",
    attempts: 0,
    mode: "live_assisted",
    provider: "sg_arrival_card_live",
    last_error: null,
    ceac_result_payload: null,
    fv_result_payload: null,
    fv_application_reference: null,
    fv_pdf_storage_path: null,
    uk_result_payload: null,
    uk_application_reference: null,
    au_result_payload: null,
    au_trn: null,
    au_review_screenshot_storage_path: null,
    created_at: "2026-06-30T00:00:00.000Z",
    updated_at: "2026-06-30T00:00:00.000Z",
    ...overrides,
  };
}

test("concurrency key separates different users and providers", () => {
  assert.deepEqual(
    getSubmissionConcurrencyKey(
      queueItem("a", {
        user_id: "user-a",
        provider: "sg_arrival_card_live",
      }),
    ),
    {
      applicationKey: "application:app-a",
      accountCountryKey: "account-country:user-a:sg_arrival_card_live",
    },
  );

  assert.notEqual(
    getSubmissionConcurrencyKey(
      queueItem("a", {
        user_id: "user-a",
        provider: "sg_arrival_card_live",
      }),
    ).accountCountryKey,
    getSubmissionConcurrencyKey(
      queueItem("b", {
        user_id: "user-a",
        provider: "malaysia_mdac_live",
      }),
    ).accountCountryKey,
  );
});

test("runner batch processes different account-country keys concurrently", async () => {
  const first = queueItem("a", {
    user_id: "user-a",
    provider: "sg_arrival_card_live",
  });
  const second = queueItem("b", {
    user_id: "user-b",
    provider: "malaysia_mdac_live",
  });
  const started: string[] = [];
  let firstRelease: () => void = () => {
    throw new Error("first release was not initialized");
  };
  const firstCanFinish = new Promise<void>((resolve) => {
    firstRelease = resolve;
  });

  const batch = runSubmissionQueueBatch(
    [first, second],
    async (item) => {
      started.push(item.id);
      if (item.id === "a") await firstCanFinish;
    },
    { concurrency: 2 },
  );

  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(started, ["a", "b"]);
  firstRelease();
  await batch;
});

test("runner batch serializes the same user's same provider", async () => {
  const first = queueItem("a", {
    user_id: "user-a",
    provider: "thailand_tdac_live",
  });
  const second = queueItem("b", {
    user_id: "user-a",
    provider: "thailand_tdac_live",
  });
  const started: string[] = [];
  let firstRelease: () => void = () => {
    throw new Error("first release was not initialized");
  };
  const firstCanFinish = new Promise<void>((resolve) => {
    firstRelease = resolve;
  });

  const batch = runSubmissionQueueBatch(
    [first, second],
    async (item) => {
      started.push(item.id);
      if (item.id === "a") await firstCanFinish;
    },
    { concurrency: 2 },
  );

  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(started, ["a"]);
  firstRelease();
  await batch;
  assert.deepEqual(started, ["a", "b"]);
});

test("runner batch serializes the same application across providers", async () => {
  const first = queueItem("a", {
    application_id: "app-shared",
    user_id: "user-a",
    provider: "sg_arrival_card_live",
  });
  const second = queueItem("b", {
    application_id: "app-shared",
    user_id: "user-a",
    provider: "malaysia_mdac_live",
  });
  const started: string[] = [];
  let firstRelease: () => void = () => {
    throw new Error("first release was not initialized");
  };
  const firstCanFinish = new Promise<void>((resolve) => {
    firstRelease = resolve;
  });

  const batch = runSubmissionQueueBatch(
    [first, second],
    async (item) => {
      started.push(item.id);
      if (item.id === "a") await firstCanFinish;
    },
    { concurrency: 2 },
  );

  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(started, ["a"]);
  firstRelease();
  await batch;
  assert.deepEqual(started, ["a", "b"]);
});

test("readSubmissionQueueConcurrency defaults to the current local maximum and clamps unsafe values", () => {
  assert.equal(readSubmissionQueueConcurrency({}), 10);
  assert.equal(readSubmissionQueueConcurrency({ SUBMISSION_SERVICE_MAX_CONCURRENCY: "4" }), 4);
  assert.equal(readSubmissionQueueConcurrency({ SUBMISSION_SERVICE_MAX_CONCURRENCY: "50" }), 10);
  assert.equal(readSubmissionQueueConcurrency({ SUBMISSION_SERVICE_MAX_CONCURRENCY: "0" }), 1);
  assert.equal(readSubmissionQueueConcurrency({ SUBMISSION_SERVICE_MAX_CONCURRENCY: "nope" }), 1);
});
