import test from "node:test";
import assert from "node:assert/strict";
import { choosePhEtravelAccountPlan, isMissingPhEtravelAccountsTableError } from "../account";

test("choosePhEtravelAccountPlan reuses an existing PH eTravel account", () => {
  const plan = choosePhEtravelAccountPlan({
    existingAccount: {
      id: "acct_existing",
      email: "appl-existing@haggstorm.com",
      password: "saved-password",
      mpin: "123456",
      status: "verified",
      storageState: null,
    },
    aliasEmail: "appl-new@haggstorm.com",
    generatedPassword: "new-password",
    generatedMpin: "654321",
  });

  assert.deepEqual(plan, {
    mode: "reuse_existing",
    accountId: "acct_existing",
    email: "appl-existing@haggstorm.com",
    password: "saved-password",
    mpin: "123456",
  });
});

test("choosePhEtravelAccountPlan creates a new account when the saved account has no MPIN", () => {
  const plan = choosePhEtravelAccountPlan({
    existingAccount: {
      id: "acct_existing",
      email: "appl-existing@haggstorm.com",
      password: "saved-password",
      mpin: null,
      status: "verified",
      storageState: null,
    },
    aliasEmail: "APPL-NEW+PH@HAGGSTORM.COM",
    generatedPassword: "new-password",
    generatedMpin: "654321",
  });

  assert.deepEqual(plan, {
    mode: "create_new",
    email: "appl-new+ph@haggstorm.com",
    password: "new-password",
    mpin: "654321",
  });
});

test("choosePhEtravelAccountPlan continues pending account registration", () => {
  const plan = choosePhEtravelAccountPlan({
    existingAccount: {
      id: "vault:applicant",
      email: "appl-existing-ph123456@haggstorm.com",
      password: "saved-password",
      mpin: "123456",
      status: "pending_registration",
      storageState: null,
    },
    aliasEmail: "appl-new@haggstorm.com",
    generatedPassword: "new-password",
    generatedMpin: "654321",
  });

  assert.deepEqual(plan, {
    mode: "create_new",
    accountId: "vault:applicant",
    email: "appl-existing-ph123456@haggstorm.com",
    password: "saved-password",
    mpin: "123456",
  });
});

test("choosePhEtravelAccountPlan creates an alias account when none exists", () => {
  const plan = choosePhEtravelAccountPlan({
    existingAccount: null,
    aliasEmail: "APPL-NEW@HAGGSTORM.COM",
    generatedPassword: "new-password",
    generatedMpin: "654321",
  });

  assert.deepEqual(plan, {
    mode: "create_new",
    email: "appl-new@haggstorm.com",
    password: "new-password",
    mpin: "654321",
  });
});

test("choosePhEtravelAccountPlan creates a new account after a failed prior account", () => {
  const plan = choosePhEtravelAccountPlan({
    existingAccount: {
      id: "acct_existing",
      email: "appl-existing@haggstorm.com",
      password: "saved-password",
      mpin: "123456",
      status: "failed",
      storageState: null,
    },
    aliasEmail: "APPL-NEW@HAGGSTORM.COM",
    generatedPassword: "new-password",
    generatedMpin: "654321",
  });

  assert.deepEqual(plan, {
    mode: "create_new",
    email: "appl-new@haggstorm.com",
    password: "new-password",
    mpin: "654321",
  });
});

test("isMissingPhEtravelAccountsTableError detects missing PostgREST table errors", () => {
  assert.equal(isMissingPhEtravelAccountsTableError({
    code: "PGRST205",
    message: "Could not find the table 'public.ph_etravel_accounts' in the schema cache",
  }), true);
  assert.equal(isMissingPhEtravelAccountsTableError({
    code: "42501",
    message: "permission denied",
  }), false);
});
