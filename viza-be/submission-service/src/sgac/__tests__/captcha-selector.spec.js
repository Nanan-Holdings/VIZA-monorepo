const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

test("SGAC CAPTCHA solver does not pick the last image in the modal", () => {
  const source = readFileSync(path.join(__dirname, "..", "runner.ts"), "utf8");
  assert.doesNotMatch(
    source,
    /locator\("img, canvas"\)\.last\(\)/,
    "the last image is the ICA audio icon; choose the CAPTCHA image by visible size instead",
  );
  assert.match(source, /isLikelyCaptchaImageBox/);
});

test("SGAC CAPTCHA solver does not require the ICA security title to reappear", () => {
  const source = readFileSync(path.join(__dirname, "..", "runner.ts"), "utf8");
  assert.doesNotMatch(
    source,
    /getByText\(\s*\/Security Verification\/i\s*\)\.last\(\)\.waitFor/,
    "ICA can refresh the CAPTCHA without re-rendering the Security Verification title",
  );
  assert.match(source, /waitForSecurityVerificationTarget/);
});

test("SGAC CAPTCHA solver refreshes and retries transient 2captcha failures", () => {
  const source = readFileSync(path.join(__dirname, "..", "runner.ts"), "utf8");
  assert.match(source, /ERROR_CAPTCHA_UNSOLVABLE/);
  assert.match(source, /refreshSecurityCaptcha/);
  assert.match(source, /sgac_captcha_unsolvable/);
});

test("SGAC CAPTCHA solver waits for refreshed images and refinds the active input", () => {
  const source = readFileSync(path.join(__dirname, "..", "runner.ts"), "utf8");
  assert.match(source, /SGAC_CAPTCHA_MAX_ATTEMPTS/);
  assert.match(source, /captchaImageFingerprint/);
  assert.match(source, /sgac_captcha_refreshed/);
  assert.match(source, /const fillTarget = await waitForSecurityVerificationTarget/);
  assert.match(source, /sgac_captcha_empty_solver_answer/);
});

test("SGAC runner reports official declaration-limit errors explicitly", () => {
  const source = readFileSync(path.join(__dirname, "..", "runner.ts"), "utf8");
  assert.match(source, /maximum allowable SGAC declaration count/);
  assert.match(source, /sgac_declaration_limit_reached/);
  assert.match(source, /ICA SGAC returned an error after final submit/);
});
