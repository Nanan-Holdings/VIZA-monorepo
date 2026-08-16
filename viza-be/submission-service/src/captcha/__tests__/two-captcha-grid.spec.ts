import { test } from "node:test";
import assert from "node:assert/strict";
import {
  solveGridCaptcha,
  TwoCaptchaZeroBalanceError,
} from "../two-captcha.js";

test("two-captcha grid: submits GridTask and returns one-based click tiles", async () => {
  const previousKey = process.env.TWOCAPTCHA_API_KEY;
  process.env.TWOCAPTCHA_API_KEY = "test-key";

  const requests: Array<{ url: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({ url: String(url), body: parsedBody });

    if (String(url).endsWith("/createTask")) {
      return new Response(JSON.stringify({ errorId: 0, taskId: 12345 }), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        errorId: 0,
        status: "ready",
        solution: { click: [1, 5, 9] },
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    const result = await solveGridCaptcha(Buffer.from("grid-image"), {
      rows: 3,
      columns: 3,
      comment: "Select all images with traffic lights",
      timeoutMs: 20_000,
    });

    assert.deepEqual(result.clicks, [1, 5, 9]);
    assert.equal(result.solveId, "12345");
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0]?.body, {
      clientKey: "test-key",
      task: {
        type: "GridTask",
        body: Buffer.from("grid-image").toString("base64"),
        rows: 3,
        columns: 3,
        comment: "Select all images with traffic lights",
        imgType: "recaptcha",
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) {
      delete process.env.TWOCAPTCHA_API_KEY;
    } else {
      process.env.TWOCAPTCHA_API_KEY = previousKey;
    }
  }
});

test("two-captcha grid: retries a transient createTask 520 within the solve budget", async () => {
  const previousKey = process.env.TWOCAPTCHA_API_KEY;
  process.env.TWOCAPTCHA_API_KEY = "test-key";

  let createCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).endsWith("/createTask")) {
      createCalls += 1;
      if (createCalls === 1) {
        return new Response("temporary edge failure", { status: 520 });
      }
      return new Response(JSON.stringify({ errorId: 0, taskId: 23456 }), { status: 200 });
    }
    return new Response(
      JSON.stringify({ errorId: 0, status: "ready", solution: { click: [2] } }),
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    const result = await solveGridCaptcha(Buffer.from("grid-image"), {
      rows: 2,
      columns: 2,
      comment: "Select the matching tile",
      timeoutMs: 20_000,
    });
    assert.deepEqual(result.clicks, [2]);
    assert.equal(createCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.TWOCAPTCHA_API_KEY;
    else process.env.TWOCAPTCHA_API_KEY = previousKey;
  }
});

test("two-captcha grid: retries result polling without creating a duplicate task", async () => {
  const previousKey = process.env.TWOCAPTCHA_API_KEY;
  process.env.TWOCAPTCHA_API_KEY = "test-key";

  let createCalls = 0;
  let resultCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).endsWith("/createTask")) {
      createCalls += 1;
      return new Response(JSON.stringify({ errorId: 0, taskId: 34567 }), { status: 200 });
    }
    resultCalls += 1;
    if (resultCalls === 1) {
      return new Response("temporary upstream failure", { status: 520 });
    }
    return new Response(
      JSON.stringify({ errorId: 0, status: "ready", solution: { click: [3] } }),
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    const result = await solveGridCaptcha(Buffer.from("grid-image"), {
      rows: 2,
      columns: 2,
      comment: "Select the matching tile",
      timeoutMs: 20_000,
    });
    assert.deepEqual(result.clicks, [3]);
    assert.equal(createCalls, 1);
    assert.equal(resultCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.TWOCAPTCHA_API_KEY;
    else process.env.TWOCAPTCHA_API_KEY = previousKey;
  }
});

test("two-captcha grid: does not retry semantic zero-balance errors", async () => {
  const previousKey = process.env.TWOCAPTCHA_API_KEY;
  process.env.TWOCAPTCHA_API_KEY = "test-key";

  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(
      JSON.stringify({ errorId: 10, errorCode: "ERROR_ZERO_BALANCE" }),
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    await assert.rejects(
      solveGridCaptcha(Buffer.from("grid-image"), {
        rows: 2,
        columns: 2,
        comment: "Select the matching tile",
        timeoutMs: 10_000,
      }),
      TwoCaptchaZeroBalanceError,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.TWOCAPTCHA_API_KEY;
    else process.env.TWOCAPTCHA_API_KEY = previousKey;
  }
});
