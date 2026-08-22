import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldRegisterSaudiManagedAccount } from "../registration-policy.js";

/**
 * Regression cover for a live-QA defect: the runner re-submitted the VisitSaudi
 * registration form for an already-confirmed managed account. VisitSaudi
 * rejected the duplicate, and the resulting session state made the follow-up
 * login report "credentials rejected" even though the vaulted password was
 * valid — which looked like a lost password rather than a runner bug.
 */

test("registers a prepared account that the portal has not confirmed", () => {
  assert.equal(
    shouldRegisterSaudiManagedAccount({
      checkpoint: "account_registration",
      accountPreparationEnabled: true,
      accountConfirmed: false,
    }),
    true,
  );
});

test("never re-registers a confirmed managed account", () => {
  assert.equal(
    shouldRegisterSaudiManagedAccount({
      checkpoint: "account_registration",
      accountPreparationEnabled: true,
      accountConfirmed: true,
    }),
    false,
  );
});

test("does not register when account preparation is disabled", () => {
  assert.equal(
    shouldRegisterSaudiManagedAccount({
      checkpoint: "account_registration",
      accountPreparationEnabled: false,
      accountConfirmed: false,
    }),
    false,
  );
});

test("does not register away from the registration checkpoint", () => {
  for (const checkpoint of ["login", "sms_otp", "payment", "captcha", "unknown"]) {
    assert.equal(
      shouldRegisterSaudiManagedAccount({
        checkpoint,
        accountPreparationEnabled: true,
        accountConfirmed: false,
      }),
      false,
      `expected no registration at ${checkpoint}`,
    );
  }
});
