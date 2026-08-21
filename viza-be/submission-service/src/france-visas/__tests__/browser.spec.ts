import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyFranceVisasBrowserState,
  resolveFranceVisasBrowserSelection,
} from "../browser.js";
import { detectFranceVisasPageIdFromUrl } from "../pages.js";

function withEnv<T>(env: Record<string, string | undefined>, run: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("france-visas browser: Browserbase ignores country and global CDP endpoints", () => {
  const selection = withEnv({
    FRANCE_VISAS_BROWSER_API_ENDPOINT: "wss://country.example/secret",
    FRANCE_VISAS_BRIGHTDATA_BROWSER_API_ENDPOINT: "wss://brightdata-country.example/secret",
    FRANCE_VISAS_BROWSERBASE_ENABLED: "true",
    BRIGHTDATA_BROWSER_API_ENDPOINT: "wss://global.example/secret",
    BRIGHTDATA_BROWSER_WS: "wss://global-ws.example/secret",
    SBR_WS_ENDPOINT: "wss://sbr.example/secret",
  }, () => resolveFranceVisasBrowserSelection());

  assert.deepEqual(selection, {
    kind: "browserbase",
    source: "FRANCE_VISAS_BROWSERBASE_ENABLED",
  });
});

test("france-visas browser: Browserbase is enabled by default", () => {
  const selection = withEnv({
    FRANCE_VISAS_BROWSERBASE_ENABLED: undefined,
  }, () => resolveFranceVisasBrowserSelection());

  assert.deepEqual(selection, {
    kind: "browserbase",
    source: "FRANCE_VISAS_BROWSERBASE_ENABLED",
  });
});

test("france-visas browser: explicitly disabling Browserbase fails closed", () => {
  assert.throws(
    () => withEnv({
      FRANCE_VISAS_BROWSERBASE_ENABLED: "false",
      BRIGHTDATA_BROWSER_API_ENDPOINT: "wss://global.example/secret",
    }, () => resolveFranceVisasBrowserSelection()),
    /requires Browserbase/i,
  );
});

test("france-visas browser: blank and French Cloudflare pages fail closed", () => {
  assert.equal(classifyFranceVisasBrowserState({
    url: "https://application-form.france-visas.gouv.fr/fv-fo-dde/accueil.xhtml",
    title: "",
    bodyText: "",
  }).checkpoint, "blank");

  assert.equal(classifyFranceVisasBrowserState({
    url: "https://connect.france-visas.gouv.fr/realms/usager/login",
    title: "Un instant…",
    bodyText: "Vérification de sécurité. Ray ID: abc123",
  }).checkpoint, "waf");

  assert.equal(classifyFranceVisasBrowserState({
    url: "https://application-form.france-visas.gouv.fr/unexpected",
    title: "Unexpected page",
    bodyText: "Some unrelated content",
  }).checkpoint, "unknown");
});

test("france-visas browser: recognizes the current Keycloak OIDC login URL", () => {
  assert.equal(
    detectFranceVisasPageIdFromUrl(
      "https://connect.france-visas.gouv.fr/realms/usager/protocol/openid-connect/auth?client_id=fv-fo-keycloak-web",
    ),
    "login",
  );
  assert.equal(
    detectFranceVisasPageIdFromUrl(
      "https://connect.france-visas.gouv.fr/realms/usager/login-actions/registration?client_id=fv-fo-keycloak-web",
    ),
    "registration",
  );
});
