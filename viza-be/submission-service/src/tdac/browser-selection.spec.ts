import assert from "node:assert/strict";
import test from "node:test";

import { resolveArrivalCardBrowserEndpoint } from "../arrival-card-browser";
import { browserbaseEnabled } from "../browserbase-session";

const ORIGINAL_ENV = { ...process.env };

function resetEnv(): void {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.TDAC_BROWSERBASE_ENABLED;
  delete process.env.TDAC_BROWSER_API_ENDPOINT;
  delete process.env.TDAC_BRIGHTDATA_BROWSER_API_ENDPOINT;
  delete process.env.TDAC_USE_GLOBAL_BROWSER_API;
  delete process.env.BRIGHTDATA_BROWSER_WS;
  delete process.env.BRIGHTDATA_BROWSER_API_ENDPOINT;
  delete process.env.SBR_WS_ENDPOINT;
}

test.afterEach(resetEnv);

test("TDAC defaults to Browserbase and permits an explicit diagnostic opt-out", () => {
  resetEnv();
  assert.equal(browserbaseEnabled("TDAC", true), true);

  process.env.TDAC_BROWSERBASE_ENABLED = "false";
  assert.equal(browserbaseEnabled("TDAC", true), false);
});

test("TDAC no longer inherits Bright Data endpoints", () => {
  resetEnv();
  process.env.TDAC_BRIGHTDATA_BROWSER_API_ENDPOINT = "wss://tdac-bright-data.example";
  process.env.BRIGHTDATA_BROWSER_API_ENDPOINT = "wss://global-bright-data.example";
  process.env.TDAC_USE_GLOBAL_BROWSER_API = "true";

  assert.equal(resolveArrivalCardBrowserEndpoint("TDAC"), null);

  process.env.TDAC_BROWSER_API_ENDPOINT = "wss://operator-cdp.example";
  assert.equal(resolveArrivalCardBrowserEndpoint("TDAC"), "wss://operator-cdp.example");
});
