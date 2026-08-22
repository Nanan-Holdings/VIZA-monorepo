import assert from "node:assert/strict";
import { test } from "node:test";
import {
  redactCanadaPortalDiagnostic,
  sanitizeCanadaPortalUrl,
} from "../diagnostics.js";

test("CA persisted diagnostics redact raw and URL-encoded managed credentials", () => {
  const email = "managed+canada@example.test";
  const password = "not-a-real password";
  const diagnostic = redactCanadaPortalDiagnostic(
    `login=${email}&password=${encodeURIComponent(password)} raw=${password}`,
    { email, password },
  );

  assert.equal(diagnostic.includes(email), false);
  assert.equal(diagnostic.includes(password), false);
  assert.equal(diagnostic.includes(encodeURIComponent(password)), false);
  assert.match(diagnostic, /\[redacted\]/);
});

test("CA persisted portal URLs keep only resumable non-secret parameters", () => {
  assert.equal(
    sanitizeCanadaPortalUrl(
      "https://tr-rt.apps.cic.gc.ca/start?appId=123&appPkgId=456&continue=true&token=secret",
    ),
    "https://tr-rt.apps.cic.gc.ca/start?appId=123&appPkgId=456&continue=true",
  );
  assert.equal(
    sanitizeCanadaPortalUrl(
      "https://portal-portail.apps.cic.gc.ca/dashboard?lang=en&token=secret",
    ),
    "https://portal-portail.apps.cic.gc.ca/dashboard?lang=en",
  );
  assert.equal(sanitizeCanadaPortalUrl("https://example.test/pay?appId=123"), undefined);
  assert.equal(
    sanitizeCanadaPortalUrl("http://tr-rt.apps.cic.gc.ca/start?appId=123"),
    undefined,
  );
  assert.equal(
    sanitizeCanadaPortalUrl(
      "https://tr-rt.apps.cic.gc.ca.evil.example/start?appId=123",
    ),
    undefined,
  );
  assert.equal(
    sanitizeCanadaPortalUrl(
      "https://user:password@tr-rt.apps.cic.gc.ca/start?appId=123",
    ),
    undefined,
  );
  assert.equal(
    sanitizeCanadaPortalUrl("https://tr-rt.apps.cic.gc.ca:444/start?appId=123"),
    undefined,
  );
});
