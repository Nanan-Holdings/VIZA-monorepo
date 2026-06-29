import test from "node:test";
import assert from "node:assert/strict";
import { choosePhEtravelAccountPlan } from "../account";

test("choosePhEtravelAccountPlan reuses an existing PH eTravel account", () => {
  const plan = choosePhEtravelAccountPlan({
    existingAccount: {
      id: "acct_existing",
      email: "appl-existing@haggstorm.com",
      password: "saved-password",
      status: "verified",
      storageState: null,
    },
    aliasEmail: "appl-new@haggstorm.com",
    generatedPassword: "new-password",
  });

  assert.deepEqual(plan, {
    mode: "reuse_existing",
    accountId: "acct_existing",
    email: "appl-existing@haggstorm.com",
    password: "saved-password",
  });
});

test("choosePhEtravelAccountPlan creates an alias account when none exists", () => {
  const plan = choosePhEtravelAccountPlan({
    existingAccount: null,
    aliasEmail: "APPL-NEW@HAGGSTORM.COM",
    generatedPassword: "new-password",
  });

  assert.deepEqual(plan, {
    mode: "create_new",
    email: "appl-new@haggstorm.com",
    password: "new-password",
  });
});
