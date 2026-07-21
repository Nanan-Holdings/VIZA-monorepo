import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveArrivalCardBrowserEndpoint,
  resolveArrivalCardLaunchChannel,
  resolveArrivalCardLocalCdpEndpoint,
} from "../../arrival-card-browser";
import {
  PH_ETRAVEL_EXISTING_ACCOUNT_NOTICE_GRACE_MS,
  isPhEtravelRegistrationResponseRejected,
  isPhEtravelMpinRejectedText,
  isPhEtravelRemotePolicyBlockMessage,
} from "../runner";

const ORIGINAL_ENV = { ...process.env };

function resetEnv(): void {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.PH_ETRAVEL_BROWSER_API_ENDPOINT;
  delete process.env.PH_ETRAVEL_BRIGHTDATA_BROWSER_API_ENDPOINT;
  delete process.env.PH_ETRAVEL_USE_GLOBAL_BROWSER_API;
  delete process.env.PH_ETRAVEL_CDP_ENDPOINT;
  delete process.env.PH_ETRAVEL_CHROME_CDP_ENDPOINT;
  delete process.env.VN_PREARRIVAL_PLAYWRIGHT_CHANNEL;
  delete process.env.BRIGHTDATA_BROWSER_WS;
  delete process.env.BRIGHTDATA_BROWSER_API_ENDPOINT;
  delete process.env.SBR_WS_ENDPOINT;
}

test.afterEach(resetEnv);

test("PH eTravel uses a country endpoint before the configured global Browser API", () => {
  resetEnv();
  process.env.BRIGHTDATA_BROWSER_WS = "wss://global-browser.example";

  assert.equal(resolveArrivalCardBrowserEndpoint("PH_ETRAVEL"), "wss://global-browser.example");

  process.env.PH_ETRAVEL_BROWSER_API_ENDPOINT = "wss://country-browser.example";
  assert.equal(resolveArrivalCardBrowserEndpoint("PH_ETRAVEL"), "wss://country-browser.example");
});

test("PH eTravel retries rejected registration API responses instead of waiting for mail", () => {
  assert.equal(isPhEtravelRegistrationResponseRejected(422), true);
  assert.equal(isPhEtravelRegistrationResponseRejected(429), true);
  assert.equal(isPhEtravelRegistrationResponseRejected(200), false);
});

test("PH eTravel gives a delayed OTP priority over a registration-attempt notice", () => {
  assert.equal(PH_ETRAVEL_EXISTING_ACCOUNT_NOTICE_GRACE_MS, 90_000);
});

test("PH eTravel can resolve a local Chrome CDP endpoint before launching a fresh browser", () => {
  resetEnv();
  process.env.PH_ETRAVEL_CDP_ENDPOINT = "http://127.0.0.1:9224";

  assert.equal(resolveArrivalCardLocalCdpEndpoint("PH_ETRAVEL"), "http://127.0.0.1:9224");
});

test("Vietnam Pre-Arrival defaults to bundled Chromium unless an operator configures a channel", () => {
  resetEnv();
  assert.equal(resolveArrivalCardLaunchChannel("VN_PREARRIVAL"), undefined);

  process.env.VN_PREARRIVAL_PLAYWRIGHT_CHANNEL = "chrome";
  assert.equal(resolveArrivalCardLaunchChannel("VN_PREARRIVAL"), "chrome");

  process.env.VN_PREARRIVAL_PLAYWRIGHT_CHANNEL = "bundled";
  assert.equal(resolveArrivalCardLaunchChannel("VN_PREARRIVAL"), undefined);
});

test("PH eTravel treats Bright Data government policy blocks as remote fallback candidates", () => {
  assert.equal(
    isPhEtravelRemotePolicyBlockMessage(
      "Access denied: etravel.gov.ph is classified as Government and blocked by Bright Data (proxy_error)",
    ),
    true,
  );
  assert.equal(isPhEtravelRemotePolicyBlockMessage("net::ERR_NAME_NOT_RESOLVED"), false);
});

test("PH eTravel detects an eGovPH MPIN rejection without matching generic verification copy", () => {
  assert.equal(isPhEtravelMpinRejectedText("Invalid Credentials"), true);
  assert.equal(isPhEtravelMpinRejectedText("Incorrect MPIN. Please try again."), true);
  assert.equal(isPhEtravelMpinRejectedText("Enter your 6-digit passcode"), false);
  assert.equal(isPhEtravelMpinRejectedText("Important Account Security Notice"), false);
});
