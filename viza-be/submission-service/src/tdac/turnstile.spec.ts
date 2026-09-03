import assert from "node:assert/strict";
import test from "node:test";
import { buildTdacTurnstileTask } from "./runner.js";

test("TDAC Turnstile maps captured Cloudflare parameters to the shared solver contract", () => {
  assert.deepEqual(buildTdacTurnstileTask({
    sitekey: "  site-key  ",
    pageUrl: " https://tdac.immigration.go.th/arrival-card/#/home ",
    action: " managed ",
    cData: " c-data ",
    chlPageData: " page-data ",
    userAgent: " test-agent ",
  }), {
    siteKey: "site-key",
    pageUrl: "https://tdac.immigration.go.th/arrival-card/#/home",
    action: "managed",
    cdata: "c-data",
    pageData: "page-data",
    userAgent: "test-agent",
  });
});

test("TDAC Turnstile refuses incomplete captured parameters", () => {
  assert.equal(buildTdacTurnstileTask(null), null);
  assert.equal(buildTdacTurnstileTask({ sitekey: "site-key" }), null);
  assert.equal(buildTdacTurnstileTask({ pageUrl: "https://example.test" }), null);
});
