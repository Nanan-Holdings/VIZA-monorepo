import { test } from "node:test";
import assert from "node:assert/strict";
import {
  standardFieldMappings,
  mapAnswers,
  missingRequired,
  isoToDmySlash,
  isoToDmyDash,
  withRetry,
  detectAndSolveCaptcha,
} from "../standard-evisa.js";

/**
 * RUN-CORE-001: the shared standard-e-Visa core consumed by CA/TR/TH/AE
 * (and SA/MY recon). Covers the pure helpers + the captcha hook's no-key path.
 */

test("standard-evisa: date transforms", () => {
  assert.equal(isoToDmySlash("1990-04-15"), "15/04/1990");
  assert.equal(isoToDmyDash("1990-04-15"), "15-04-1990");
  assert.equal(isoToDmySlash("bad"), "bad");
});

test("standard-evisa: mapAnswers + missingRequired over the standard set", () => {
  const mappings = standardFieldMappings(isoToDmySlash);
  assert.equal(mappings.length, 10);
  const sample = { surname: "X", given_names: "Y", email: "e@e.com", date_of_birth: "1990-04-15", nationality: "CHN", passport_number: "P1", passport_expiry_date: "2030-01-01" };
  const mapped = mapAnswers(mappings, sample);
  assert.equal(mapped.find((m) => m.selector === 'input[name="date_of_birth"]')?.value, "15/04/1990");
  assert.deepEqual(missingRequired(mappings, sample), []);
  assert.ok(missingRequired(mappings, {}).includes("surname"));
});

test("standard-evisa: withRetry succeeds after transient failures", async () => {
  let n = 0;
  const out = await withRetry(async () => {
    n += 1;
    if (n < 2) throw new Error("transient");
    return "ok";
  }, 3, 1);
  assert.equal(out, "ok");
  assert.equal(n, 2);
});

test("standard-evisa: captcha hook returns null without an API key", async () => {
  const prev = process.env.TWOCAPTCHA_API_KEY;
  delete process.env.TWOCAPTCHA_API_KEY;
  try {
    // page is never touched when no API key is configured.
    const result = await detectAndSolveCaptcha({} as never);
    assert.equal(result, null);
  } finally {
    if (prev !== undefined) process.env.TWOCAPTCHA_API_KEY = prev;
  }
});
