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
  assert.match(source, /waitForSecurityVerificationDialog/);
});
