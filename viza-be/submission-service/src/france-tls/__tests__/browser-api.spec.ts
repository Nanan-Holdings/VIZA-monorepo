import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyFranceTlsBrowserState,
  hasFranceTlsCloudflareChallenge,
  isFranceTlsCaptchaBlocking,
  resolveFranceTlsBrowserSelection,
  shouldWaitForFranceTlsCloudflareClearance,
} from "../browser-api.js";

function withEnv<T>(env: Record<string, string | undefined>, run: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key];
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }
  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("france-tls browser-api: Browserbase ignores TLS-specific, local, and global endpoints", () => {
  const selection = withEnv(
    {
      FRANCE_TLS_BROWSERBASE_ENABLED: "true",
      FRANCE_TLS_BROWSER_API_ENDPOINT: "wss://tls-specific.example",
      FRANCE_TLS_CDP_ENDPOINT: "http://127.0.0.1:9222",
      BRIGHTDATA_BROWSER_API_ENDPOINT: "wss://global.example",
    },
    () => resolveFranceTlsBrowserSelection(),
  );

  assert.deepEqual(selection, {
    kind: "browserbase",
    source: "FRANCE_TLS_BROWSERBASE_ENABLED",
  });
});

test("france-tls browser-api: Browserbase is enabled by default", () => {
  const selection = withEnv(
    { FRANCE_TLS_BROWSERBASE_ENABLED: undefined },
    () => resolveFranceTlsBrowserSelection(),
  );

  assert.deepEqual(selection, {
    kind: "browserbase",
    source: "FRANCE_TLS_BROWSERBASE_ENABLED",
  });
});

test("france-tls browser-api: explicitly disabling Browserbase fails closed", () => {
  assert.throws(
    () => withEnv({
      FRANCE_TLS_BROWSERBASE_ENABLED: "false",
      FRANCE_TLS_BROWSER_API_ENDPOINT: "wss://tls-specific.example",
      BRIGHTDATA_BROWSER_API_ENDPOINT: "wss://global.example",
    }, () => resolveFranceTlsBrowserSelection()),
    /requires Browserbase/i,
  );
});

test("france-tls browser-api: classifies Cloudflare security verification as waf", () => {
  assert.equal(
    classifyFranceTlsBrowserState({
      url: "https://visas-fr.tlscontact.com/en-us/login",
      title: "Just a moment...",
      bodyText: "Performing security verification. This website uses a security service to protect against malicious bots.",
      frameUrls: [],
    }).checkpoint,
    "waf",
  );
});

test("france-tls browser-api: classifies French Cloudflare waiting page as waf", () => {
  assert.equal(
    classifyFranceTlsBrowserState({
      url: "https://visas-fr.tlscontact.com/en-us/login",
      title: "Un instant…",
      bodyText: "Vérification de sécurité. Ray ID: abc123",
      frameUrls: [],
    }).checkpoint,
    "waf",
  );
});

test("france-tls browser-api: detects Cloudflare challenge frames", () => {
  assert.equal(
    hasFranceTlsCloudflareChallenge({
      url: "https://visas-fr.tlscontact.com/en-us/country/cn/vac/cnBJS2fr",
      title: "visas-fr.tlscontact.com",
      bodyText: "请验证您是真人",
      frameUrls: ["https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/if/ov2/av0/rcv0/0/abc"],
    }),
    true,
  );
});

test("france-tls browser-api: does not wait on a passive reCAPTCHA iframe", () => {
  const input = {
    url: "https://visas-fr.tlscontact.com/en-us/registration?issuerId=cnSHA2fr",
    title: "TLScontact registration",
    bodyText: "Register Email Password",
    frameUrls: ["https://www.google.com/recaptcha/api2/anchor?k=site-key"],
  };

  assert.equal(classifyFranceTlsBrowserState(input).checkpoint, "captcha_token");
  assert.equal(isFranceTlsCaptchaBlocking(input), false);
  assert.equal(shouldWaitForFranceTlsCloudflareClearance(input), false);
});

test("france-tls browser-api: treats an explicit login reCAPTCHA error as blocking", () => {
  const input = {
    url: "https://i2-auth.visas-fr.tlscontact.com/auth/realms/atlas/protocol/openid-connect/auth",
    title: "TLScontact Login",
    bodyText: "Complete reCAPTCHA! You need to complete reCAPTCHA to login",
    frameUrls: ["https://www.google.com/recaptcha/api2/anchor?k=site-key"],
  };

  assert.equal(classifyFranceTlsBrowserState(input).checkpoint, "captcha_token");
  assert.equal(isFranceTlsCaptchaBlocking(input), true);
});

test("france-tls browser-api: classifies blank TLS SPA after challenge as waf wait", () => {
  const state = classifyFranceTlsBrowserState({
    url: "https://visas-fr.tlscontact.com/en-us/login",
    title: "",
    bodyText: "",
    frameUrls: [],
  });

  assert.equal(state.checkpoint, "waf");
  assert.match(state.message, /blank/i);
});

test("france-tls browser-api: classifies chrome error pages as site policy", () => {
  const state = classifyFranceTlsBrowserState({
    url: "chrome-error://chromewebdata/",
    title: "visas-fr.tlscontact.com",
    bodyText: "This page isn’t working HTTP ERROR 405",
    frameUrls: [],
  });

  assert.equal(state.checkpoint, "site_policy_review");
});

test("france-tls browser-api: classifies the official generic center error page", () => {
  const state = classifyFranceTlsBrowserState({
    url: "https://visas-fr.tlscontact.com/en-us/country/cn/vac/cnSHA2fr",
    title: "Welcome to TLScontact Shanghai | TLScontact Shanghai",
    bodyText: "Sorry Something went wrong. It looks like something went wrong. Please try to refresh the page or go back.",
    frameUrls: [],
  });

  assert.equal(state.checkpoint, "site_policy_review");
  assert.match(state.message, /generic center error/i);
});

test("france-tls browser-api: does not classify public fee-copy pages as payment", () => {
  const state = classifyFranceTlsBrowserState({
    url: "https://visas-fr.tlscontact.com/en-us/country/cn/vac/cnBJS2fr",
    title: "Welcome to TLScontact Beijing",
    bodyText: "Home Application process Visa application fees LOG IN REGISTER Book an appointment",
    frameUrls: [],
  });

  assert.equal(state.checkpoint, "ready");
});

test("france-tls browser-api: fails closed on an unrecognized non-empty page", () => {
  const state = classifyFranceTlsBrowserState({
    url: "https://visas-fr.tlscontact.com/en-us/unknown",
    title: "Unexpected page",
    bodyText: "Some unrelated content",
    frameUrls: [],
  });
  assert.equal(state.checkpoint, "site_policy_review");
});
