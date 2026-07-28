import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExistingAuthUserUpdate,
  shouldResetExistingPassword,
} from "../init-admin-account-helpers.mjs";

test("existing admin update omits password unless reset was explicitly requested", () => {
  const update = buildExistingAuthUserUpdate({
    existingUserMetadata: { locale: "zh" },
    name: "VIZA Test Admin",
    role: "admin",
    password: "Viza-random-generated!1",
    shouldUpdatePassword: false,
  });

  assert.deepEqual(update, {
    user_metadata: {
      locale: "zh",
      name: "VIZA Test Admin",
      role: "admin",
    },
  });
});

test("existing admin update includes explicit reset password when reset was requested", () => {
  const update = buildExistingAuthUserUpdate({
    existingUserMetadata: {},
    name: "VIZA Test Admin",
    role: "admin",
    password: "explicit-password",
    shouldUpdatePassword: true,
  });

  assert.deepEqual(update, {
    password: "explicit-password",
    user_metadata: {
      name: "VIZA Test Admin",
      role: "admin",
    },
  });
});

test("env or password-only values do not permit overwriting an existing password", () => {
  assert.equal(
    shouldResetExistingPassword({
      resetPassword: false,
      passwordArg: "from-env-or-cli",
    }),
    false,
  );
  assert.equal(
    shouldResetExistingPassword({
      resetPassword: true,
      passwordArg: undefined,
    }),
    false,
  );
  assert.equal(
    shouldResetExistingPassword({
      resetPassword: true,
      passwordArg: "intentional-reset",
    }),
    true,
  );
});

test("admin init CLI module can be imported without running bootstrap", async () => {
  await import("../init-admin-account.mjs");
});
